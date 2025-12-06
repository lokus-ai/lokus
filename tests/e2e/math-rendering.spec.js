import { test, expect } from '@playwright/test';
import { injectTauriMock, disableTour, dismissTourOverlay } from './helpers/test-utils.js';

/**
 * Math rendering tests
 * Tests LaTeX/KaTeX math rendering in the editor
 */

test.describe('Math Rendering', () => {
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

  test('can type inline math syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('The equation $x^2$ represents a square');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('equation');
  });

  test('can type block math syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('$$');
    await page.keyboard.press('Enter');
    await editor.type('E = mc^2');
    await page.keyboard.press('Enter');
    await editor.type('$$');
    await page.waitForTimeout(200);
    
    await expect(editor).toBeVisible();
  });

  test('editor handles special LaTeX characters', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('Sum: $\\sum_{i=1}^{n} x_i$');
    await page.waitForTimeout(200);
    
    // Should not crash - editor still visible
    await expect(editor).toBeVisible();
  });

  test('can type Greek letters in math', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('Greek: $\\alpha + \\beta = \\gamma$');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('Greek');
  });

  test('can type fractions in math', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('Fraction: $\\frac{1}{2}$');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('Fraction');
  });

  test('can type square root in math', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('Root: $\\sqrt{x^2 + y^2}$');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('Root');
  });

  test('can type integral in math', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('Integral: $\\int_0^1 x dx$');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('Integral');
  });

  test('math does not break with empty delimiters', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('Empty: $$ and more text');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('Empty');
  });
});
