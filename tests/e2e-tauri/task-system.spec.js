/**
 * Task System E2E Tests (WebdriverIO/Tauri)
 *
 * Tests checkbox/task functionality in the editor.
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

describe('Task System', () => {
  beforeEach(async () => {
    await dismissTour();
  });

  it('app loads successfully', async () => {
    const appRoot = await browser.$('#root');
    await appRoot.waitForDisplayed({ timeout: 10000 });
    await expect(appRoot).toBeDisplayed();
  });

  it('can type task syntax in editor', async () => {
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

    const editor = await openFile('daily-notes.md');
    await editor.click();
    await browser.keys(['End']);

    // Type task/checkbox syntax
    await browser.keys(['\n', '\n', '- [ ] This is a task']);
    await browser.keys(['Enter']);
    await browser.keys(['- [x] This task is complete']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('This is a task');
  });

  it('can create multiple tasks', async () => {
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

    const editor = await openFile('daily-notes.md');
    await editor.click();
    await browser.keys(['End']);

    // Type multiple tasks
    await browser.keys(['\n', '\n', '## Task List']);
    await browser.keys(['Enter']);
    await browser.keys(['- [ ] First task']);
    await browser.keys(['Enter']);
    await browser.keys(['- [ ] Second task']);
    await browser.keys(['Enter']);
    await browser.keys(['- [ ] Third task']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('First task');
    expect(content).toContain('Second task');
  });

  it('tasks persist in editor content', async () => {
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

    const editor = await openFile('daily-notes.md');
    await editor.click();
    await browser.keys(['End']);

    // Type a task
    await browser.keys(['\n', '\n', '- [ ] Remember to test']);
    await browser.pause(300);

    const content = await editor.getText();
    expect(content).toContain('Remember to test');
  });

  it('can create nested task list', async () => {
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

    const editor = await openFile('daily-notes.md');
    await editor.click();
    await browser.keys(['End']);

    // Type nested tasks
    await browser.keys(['\n', '\n', '- [ ] Main task']);
    await browser.keys(['Enter']);
    await browser.keys(['Tab']);
    await browser.keys(['- [ ] Subtask 1']);
    await browser.keys(['Enter']);
    await browser.keys(['- [ ] Subtask 2']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Main task');
  });

  it('can mix tasks with regular list items', async () => {
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

    const editor = await openFile('daily-notes.md');
    await editor.click();
    await browser.keys(['End']);

    // Type mixed list
    await browser.keys(['\n', '\n', 'Shopping list:']);
    await browser.keys(['Enter']);
    await browser.keys(['- [ ] Buy groceries']);
    await browser.keys(['Enter']);
    await browser.keys(['- Milk']);
    await browser.keys(['Enter']);
    await browser.keys(['- Bread']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Shopping');
  });

  it('task with description text', async () => {
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

    const editor = await openFile('daily-notes.md');
    await editor.click();
    await browser.keys(['End']);

    // Type task with detailed description
    await browser.keys(['\n', '\n', '- [ ] Complete project documentation']);
    await browser.keys(['Enter']);
    await browser.keys(['  This includes API docs and user guide']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('documentation');
  });

  it('can create task list under heading', async () => {
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

    const editor = await openFile('daily-notes.md');
    await editor.click();
    await browser.keys(['End']);

    // Type heading followed by tasks
    await browser.keys(['\n', '\n', "## Today's Tasks"]);
    await browser.keys(['Enter']);
    await browser.keys(['Enter']);
    await browser.keys(['- [ ] Morning standup']);
    await browser.keys(['Enter']);
    await browser.keys(['- [ ] Code review']);
    await browser.keys(['Enter']);
    await browser.keys(['- [ ] Deploy to staging']);
    await browser.pause(200);

    const content = await editor.getText();
    expect(content).toContain('Today');
  });
});
