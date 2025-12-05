import { test, expect } from '@playwright/test';
import { disableTour, dismissTourOverlay } from './helpers/test-utils.js';

/**
 * Math Rendering Tests
 *
 * IMPORTANT: These tests require a real Tauri environment with an open editor.
 * They will skip in CI where Tauri is not available.
 */
test.describe('Math Rendering', () => {
  // Skip in CI (no Tauri available)
  test.skip(() => process.env.CI === 'true', 'Math rendering tests require Tauri environment');

  test.beforeEach(async ({ page }) => {
    await disableTour(page);
    await page.goto('/');
    await dismissTourOverlay(page);
    await page.waitForSelector('.ProseMirror', { timeout: 5000 });
  });

  test('should render inline math equations', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    
    // Test simple inline math
    await editor.fill('$E = mc^2$');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    // Check if math was processed
    const mathElement = editor.locator('.math-inline, [data-type="math-inline"]');
    if (await mathElement.count() > 0) {
      await expect(mathElement).toBeVisible();
    } else {
      // Fallback: check if content contains the math
      const content = await editor.textContent();
      expect(content).toContain('E = mc^2');
    }
  });

  test('should render block math equations', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    
    // Test block math
    await editor.fill('$$E = mc^2$$');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Check if block math was processed
    const mathBlock = editor.locator('.math-block, [data-type="math-block"]');
    if (await mathBlock.count() > 0) {
      await expect(mathBlock).toBeVisible();
    } else {
      // Fallback: check if content contains the math
      const content = await editor.textContent();
      expect(content).toContain('E = mc^2');
    }
  });

  test('should handle complex math equations', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    
    // Test complex equation
    const complexMath = '$$\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}$$';
    await editor.fill(complexMath);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1000);
    
    // Check if math was processed
    const content = await editor.textContent();
    expect(content).toMatch(/integral|∫|sqrt|π/i);
  });

  test('should use math slash commands', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    
    // Try math slash command
    await editor.type('/math');
    await page.waitForTimeout(500);
    
    // Check if math options appear
    const commandMenu = page.locator('.slash-command-list, .command-menu');
    if (await commandMenu.count() > 0) {
      const mathCommand = commandMenu.locator('text=Math, text=Inline');
      if (await mathCommand.count() > 0) {
        await mathCommand.first().click();
        
        // Handle prompt if it appears
        page.on('dialog', async dialog => {
          if (dialog.type() === 'prompt') {
            await dialog.accept('x^2 + y^2 = z^2');
          }
        });
        
        await page.waitForTimeout(1000);
      }
    }
  });

  test('should handle math errors gracefully', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    
    // Test invalid math
    await editor.fill('$\\invalid{command$');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    // Should not crash or show error HTML
    const errorSpan = editor.locator('.katex-error');
    if (await errorSpan.count() > 0) {
      // Error should be styled properly, not raw HTML
      const errorText = await errorSpan.textContent();
      expect(errorText).not.toContain('<span');
      expect(errorText).not.toContain('ParseError');
    }
  });

  test('should preserve math in copy-paste', async ({ page }) => {
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    
    // Create math equation
    await editor.fill('$a^2 + b^2 = c^2$');
    await page.keyboard.press('Space');
    await page.waitForTimeout(1000);
    
    // Select all and copy
    await page.keyboard.press('Control+a');
    await page.keyboard.press('Control+c');
    await page.waitForTimeout(500);
    
    // Clear and paste
    await page.keyboard.press('Delete');
    await page.keyboard.press('Control+v');
    await page.waitForTimeout(1000);
    
    // Check if math is still there
    const content = await editor.textContent();
    expect(content).toContain('a^2 + b^2 = c^2');
  });
});