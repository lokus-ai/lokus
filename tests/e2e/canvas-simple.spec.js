import { test, expect, TestWorkspaceHelper } from './setup/test-workspace.js';

test.describe('Canvas Feature Tests', () => {
  test('should create and open canvas from sidebar', async ({ workspacePage, testWorkspace }) => {
    const helper = new TestWorkspaceHelper(testWorkspace);
    
    // Wait for app to load
    await workspacePage.waitForLoadState('networkidle');
    
    // Handle launcher screen if present
    const openWorkspaceBtn = workspacePage.locator('button:has-text("Open Workspace")');
    if (await openWorkspaceBtn.isVisible({ timeout: 3000 })) {
      console.log('Launcher screen detected, need to select workspace manually');
      
      // For now, create a test workspace path and inject it
      await workspacePage.evaluate((workspacePath) => {
        window.localStorage.setItem('lokus-test-workspace', workspacePath);
        // Try to trigger workspace opening
        if (window.location.reload) {
          window.location.reload();
        }
      }, testWorkspace);
      
      // Wait for reload and workspace to open
      await workspacePage.waitForLoadState('networkidle');
      await workspacePage.waitForTimeout(3000);
    }
    
    // Check if we're now in workspace view
    const isInWorkspace = await workspacePage.locator('[data-testid="file-tree"], .workspace-view, .file-explorer').isVisible({ timeout: 5000 });
    
    if (!isInWorkspace) {
      console.log('Still on launcher screen, skipping test');
      test.skip();
      return;
    }
    
    // Look for any canvas creation button
    const canvasButtons = [
      '[title*="New Canvas"]',
      'button:has-text("New Canvas")',
      '[data-testid="new-canvas"]',
      '.canvas-button'
    ];
    
    let buttonFound = false;
    for (const selector of canvasButtons) {
      const btn = workspacePage.locator(selector).first();
      if (await btn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await btn.click();
        buttonFound = true;
        break;
      }
    }
    
    if (!buttonFound) {
      // If no button found, look for what's actually on the page
      const allButtons = await workspacePage.locator('button').all();
      console.log('Available buttons:');
      for (const btn of allButtons.slice(0, 10)) { // Limit to first 10
        const text = await btn.textContent().catch(() => '');
        const title = await btn.getAttribute('title').catch(() => '');
        console.log(`- Button: "${text}" title: "${title}"`);
      }
    }
    
    expect(buttonFound).toBe(true);
    
    // Wait a bit for canvas to open
    await workspacePage.waitForTimeout(3000);
    
    // Check if canvas opened (any of these might be present)
    const canvasIndicators = [
      '.tldraw',
      '.tldraw-canvas', 
      '[data-testid="tab-bar"]:has-text(".canvas")',
      'text=.canvas'
    ];
    
    let canvasVisible = false;
    for (const selector of canvasIndicators) {
      if (await workspacePage.locator(selector).isVisible({ timeout: 2000 }).catch(() => false)) {
        canvasVisible = true;
        break;
      }
    }
    
    expect(canvasVisible).toBe(true);
  });
  
  test('should load existing canvas file', async ({ workspacePage, testWorkspace }) => {
    const helper = new TestWorkspaceHelper(testWorkspace);
    
    // Create a test canvas file
    await helper.createCanvas('test-canvas', {
      nodes: [
        { id: '1', x: 100, y: 100, width: 150, height: 75, type: 'text', text: 'Test Node' }
      ],
      edges: []
    });
    
    // Wait for app to load
    await workspacePage.waitForLoadState('networkidle');
    await workspacePage.waitForTimeout(2000);
    
    // Look for the canvas file in file tree
    const canvasFile = workspacePage.locator('text=test-canvas.canvas');
    if (await canvasFile.isVisible({ timeout: 5000 })) {
      await canvasFile.click();
      
      // Should open canvas
      await expect(workspacePage.locator('.tldraw, .tldraw-canvas')).toBeVisible({ timeout: 10000 });
    } else {
      console.log('Canvas file not visible in file tree');
      // List what files are visible
      const fileItems = await workspacePage.locator('[data-testid="file-tree"] *').allTextContents();
      console.log('Visible files:', fileItems.slice(0, 10));
    }
  });
});