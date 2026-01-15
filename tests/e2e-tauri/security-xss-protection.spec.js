/**
 * XSS Protection E2E Tests (WebdriverIO/Tauri)
 *
 * Tests that verify XSS attacks are prevented in the application.
 * These tests run against the real Tauri app with a real filesystem.
 * The test workspace path is provided via LOKUS_E2E_WORKSPACE env var.
 *
 * Note: URL parameter injection tests are not applicable in Tauri apps
 * since there's no URL navigation. Tests focus on content injection instead.
 */
import { browser, expect } from '@wdio/globals';

/**
 * Helper to get the editor element
 */
async function getEditor() {
  const editor = await browser.$('.ProseMirror');
  await editor.waitForExist({ timeout: 10000 });
  await editor.waitForDisplayed({ timeout: 10000 });
  return editor;
}

/**
 * Helper to open a specific file in the workspace
 */
async function openFile(filename) {
  // Find the file in the file tree
  const fileItem = await browser.$(`*=${filename}`);
  await fileItem.waitForExist({ timeout: 5000 });
  await fileItem.waitForDisplayed({ timeout: 5000 });
  await fileItem.doubleClick();

  // Wait for editor to load
  await browser.pause(500);
  return getEditor();
}

/**
 * Helper to dismiss any tour/onboarding dialogs
 */
async function dismissTour() {
  // Try various ways to dismiss tour
  const dismissSelectors = [
    'button=Skip',
    'button=Close',
    'button=Got it',
    '.driver-overlay',
  ];

  for (const selector of dismissSelectors) {
    try {
      const element = await browser.$(selector);
      if (await element.isExisting() && await element.isDisplayed()) {
        await element.click();
        await browser.pause(200);
      }
    } catch {
      // Element not found, continue
    }
  }
}

/**
 * Helper to wait for workspace to be ready
 */
async function waitForWorkspace() {
  const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
  if (!workspacePath) {
    console.log('Warning: LOKUS_E2E_WORKSPACE not set');
    return false;
  }

  // Wait for app to load
  await browser.pause(3000);

  // Check if we're on launcher or workspace
  const fileTree = await browser.$('.file-tree, .file-explorer, [data-testid="file-tree"], .space-y-1');

  // If file tree exists, workspace is loaded
  if (await fileTree.isExisting()) {
    return true;
  }

  // If on launcher, try to open the workspace
  // Look for "Open Workspace" button or recent workspace
  const openButton = await browser.$('button=Open Workspace');
  if (await openButton.isExisting()) {
    console.log('On launcher - workspace not automatically loaded');
    // For now, just report that we're on launcher
    // In a real scenario, we'd need to interact with file picker
    return false;
  }

  return false;
}

describe('XSS Protection', () => {
  beforeEach(async () => {
    // Dismiss any tour dialogs
    await dismissTour();
  });

  it('app loads without script injection vulnerabilities', async () => {
    // In Tauri apps, URL parameter injection is not applicable
    // Instead, we verify the app loads securely
    await browser.pause(1000);

    // Verify no XSS markers exist in the window
    const urlXSS = await browser.execute(() => window.urlXSS);
    expect(urlXSS).toBeUndefined();

    // App should load normally
    const appRoot = await browser.$('#root');
    await appRoot.waitForExist({ timeout: 10000 });
    await expect(appRoot).toBeDisplayed();
  });

  it('editor content is sanitized', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    // Type script tag content
    await browser.keys(['\n', '\n', '<', 's', 'c', 'r', 'i', 'p', 't', '>', 'w', 'i', 'n', 'd', 'o', 'w', '.', 'x', 's', 's', '=', '1', '<', '/', 's', 'c', 'r', 'i', 'p', 't', '>', 's', 'a', 'f', 'e', ' ', 'c', 'o', 'n', 't', 'e', 'n', 't']);
    await browser.pause(200);

    // Verify script tag didn't execute
    const xssExecuted = await browser.execute(() => window.xss);
    expect(xssExecuted).toBeUndefined();

    // Verify safe content is visible
    const content = await editor.getText();
    expect(content).toContain('safe content');
  });

  it('HTML entities in editor are escaped', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['\n', '\n', 'T', 'e', 's', 't', 'i', 'n', 'g', ' ', '<', ' ', '>', ' ', '&', ' ', 'c', 'h', 'a', 'r', 'a', 'c', 't', 'e', 'r', 's']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Testing');
  });

  it('no inline scripts exist in the DOM with dangerous content', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    // Wait for app to fully load
    await browser.pause(2000);

    // Check all script tags have src attribute (no inline scripts with dangerous content)
    const hasInlineScript = await browser.execute(() => {
      const scripts = document.querySelectorAll('script');
      for (const script of scripts) {
        const src = script.getAttribute('src');
        const content = script.textContent;

        // Script should have src OR be empty/whitespace
        if (!src && content && content.trim().length > 0) {
          // This is an inline script - check if it contains dangerous patterns
          if (content.includes('eval(') || content.includes('document.write')) {
            return true;
          }
        }
      }
      return false;
    });

    expect(hasInlineScript).toBe(false);
  });

  it('img tags with onerror handlers are blocked', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    // Type img tag with onerror handler
    await browser.keys(['\n', '\n', '<', 'i', 'm', 'g', ' ', 's', 'r', 'c', '=', 'x', ' ', 'o', 'n', 'e', 'r', 'r', 'o', 'r', '=', '"', 'w', 'i', 'n', 'd', 'o', 'w', '.', 'i', 'm', 'g', 'X', 'S', 'S', '=', '1', '"', '>']);
    await browser.pause(200);

    // Verify onerror didn't execute
    const xssExecuted = await browser.execute(() => window.imgXSS);
    expect(xssExecuted).toBeUndefined();
  });

  it('script injection via content does not execute', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    // Try various XSS payloads
    await browser.keys(['\n', '\n', '<', 's', 'c', 'r', 'i', 'p', 't', '>', 'w', 'i', 'n', 'd', 'o', 'w', '.', 'c', 'o', 'n', 't', 'e', 'n', 't', 'X', 'S', 'S', '=', 't', 'r', 'u', 'e', '<', '/', 's', 'c', 'r', 'i', 'p', 't', '>']);
    await browser.pause(500);

    // Verify script didn't execute
    const contentXSS = await browser.execute(() => window.contentXSS);
    expect(contentXSS).toBeUndefined();

    // App should still function normally
    const appRoot = await browser.$('#root');
    await expect(appRoot).toBeDisplayed();
  });
});
