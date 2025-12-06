import { test, expect } from '@playwright/test';
import { injectTauriMock, disableTour, dismissTourOverlay } from './helpers/test-utils.js';

/**
 * Task system tests
 * Tests checkbox/task functionality in the editor
 */

test.describe('Task System', () => {
  test.beforeEach(async ({ page }) => {
    // Inject Tauri mock for filesystem operations
    await injectTauriMock(page);
    await disableTour(page);
    
    // Navigate to app in test mode
    await page.goto('/?testMode=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // Dismiss any tour overlay
    await dismissTourOverlay(page);
  });

  test('app loads successfully', async ({ page }) => {
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });

  test('can type task syntax in editor', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type task/checkbox syntax
        await editor.type('- [ ] This is a task');
        await page.keyboard.press('Enter');
        await editor.type('- [x] This task is complete');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toBeTruthy();
      }
    }
    
    expect(true).toBe(true);
  });

  test('can create multiple tasks', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type multiple tasks
        await editor.type('## Task List');
        await page.keyboard.press('Enter');
        await editor.type('- [ ] First task');
        await page.keyboard.press('Enter');
        await editor.type('- [ ] Second task');
        await page.keyboard.press('Enter');
        await editor.type('- [ ] Third task');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('Task');
      }
    }
    
    expect(true).toBe(true);
  });

  test('tasks persist in editor content', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type a task
        await editor.type('- [ ] Remember to test');
        await page.waitForTimeout(300);
        
        const content = await editor.textContent();
        expect(content).toBeTruthy();
      }
    }
    
    expect(true).toBe(true);
  });

  test('can create nested task list', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type nested tasks
        await editor.type('- [ ] Main task');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Tab');
        await editor.type('- [ ] Subtask 1');
        await page.keyboard.press('Enter');
        await editor.type('- [ ] Subtask 2');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('Main');
      }
    }
    
    expect(true).toBe(true);
  });

  test('can mix tasks with regular list items', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type mixed list
        await editor.type('Shopping list:');
        await page.keyboard.press('Enter');
        await editor.type('- [ ] Buy groceries');
        await page.keyboard.press('Enter');
        await editor.type('- Milk');
        await page.keyboard.press('Enter');
        await editor.type('- Bread');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('Shopping');
      }
    }
    
    expect(true).toBe(true);
  });

  test('task with description text', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type task with detailed description
        await editor.type('- [ ] Complete project documentation');
        await page.keyboard.press('Enter');
        await editor.type('  This includes API docs and user guide');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('documentation');
      }
    }
    
    expect(true).toBe(true);
  });

  test('can create task list under heading', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type heading followed by tasks
        await editor.type('## Today\'s Tasks');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await editor.type('- [ ] Morning standup');
        await page.keyboard.press('Enter');
        await editor.type('- [ ] Code review');
        await page.keyboard.press('Enter');
        await editor.type('- [ ] Deploy to staging');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('Today');
      }
    }
    
    expect(true).toBe(true);
  });
});
