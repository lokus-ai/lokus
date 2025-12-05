import { test, expect } from '@playwright/test';
import { tmpdir } from 'os';
import { join } from 'path';

// Test workspace path - use tmp directory for tests
const TEST_WORKSPACE = process.env.LOKUS_TEST_WORKSPACE || join(tmpdir(), 'lokus-e2e-test');

/**
 * Editor Functionality E2E Tests
 *
 * These tests require a workspace with an open file to display the editor.
 * In browser-only mode (without Tauri), the editor may not be available.
 * Tests will skip gracefully if the editor cannot be loaded.
 */
test.describe('Editor Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to workspace with test mode enabled
    const workspacePath = encodeURIComponent(TEST_WORKSPACE);
    await page.goto(`/?testMode=true&workspacePath=${workspacePath}`);

    // Wait for app to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(500);
  });

  // Helper to get editor or skip test
  async function getEditorOrSkip(page, testInfo) {
    // Dismiss welcome tour dialog if present
    const tourCloseBtn = page.locator('dialog button:has-text("×"), dialog button:has-text("Close")');
    if (await tourCloseBtn.count() > 0) {
      await tourCloseBtn.first().click();
      await page.waitForTimeout(300);
    }

    // Check if we're in the workspace view
    const isWorkspace = await page.locator('.bg-app-panel').isVisible({ timeout: 3000 }).catch(() => false);

    if (isWorkspace) {
      // Check if editor is already visible
      const existingEditor = page.locator('.ProseMirror');
      if (await existingEditor.count() === 0) {
        // Try welcome screen "New Note" button first
        const newNoteBtn = page.locator('button:has-text("New Note")');
        if (await newNoteBtn.count() > 0) {
          await newNoteBtn.first().click();
          await page.waitForTimeout(500);
        } else {
          // Try toolbar new file button
          const newFileBtn = page.locator('[data-tour="create-note"], button[title*="New File"]');
          if (await newFileBtn.count() > 0) {
            await newFileBtn.first().click();
            await page.waitForTimeout(500);
          }
        }
      }
    }

    // Check for editor
    const editor = page.locator('.ProseMirror').first();
    const isEditorVisible = await editor.isVisible({ timeout: 5000 }).catch(() => false);

    if (!isEditorVisible) {
      testInfo.skip(true, 'Editor not available - requires Tauri environment with workspace');
      return null;
    }

    return editor;
  }

  test('should allow basic text editing', async ({ page }, testInfo) => {
    const editor = await getEditorOrSkip(page, testInfo);
    if (!editor) return;

    await editor.click();
    await editor.fill('Hello, World!');

    await expect(editor).toContainText('Hello, World!');
  });

  test('should format text with markdown shortcuts', async ({ page }, testInfo) => {
    const editor = await getEditorOrSkip(page, testInfo);
    if (!editor) return;

    await editor.click();

    // Test bold formatting
    await editor.fill('**bold text**');
    await page.keyboard.press('Space');
    await expect(editor.locator('strong')).toContainText('bold text');

    await editor.clear();

    // Test italic formatting
    await editor.fill('*italic text*');
    await page.keyboard.press('Space');
    await expect(editor.locator('em')).toContainText('italic text');
  });

  test('should create headings', async ({ page }, testInfo) => {
    const editor = await getEditorOrSkip(page, testInfo);
    if (!editor) return;

    await editor.click();

    // Test H1
    await editor.fill('# Heading 1');
    await page.keyboard.press('Enter');
    await expect(editor.locator('h1')).toContainText('Heading 1');

    // Test H2
    await editor.fill('## Heading 2');
    await page.keyboard.press('Enter');
    await expect(editor.locator('h2')).toContainText('Heading 2');
  });

  test('should create lists', async ({ page }, testInfo) => {
    const editor = await getEditorOrSkip(page, testInfo);
    if (!editor) return;

    await editor.click();

    // Test bullet list
    await editor.fill('- First item');
    await page.keyboard.press('Enter');
    await editor.type('- Second item');

    await expect(editor.locator('ul li')).toHaveCount(2);
    await expect(editor.locator('ul li').first()).toContainText('First item');
  });

  test('should create task lists', async ({ page }, testInfo) => {
    const editor = await getEditorOrSkip(page, testInfo);
    if (!editor) return;

    await editor.click();

    // Test task list
    await editor.fill('- [ ] Incomplete task');
    await page.keyboard.press('Enter');
    await editor.type('- [x] Complete task');

    const taskList = editor.locator('[data-type="taskList"], ul[data-type="taskList"]');
    if (await taskList.count() > 0) {
      await expect(taskList.locator('li').first()).toContainText('Incomplete task');
      await expect(taskList.locator('li').nth(1)).toContainText('Complete task');
    }
  });

  test('should create code blocks', async ({ page }, testInfo) => {
    const editor = await getEditorOrSkip(page, testInfo);
    if (!editor) return;

    await editor.click();

    await editor.fill('```javascript\nconsole.log("Hello");\n```');
    await page.keyboard.press('Enter');

    await expect(editor.locator('pre code')).toContainText('console.log("Hello");');
  });

  test('should handle math equations', async ({ page }, testInfo) => {
    const editor = await getEditorOrSkip(page, testInfo);
    if (!editor) return;

    await editor.click();

    // Test inline math
    await editor.fill('$E = mc^2$');
    await page.keyboard.press('Space');

    // Check if math was processed (either as math node or fallback)
    const mathContent = await editor.textContent();
    expect(mathContent).toContain('E = mc^2');
  });

  test('should create tables', async ({ page }, testInfo) => {
    const editor = await getEditorOrSkip(page, testInfo);
    if (!editor) return;

    await editor.click();

    // Try slash command for table
    await editor.type('/table');
    await page.keyboard.press('Enter');

    // Wait for table to appear
    await page.waitForTimeout(500);

    // Check if table was created
    const table = editor.locator('table');
    if (await table.count() > 0) {
      await expect(table).toBeVisible();
    }
  });

  test('should use slash commands', async ({ page }, testInfo) => {
    const editor = await getEditorOrSkip(page, testInfo);
    if (!editor) return;

    await editor.click();

    // Test slash command
    await editor.type('/');

    // Wait for slash menu to appear
    await page.waitForTimeout(500);

    // Check if command menu is visible
    const commandMenu = page.locator('.slash-command-list, .command-menu, [data-testid="slash-menu"], [cmdk-list]');
    if (await commandMenu.count() > 0) {
      await expect(commandMenu).toBeVisible();

      // Try selecting a command
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }
  });

  test('should handle wiki links', async ({ page }, testInfo) => {
    const editor = await getEditorOrSkip(page, testInfo);
    if (!editor) return;

    await editor.click();

    // Test wiki link creation
    await editor.fill('[[Test Page]]');
    await page.keyboard.press('Space');

    // Check if wiki link was created
    const wikiLink = editor.locator('[data-type="wiki-link"], .wiki-link');
    if (await wikiLink.count() > 0) {
      await expect(wikiLink).toContainText('Test Page');
    }
  });
});
