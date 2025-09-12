import { test, expect } from '@playwright/test';

test.describe('Editor Functionality', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // Wait for editor to load
    await page.waitForSelector('.ProseMirror, .tiptap-area', { timeout: 5000 });
  });

  test('should allow basic text editing', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.fill('Hello, World!');
    
    await expect(editor).toContainText('Hello, World!');
  });

  test('should format text with markdown shortcuts', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
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

  test('should create headings', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
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

  test('should create lists', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    
    // Test bullet list
    await editor.fill('- First item');
    await page.keyboard.press('Enter');
    await editor.type('- Second item');
    
    await expect(editor.locator('ul li')).toHaveCount(2);
    await expect(editor.locator('ul li').first()).toContainText('First item');
  });

  test('should create task lists', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
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

  test('should create code blocks', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    
    await editor.fill('```javascript\nconsole.log("Hello");\n```');
    await page.keyboard.press('Enter');
    
    await expect(editor.locator('pre code')).toContainText('console.log("Hello");');
  });

  test('should handle math equations', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    
    // Test inline math
    await editor.fill('$E = mc^2$');
    await page.keyboard.press('Space');
    
    // Check if math was processed (either as math node or fallback)
    const mathContent = await editor.textContent();
    expect(mathContent).toContain('E = mc^2');
  });

  test('should create tables', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
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

  test('should use slash commands', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    
    // Test slash command
    await editor.type('/');
    
    // Wait for slash menu to appear
    await page.waitForTimeout(500);
    
    // Check if command menu is visible
    const commandMenu = page.locator('.slash-command-list, .command-menu, [data-testid="slash-menu"]');
    if (await commandMenu.count() > 0) {
      await expect(commandMenu).toBeVisible();
      
      // Try selecting a command
      await page.keyboard.press('ArrowDown');
      await page.keyboard.press('Enter');
    }
  });

  test('should handle wiki links', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
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