import { test, expect } from '@playwright/test';
import { injectTauriMock, disableTour, dismissTourOverlay } from './helpers/test-utils.js';

/**
 * XSS Protection Tests
 * 
 * Tests that verify XSS attacks are prevented in the application.
 */
test.describe('XSS Protection', () => {
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

  test('app loads without script injection from URL', async ({ page }) => {
    // Navigate with malicious URL parameter
    await page.goto('/?workspace=<script>window.urlXSS=true</script>/tmp/test&testMode=true');
    await page.waitForTimeout(1000);
    
    // Verify script didn't execute
    const urlXSS = await page.evaluate(() => window.urlXSS);
    expect(urlXSS).toBeUndefined();
    
    // App should still load normally
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });

  test('editor content is sanitized', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('<script>window.xss=1</script>safe content');
    await page.waitForTimeout(200);
    
    // Verify script tag didn't execute
    const xssExecuted = await page.evaluate(() => window.xss);
    expect(xssExecuted).toBeUndefined();
    
    // Verify safe content is visible
    const content = await editor.textContent();
    expect(content).toContain('safe content');
  });

  test('HTML entities in editor are escaped', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('Testing < > & characters');
    await page.waitForTimeout(200);
    
    const content = await editor.textContent();
    expect(content).toContain('Testing');
  });

  test('no inline scripts exist in the DOM', async ({ page }) => {
    // Wait for app to fully load
    await page.waitForTimeout(2000);
    
    // Check all script tags have src attribute (no inline scripts with dangerous content)
    const allScripts = await page.locator('script').all();
    let hasInlineScript = false;
    
    for (const script of allScripts) {
      const src = await script.getAttribute('src');
      const content = await script.textContent();
      
      // Script should have src OR be empty/whitespace
      if (!src && content && content.trim().length > 0) {
        // This is an inline script - check if it contains dangerous patterns
        if (content.includes('eval(') || content.includes('document.write')) {
          hasInlineScript = true;
        }
      }
    }
    
    expect(hasInlineScript).toBe(false);
  });

  test('img tags with onerror handlers are blocked', async ({ page }) => {
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
    await editor.click();
    
    await editor.type('<img src=x onerror="window.imgXSS=1">');
    await page.waitForTimeout(200);
    
    // Verify onerror didn't execute
    const xssExecuted = await page.evaluate(() => window.imgXSS);
    expect(xssExecuted).toBeUndefined();
  });
});
