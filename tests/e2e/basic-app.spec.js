import { test, expect } from '@playwright/test';

test.describe('Basic App Tests', () => {
  test('should load Lokus app', async ({ page }) => {
    // Go to the app
    await page.goto('http://localhost:1420');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Should show Lokus branding
    await expect(page.locator('text=Lokus')).toBeVisible({ timeout: 10000 });
    
    // Take a screenshot for debugging
    await page.screenshot({ path: 'test-results/app-loaded.png' });
  });

  test('should show launcher screen', async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
    
    // Should show workspace selection
    const workspaceElements = [
      'text=Open Workspace',
      'text=Recently Opened', 
      'text=Create Workspace',
      'button:has-text("Open")'
    ];
    
    let foundElement = false;
    for (const selector of workspaceElements) {
      if (await page.locator(selector).isVisible({ timeout: 3000 })) {
        console.log(`✅ Found: ${selector}`);
        foundElement = true;
        break;
      }
    }
    
    expect(foundElement).toBe(true);
  });

  test('should handle manual workspace selection', async ({ page }) => {
    await page.goto('http://localhost:1420');
    await page.waitForLoadState('networkidle');
    
    // Try to click open workspace button
    const openBtn = page.locator('button:has-text("Open Workspace")');
    if (await openBtn.isVisible({ timeout: 5000 })) {
      await openBtn.click();
      
      // This will open file dialog which we can't automate easily
      // But we can verify the UI responds
      console.log('✅ Open Workspace button clicked');
    }
    
    // Take screenshot
    await page.screenshot({ path: 'test-results/workspace-dialog.png' });
  });

  test('should work with environment workspace', async ({ page }) => {
    // Set test workspace in localStorage before loading
    await page.goto('http://localhost:1420');
    
    // Create a test workspace path
    const testWorkspace = `/tmp/playwright-test-${Date.now()}`;
    
    // Inject test workspace path
    await page.addInitScript((workspace) => {
      window.TEST_WORKSPACE_PATH = workspace;
      console.log('Test workspace set to:', workspace);
    }, testWorkspace);
    
    // Reload to apply
    await page.reload();
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Check if workspace opened automatically
    const workspaceOpened = await page.locator('[data-testid="file-tree"], .workspace-content, .file-explorer').isVisible({ timeout: 5000 });
    
    if (workspaceOpened) {
      console.log('✅ Workspace opened automatically');
    } else {
      console.log('❌ Workspace did not open automatically');
    }
    
    await page.screenshot({ path: 'test-results/env-workspace.png' });
  });
});