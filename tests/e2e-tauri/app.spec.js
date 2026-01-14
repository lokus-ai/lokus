/**
 * Tauri App E2E Tests
 *
 * These tests run against the REAL Tauri application.
 * They use WebdriverIO + tauri-driver to control the native app.
 */

import { browser, expect } from '@wdio/globals';

describe('Lokus Tauri App', () => {
  it('should launch the app', async () => {
    // App should launch - if we get here, it worked
    const title = await browser.getTitle();
    console.log('App title:', title);

    // The app should have loaded something
    expect(title).toBeDefined();
  });

  it('should show launcher or workspace', async () => {
    // Wait for app to fully load
    await browser.pause(2000);

    // Check if we're on launcher (Open Workspace button) or workspace (file tree)
    const openWorkspaceBtn = await browser.$('button*=Open Workspace');
    const fileTree = await browser.$('.file-tree, .file-explorer, [data-testid="file-tree"]');

    const isLauncher = await openWorkspaceBtn.isExisting();
    const isWorkspace = await fileTree.isExisting();

    console.log('Is launcher:', isLauncher);
    console.log('Is workspace:', isWorkspace);

    // Should be one or the other
    expect(isLauncher || isWorkspace).toBe(true);
  });

  it('should be able to interact with UI elements', async () => {
    await browser.pause(1000);

    // Try to find any clickable element
    const buttons = await browser.$$('button');
    console.log('Found buttons:', buttons.length);

    expect(buttons.length).toBeGreaterThan(0);
  });
});

describe('Workspace Tests', () => {
  it('should open a workspace when path is valid', async () => {
    // This test requires a real workspace path
    // In CI, global setup will create one

    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    // Navigate to workspace using URL
    await browser.url(`/?workspacePath=${encodeURIComponent(workspacePath)}`);
    await browser.pause(3000);

    // File tree should be visible
    const fileTree = await browser.$('.file-tree, .file-explorer, [data-testid="file-tree"]');
    await fileTree.waitForExist({ timeout: 10000 });

    expect(await fileTree.isDisplayed()).toBe(true);
  });

  it('should show files in the file tree', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    // Look for test files we created
    const testNote = await browser.$('*=test-note.md');
    const readme = await browser.$('*=README.md');

    const hasTestNote = await testNote.isExisting();
    const hasReadme = await readme.isExisting();

    console.log('Has test-note.md:', hasTestNote);
    console.log('Has README.md:', hasReadme);

    expect(hasTestNote || hasReadme).toBe(true);
  });
});

describe('Editor Tests', () => {
  it('should open editor when file is clicked', async () => {
    const workspacePath = process.env.LOKUS_E2E_WORKSPACE;
    if (!workspacePath) {
      console.log('Skipping - no workspace path set');
      return;
    }

    // Find and click a markdown file
    const mdFile = await browser.$('*=.md');
    if (await mdFile.isExisting()) {
      await mdFile.doubleClick();
      await browser.pause(1000);

      // Editor should appear
      const editor = await browser.$('.ProseMirror');
      await editor.waitForExist({ timeout: 5000 });

      expect(await editor.isDisplayed()).toBe(true);
    }
  });

  it('should allow typing in editor', async () => {
    const editor = await browser.$('.ProseMirror');
    if (!(await editor.isExisting())) {
      console.log('Skipping - editor not open');
      return;
    }

    // Click and type
    await editor.click();
    await browser.keys(['Test typing from E2E']);
    await browser.pause(500);

    // Content should include what we typed
    const content = await editor.getText();
    expect(content).toContain('Test typing from E2E');
  });
});
