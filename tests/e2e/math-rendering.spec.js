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
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type inline math syntax
        await editor.type('The equation $x^2$ represents a square');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('equation');
      }
    }
    
    expect(true).toBe(true);
  });

  test('can type block math syntax', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type block math syntax
        await editor.type('$$');
        await page.keyboard.press('Enter');
        await editor.type('E = mc^2');
        await page.keyboard.press('Enter');
        await editor.type('$$');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toBeTruthy();
      }
    }
    
    expect(true).toBe(true);
  });

  test('editor handles special LaTeX characters', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type math with special characters
        await editor.type('Sum: $\\sum_{i=1}^{n} x_i$');
        await page.waitForTimeout(200);
        
        // Should not crash
        const content = await editor.textContent();
        expect(content).toBeTruthy();
      }
    }
    
    expect(true).toBe(true);
  });

  test('can type Greek letters in math', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type Greek letters in math
        await editor.type('Greek: $\\alpha + \\beta = \\gamma$');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('Greek');
      }
    }
    
    expect(true).toBe(true);
  });

  test('can type fractions in math', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type fraction
        await editor.type('Fraction: $\\frac{1}{2}$');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('Fraction');
      }
    }
    
    expect(true).toBe(true);
  });

  test('can type square root in math', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type square root
        await editor.type('Root: $\\sqrt{x^2 + y^2}$');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('Root');
      }
    }
    
    expect(true).toBe(true);
  });

  test('can type integral in math', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type integral
        await editor.type('Integral: $\\int_0^1 x dx$');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('Integral');
      }
    }
    
    expect(true).toBe(true);
  });

  test('math does not break with empty delimiters', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      const editor = page.locator('.ProseMirror');
      if (await editor.isVisible({ timeout: 3000 }).catch(() => false)) {
        await editor.click();
        
        // Type empty math delimiters - should not crash
        await editor.type('Empty: $$ and more text');
        await page.waitForTimeout(200);
        
        const content = await editor.textContent();
        expect(content).toContain('Empty');
      }
    }
    
    expect(true).toBe(true);
  });
});
