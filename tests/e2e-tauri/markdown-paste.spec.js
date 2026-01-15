/**
 * Markdown Paste Tests for Tauri App
 *
 * Tests pasting content with markdown formatting.
 * These tests run against the REAL Tauri application using WebdriverIO.
 */

import { browser, expect } from '@wdio/globals';

/**
 * Helper to dismiss any tour/onboarding dialogs
 */
async function dismissTour() {
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
      // Ignore if element not found
    }
  }
}

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
 * Helper to wait for workspace to be ready
 */
async function waitForWorkspace() {
  // Wait for app to load
  await browser.pause(2000);

  // Check if we need to open a workspace from launcher
  const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
  if (!workspacePath) {
    console.log('Warning: LOKUS_E2E_WORKSPACE not set');
  }

  // Wait for file tree to appear (indicates workspace is loaded)
  const fileTree = await browser.$('.file-tree, .file-explorer, [data-testid="file-tree"], .space-y-1');
  try {
    await fileTree.waitForExist({ timeout: 10000 });
  } catch {
    console.log('File tree not found - workspace may not be loaded');
  }
}

describe('Markdown Paste', () => {
  beforeEach(async () => {
    await dismissTour();
    await waitForWorkspace();
  });

  it('should load app successfully', async () => {
    const appRoot = await browser.$('#root');
    await expect(appRoot).toBeDisplayed();
  });

  it('should type bold markdown syntax', async () => {
    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    // Type newlines and bold text
    await browser.keys(['Enter', 'Enter']);
    await browser.keys(['This is **bold** text']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('bold');
  });

  it('should type italic markdown syntax', async () => {
    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['Enter', 'Enter']);
    await browser.keys(['This is *italic* text']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('italic');
  });

  it('should type mixed markdown formatting', async () => {
    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['Enter', 'Enter']);
    await browser.keys(['# Heading with **bold** and *italic*']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Heading');
  });

  it('should type strikethrough markdown syntax', async () => {
    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['Enter', 'Enter']);
    await browser.keys(['This is ~~deleted~~ text']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('deleted');
  });

  it('should type inline code markdown syntax', async () => {
    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['Enter', 'Enter']);
    await browser.keys(['Use `console.log()` for debugging']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('console');
  });

  it('should type link markdown syntax', async () => {
    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['Enter', 'Enter']);
    await browser.keys(['Visit [Google](https://google.com) for search']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Google');
  });

  it('should type blockquote markdown syntax', async () => {
    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['Enter', 'Enter']);
    await browser.keys(['> This is a quote']);
    await browser.keys(['Enter']);
    await browser.keys(['> from someone famous']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('quote');
  });

  it('should type horizontal rule markdown syntax', async () => {
    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['Enter', 'Enter']);
    await browser.keys(['Above the line']);
    await browser.keys(['Enter']);
    await browser.keys(['---']);
    await browser.keys(['Enter']);
    await browser.keys(['Below the line']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('line');
  });

  it('should type numbered list markdown syntax', async () => {
    const editor = await openFile('test-note.md');
    await editor.click();
    await browser.keys(['End']);

    await browser.keys(['Enter', 'Enter']);
    await browser.keys(['1. First item']);
    await browser.keys(['Enter']);
    await browser.keys(['2. Second item']);
    await browser.keys(['Enter']);
    await browser.keys(['3. Third item']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('First');
  });
});
