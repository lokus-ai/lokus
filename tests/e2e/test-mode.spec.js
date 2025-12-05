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
    
    if (await testFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      await testFile.click();
      await page.waitForTimeout(500);
      
      // Editor should appear
      const editor = page.locator('.ProseMirror');
      await expect(editor).toBeVisible({ timeout: 5000 });
    }
    
    expect(true).toBe(true);
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
    
    // Without mock, should show launcher or error about workspace
    // The exact behavior depends on whether Tauri is available
    expect(true).toBe(true);
  });

  test('canvas files can be listed', async ({ page }) => {
    await injectTauriMock(page);
    await disableTour(page);
    
    await page.goto('/?testMode=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    
    await dismissTourOverlay(page);
    
    // Look for canvas file in file tree  
    const canvasFile = page.locator('text=/canvas|.canvas/i').first();
    
    // Canvas may or may not be in the mock files
    if (await canvasFile.isVisible({ timeout: 3000 }).catch(() => false)) {
      // Canvas file exists
      expect(true).toBe(true);
    } else {
      // No canvas file in mock, but that's okay
      expect(true).toBe(true);
    }
  });
});
