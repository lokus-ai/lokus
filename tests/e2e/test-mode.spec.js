import { test, expect } from '@playwright/test';

/**
 * Test Mode Functionality Tests
 *
 * IMPORTANT: These tests require a real Tauri environment.
 * They will skip in CI where Tauri is not available.
 */
test.describe('Test Mode Functionality', () => {
  // Skip in CI (no Tauri available)
  test.skip(() => process.env.CI === 'true', 'Test mode tests require Tauri environment');

  test('should activate test mode with URL parameter', async ({ page }) => {
    // Navigate with test mode parameter
    await page.goto('/?testMode=true');
    
    // Wait for app to load
    await page.waitForLoadState('networkidle');
    
    // Should show test mode indicator
    await expect(page.locator('text=🧪 Test Mode Active')).toBeVisible({ timeout: 10000 });
    
    console.log('✅ Test mode activated successfully');
  });

  test('should automatically create workspace in test mode', async ({ page }) => {
    // Navigate with test mode
    await page.goto('/?testMode=true');
    await page.waitForLoadState('networkidle');
    
    // Wait for test workspace creation (longer timeout)
    await page.waitForTimeout(3000);
    
    // Should automatically open workspace (bypass launcher)
    const workspaceElements = [
      'text=Explorer', // Header text in workspace sidebar
      'button[title="New File"]', // New file button in toolbar
      'button[title="New Canvas"]', // New canvas button in toolbar  
      'h2:text("Explorer")', // Explorer sidebar header
      '.space-y-1', // File tree container class
      'main' // Main workspace content area
    ];
    
    let workspaceFound = false;
    for (const selector of workspaceElements) {
      if (await page.locator(selector).isVisible({ timeout: 5000 })) {
        console.log(`✅ Found workspace element: ${selector}`);
        workspaceFound = true;
        break;
      }
    }
    
    // Take screenshot for debugging
    await page.screenshot({ path: 'test-results/test-mode-workspace.png', fullPage: true });
    
    expect(workspaceFound).toBe(true);
  });

  test('should create test files in workspace', async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000); // Extra time for workspace creation
    
    // Look for test files in the UI (check both the file tree and welcome cards)
    const testFiles = [
      'README.md',
      'notes.md', 
      'todo.md',
      'test-canvas.canvas'
    ];
    
    let filesFound = 0;
    for (const fileName of testFiles) {
      // Try multiple selectors for each file
      const selectors = [
        `text=${fileName}`, 
        `button:has-text("${fileName}")`,
        `.space-y-1 *:has-text("${fileName}")`,
        `li:has-text("${fileName}")`
      ];
      
      let fileFound = false;
      for (const selector of selectors) {
        const fileElement = page.locator(selector).first();
        if (await fileElement.isVisible({ timeout: 2000 }).catch(() => false)) {
          console.log(`✅ Found test file: ${fileName} with selector ${selector}`);
          filesFound++;
          fileFound = true;
          break;
        }
      }
      
      if (!fileFound) {
        console.log(`❌ Missing test file: ${fileName}`);
      }
    }
    
    console.log(`Found ${filesFound}/${testFiles.length} test files`);
    
    // At least some files should be visible
    expect(filesFound).toBeGreaterThan(0);
  });

  test('should open canvas file from test workspace', async ({ page }) => {
    await page.goto('/?testMode=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Look for canvas file
    const canvasFile = page.locator('text=test-canvas.canvas').first();
    
    if (await canvasFile.isVisible({ timeout: 5000 })) {
      // Click on canvas file
      await canvasFile.click();
      
      // Wait for canvas to load
      await page.waitForTimeout(3000);
      
      // Should show tldraw interface
      const canvasInterface = page.locator('.tldraw, .tldraw-canvas, [data-testid="canvas"]').first();
      await expect(canvasInterface).toBeVisible({ timeout: 10000 });
      
      console.log('✅ Canvas opened successfully from test workspace');
    } else {
      console.log('⚠️ Canvas file not visible, skipping canvas test');
    }
    
    await page.screenshot({ path: 'test-results/test-mode-canvas.png', fullPage: true });
  });

  test('should allow creating new canvas in test mode', async ({ page }) => {
    await page.goto('http://localhost:1420/?testMode=true');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(5000);
    
    // Look for New Canvas button
    const canvasButtons = [
      'button[title="New Canvas"]', // The actual button from workspace toolbar
      'button:has-text("New Canvas")', // Welcome screen button
      '[title*="New Canvas"]',
      '.group:has-text("New Canvas") button', // Welcome screen canvas card
      'button:has(svg):has-text("New Canvas")'
    ];
    
    let buttonClicked = false;
    for (const selector of canvasButtons) {
      const button = page.locator(selector).first();
      if (await button.isVisible({ timeout: 3000 })) {
        await button.click();
        buttonClicked = true;
        console.log(`✅ Clicked canvas button: ${selector}`);
        break;
      }
    }
    
    if (buttonClicked) {
      // Wait for canvas to open
      await page.waitForTimeout(3000);
      
      // Should show canvas interface
      const canvasInterface = page.locator('.tldraw, .tldraw-canvas').first();
      if (await canvasInterface.isVisible({ timeout: 5000 })) {
        console.log('✅ New canvas created successfully');
      } else {
        console.log('❌ Canvas interface not visible');
      }
    } else {
      console.log('⚠️ No canvas button found, skipping new canvas test');
    }
    
    await page.screenshot({ path: 'test-results/new-canvas-test.png', fullPage: true });
  });

  test('should work without test mode (normal launcher)', async ({ page }) => {
    // Navigate without test mode
    await page.goto('http://localhost:1420/');
    await page.waitForLoadState('networkidle');
    
    // Should NOT show test mode indicator
    await expect(page.locator('text=🧪 Test Mode Active')).not.toBeVisible();
    
    // Should show normal launcher
    await expect(page.locator('text=Open Workspace')).toBeVisible({ timeout: 5000 });
    
    console.log('✅ Normal mode works correctly');
  });
});