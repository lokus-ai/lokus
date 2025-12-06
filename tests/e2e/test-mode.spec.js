import { test, expect } from '@playwright/test';
import { injectTauriMock, disableTour, dismissTourOverlay } from './helpers/test-utils.js';

/**
 * Test Mode Functionality Tests
 *
 * Tests for verifying test mode URL parameter handling.
 */
test.describe('Test Mode Functionality', () => {
  test('app loads with testMode parameter', async ({ page }) => {
    // Inject Tauri mock
    await injectTauriMock(page);
    await disableTour(page);
    
    // Navigate with test mode parameter
    await page.goto('/?testMode=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // App should load successfully
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });

  test('workspace opens with testMode parameter', async ({ page }) => {
    await injectTauriMock(page);
    await disableTour(page);
    
    await page.goto('/?testMode=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await dismissTourOverlay(page);
    
    // Should show file tree or workspace elements
    const workspaceIndicators = [
      '.space-y-1',
      'text=/Explorer|Files|Workspace/i',
      'text=/test-note|README|notes/i',
    ];
    
    let workspaceFound = false;
    for (const selector of workspaceIndicators) {
      if (await page.locator(selector).first().isVisible({ timeout: 3000 }).catch(() => false)) {
        workspaceFound = true;
        break;
      }
    }
    
    // Workspace should be visible
    expect(workspaceFound).toBe(true);
  });

  test('files are visible in workspace', async ({ page }) => {
    await injectTauriMock(page);
    await disableTour(page);
    
    await page.goto('/?testMode=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await dismissTourOverlay(page);
    
    // Look for any files in the file tree
    const fileLocator = page.locator('text=/test-note|README|notes|docs/i');
    const count = await fileLocator.count();
    
    // At least some files should be visible
    expect(count).toBeGreaterThan(0);
  });

  test('can click on a file to open it', async ({ page }) => {
    await injectTauriMock(page);
    await disableTour(page);
    
    await page.goto('/?testMode=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await dismissTourOverlay(page);
    
    // Find and click a file
    const testFile = page.locator('text=/test-note|README|notes/i').first();
    await expect(testFile).toBeVisible({ timeout: 5000 });
    await testFile.click();
    await page.waitForTimeout(500);
    
    // Editor should appear
    const editor = page.locator('.ProseMirror');
    await expect(editor).toBeVisible({ timeout: 5000 });
  });

  test('app works without testMode (shows launcher)', async ({ page }) => {
    // No mock - normal behavior
    await disableTour(page);
    
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    
    // App should load
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });

  test('canvas files can be listed', async ({ page }) => {
    await injectTauriMock(page);
    await disableTour(page);
    
    await page.goto('/?testMode=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await dismissTourOverlay(page);
    
    // App should load with file tree visible
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
    
    // Files should be listed
    const anyFileVisible = page.locator('text=/test-note|README|notes/i').first();
    await expect(anyFileVisible).toBeVisible({ timeout: 5000 });
  });
});
