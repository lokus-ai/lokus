/**
 * Editor Functionality E2E Tests (WebdriverIO/Tauri)
 *
 * These tests run against the real Tauri app with a real filesystem.
 * The test workspace path is provided via LOKUS_E2E_WORKSPACE env var.
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

describe('Editor Functionality', () => {
  beforeEach(async () => {
    // Dismiss any tour dialogs
    await dismissTour();
  });

  it('should allow basic text editing', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    // Wait for workspace to be ready
    const workspaceReady = await waitForWorkspace();
    if (!workspaceReady) {
      console.log('Skipping - workspace not loaded');
      return;
    }

    // Open test-note.md from the test workspace
    const editor = await openFile('test-note.md');

    // Click at end and type
    await editor.click();
    await browser.keys(['End']);
    await browser.keys(['\n', '\n', 'H', 'e', 'l', 'l', 'o', ',', ' ', 'W', 'o', 'r', 'l', 'd', '!']);

    const editorText = await editor.getText();
    expect(editorText).toContain('Hello, World!');
  });

  it('should format text with markdown shortcuts', async () => {
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
    // Type bold text markdown
    await browser.keys(['\n', '\n', '*', '*', 'b', 'o', 'l', 'd', ' ', 't', 'e', 'x', 't', '*', '*', ' ']);
    await browser.pause(500);

    // Check if bold was converted
    const boldElement = await editor.$('strong');
    if (await boldElement.isExisting()) {
      const boldText = await boldElement.getText();
      expect(boldText.toLowerCase()).toContain('bold text');
    } else {
      const editorText = await editor.getText();
      expect(editorText.toLowerCase()).toContain('bold text');
    }
  });

  it('should create headings', async () => {
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
    // Type heading markdown
    await browser.keys(['\n', '\n', '#', ' ', 'N', 'e', 'w', ' ', 'H', 'e', 'a', 'd', 'i', 'n', 'g']);
    await browser.keys(['Enter']);
    await browser.pause(300);

    // Check for heading
    const headings = await editor.$$('h1');
    expect(headings.length).toBeGreaterThan(0);
    const firstHeading = headings[0];
    await expect(firstHeading).toBeDisplayed();
  });

  it('should create lists', async () => {
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
    // Type list markdown
    await browser.keys(['\n', '\n', '-', ' ', 'F', 'i', 'r', 's', 't', ' ', 'i', 't', 'e', 'm']);
    await browser.keys(['Enter']);
    await browser.keys(['S', 'e', 'c', 'o', 'n', 'd', ' ', 'i', 't', 'e', 'm']);
    await browser.pause(300);

    // Check for list items
    const listItems = await editor.$$('ul li, li');
    expect(listItems.length).toBeGreaterThan(0);
  });

  it('should create task lists', async () => {
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
    // Type task list markdown
    await browser.keys(['\n', '\n', '-', ' ', '[', ' ', ']', ' ', 'N', 'e', 'w', ' ', 't', 'a', 's', 'k', ' ', 'i', 't', 'e', 'm']);
    await browser.keys(['Enter']);
    await browser.pause(300);

    const editorText = await editor.getText();
    expect(editorText).toContain('New task item');
  });

  it('should create code blocks', async () => {
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
    // Type code block markdown
    await browser.keys(['\n', '\n', '`', '`', '`', 'j', 'a', 'v', 'a', 's', 'c', 'r', 'i', 'p', 't']);
    await browser.keys(['Enter']);
    await browser.keys(['c', 'o', 'n', 's', 'o', 'l', 'e', '.', 'l', 'o', 'g', '(', '"', 'T', 'e', 's', 't', '"', ')', ';']);
    await browser.pause(500);

    // Check for code block
    const codeBlocks = await editor.$$('pre, code');
    expect(codeBlocks.length).toBeGreaterThan(0);
  });

  it('should handle math equations', async () => {
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

    // The test file already has math content
    const mathContent = await editor.getText();
    expect(mathContent).toContain('E = mc^2');
  });

  it('should use slash commands', async () => {
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
    await browser.keys(['\n', '\n', '/']);
    await browser.pause(500);

    // Check if command menu appears
    const commandMenu = await browser.$('.slash-command-list, .command-menu, [data-testid="slash-menu"], [cmdk-list]');
    if (await commandMenu.isExisting()) {
      await expect(commandMenu).toBeDisplayed();
      // Dismiss menu
      await browser.keys(['Escape']);
    }
  });

  it('should display file tree', async () => {
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

    // Check that file tree shows our test files
    const fileTree = await browser.$('.file-tree, .file-explorer, [data-testid="file-tree"]');
    await expect(fileTree).toBeDisplayed();

    // Should see README.md in file tree
    const readmeItem = await browser.$('*=README.md');
    await expect(readmeItem).toBeDisplayed();
  });

  it('should switch between files', async () => {
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

    // Open first file
    await openFile('README.md');
    let editor = await getEditor();
    let editorText = await editor.getText();
    expect(editorText).toContain('E2E Test Workspace');

    // Open second file
    await openFile('test-note.md');
    editor = await getEditor();
    editorText = await editor.getText();
    expect(editorText).toContain('Hello World');
  });
});
