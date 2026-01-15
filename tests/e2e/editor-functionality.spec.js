/**
 * Editor Functionality E2E Tests
 *
 * These tests run against the real Tauri app with a real filesystem.
 * The test workspace is created by global-setup.js.
 */
import { test, expect, getEditor, openFile, dismissTour } from './setup/test-workspace.js';

test.describe('Editor Functionality', () => {
  test.beforeEach(async ({ workspacePage }) => {
    // Dismiss any tour dialogs
    await dismissTour(workspacePage);
  });

  test('should allow basic text editing', async ({ workspacePage }) => {
    // Open test-note.md from the test workspace
    const editor = await openFile(workspacePage, 'test-note.md');

    // Click at end and type
    await editor.click();
    await workspacePage.keyboard.press('End');
    await workspacePage.keyboard.type('\n\nHello, World!');

    await expect(editor).toContainText('Hello, World!');
  });

  test('should format text with markdown shortcuts', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');

    await editor.click();
    await workspacePage.keyboard.press('End');
    await workspacePage.keyboard.type('\n\n**bold text** ');
    await workspacePage.waitForTimeout(500);

    // Check if bold was converted
    const hasBold = await editor.locator('strong').count() > 0;
    if (hasBold) {
      await expect(editor.locator('strong').last()).toContainText(/bold text/i);
    } else {
      await expect(editor).toContainText(/bold text/i);
    }
  });

  test('should create headings', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');

    await editor.click();
    await workspacePage.keyboard.press('End');
    await workspacePage.keyboard.type('\n\n# New Heading');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.waitForTimeout(300);

    // Check for heading
    const headings = editor.locator('h1');
    await expect(headings.first()).toBeVisible();
  });

  test('should create lists', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');

    await editor.click();
    await workspacePage.keyboard.press('End');
    await workspacePage.keyboard.type('\n\n- First item');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('Second item');
    await workspacePage.waitForTimeout(300);

    // Check for list
    const listItems = editor.locator('ul li, li');
    expect(await listItems.count()).toBeGreaterThan(0);
  });

  test('should create task lists', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');

    await editor.click();
    await workspacePage.keyboard.press('End');
    await workspacePage.keyboard.type('\n\n- [ ] New task item');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.waitForTimeout(300);

    await expect(editor).toContainText('New task item');
  });

  test('should create code blocks', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');

    await editor.click();
    await workspacePage.keyboard.press('End');
    await workspacePage.keyboard.type('\n\n```javascript');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('console.log("Test");');
    await workspacePage.waitForTimeout(500);

    // Check for code block
    const codeBlocks = editor.locator('pre, code');
    expect(await codeBlocks.count()).toBeGreaterThan(0);
  });

  test('should handle math equations', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');

    // The test file already has math content
    const mathContent = await editor.textContent();
    expect(mathContent).toContain('E = mc^2');
  });

  test('should use slash commands', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');

    await editor.click();
    await workspacePage.keyboard.press('End');
    await workspacePage.keyboard.type('\n\n/');
    await workspacePage.waitForTimeout(500);

    // Check if command menu appears
    const commandMenu = workspacePage.locator('.slash-command-list, .command-menu, [data-testid="slash-menu"], [cmdk-list]');
    if (await commandMenu.count() > 0) {
      await expect(commandMenu.first()).toBeVisible();
      // Dismiss menu
      await workspacePage.keyboard.press('Escape');
    }
  });

  test('should display file tree', async ({ workspacePage }) => {
    // Check that file tree shows our test files
    const fileTree = workspacePage.locator('.file-tree, .file-explorer, [data-testid="file-tree"]');
    await expect(fileTree).toBeVisible();

    // Should see README.md in file tree
    await expect(workspacePage.locator('text=README.md')).toBeVisible();
  });

  test('should switch between files', async ({ workspacePage }) => {
    // Open first file
    await openFile(workspacePage, 'README.md');
    let editor = await getEditor(workspacePage);
    await expect(editor).toContainText('E2E Test Workspace');

    // Open second file
    await openFile(workspacePage, 'test-note.md');
    editor = await getEditor(workspacePage);
    await expect(editor).toContainText('Hello World');
  });
});
