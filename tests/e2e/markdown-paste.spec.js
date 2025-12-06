import { test, expect } from '@playwright/test';
import { injectTauriMock, disableTour, dismissTourOverlay } from './helpers/test-utils.js';

/**
 * Markdown paste tests
 * Tests pasting content with markdown formatting
 */

test.describe('Markdown Paste', () => {
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

  test('can type bold markdown syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('This is **bold** text');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('bold');
  });

  test('can type italic markdown syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('This is *italic* text');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('italic');
  });

  test('can type mixed markdown formatting', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('# Heading with **bold** and *italic*');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('Heading');
  });

  test('can type strikethrough markdown syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('This is ~~deleted~~ text');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('deleted');
  });

  test('can type inline code markdown syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('Use `console.log()` for debugging');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('console');
  });

  test('can type link markdown syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('Visit [Google](https://google.com) for search');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('Google');
  });

  test('can type blockquote markdown syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('> This is a quote');
    await page.keyboard.press('Enter');
    await editor.type('> from someone famous');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('quote');
  });

  test('can type horizontal rule markdown syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('Above the line');
    await page.keyboard.press('Enter');
    await editor.type('---');
    await page.keyboard.press('Enter');
    await editor.type('Below the line');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('line');
  });

  test('can type numbered list markdown syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('1. First item');
    await page.keyboard.press('Enter');
    await editor.type('2. Second item');
    await page.keyboard.press('Enter');
    await editor.type('3. Third item');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('First');
  });
});
