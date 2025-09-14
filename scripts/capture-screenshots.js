import { chromium } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function captureFeatureScreenshots() {
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ 
    viewport: { width: 1200, height: 800 }
  });
  const page = await context.newPage();
  
  // Create screenshots directory
  const screenshotsDir = path.join(__dirname, '../docs-screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {
    // Navigate to the app
    await page.goto('http://localhost:1420');
    await page.waitForTimeout(3000); // Wait for app to load

    console.log('📸 Starting screenshot capture...');

    // 1. Main Interface Overview
    console.log('Capturing: Main Interface');
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'main-interface.png'),
      fullPage: false 
    });

    // 2. Command Palette
    console.log('Capturing: Command Palette');
    await page.keyboard.press('Meta+k'); // ⌘K
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'command-palette.png') 
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 3. Create a sample note for editor features
    console.log('Creating sample note...');
    await page.keyboard.press('Meta+n'); // New file
    await page.waitForTimeout(1000);
    
    // Add sample content
    const sampleContent = `# Welcome to Lokus

This is a **sample note** demonstrating various features.

## Rich Text Features
- **Bold text**
- *Italic text* 
- ~~Strikethrough~~
- ==Highlighted text==

## Math Support
Here's an inline equation: $E = mc^2$

And a block equation:
$$\\sum_{i=1}^{n} x_i = \\frac{n(n+1)}{2}$$

## Task Management
Let me create some tasks:`;

    const titleInput = page.locator('input[class*="text-4xl"]');
    await titleInput.fill('Feature Demo');
    
    // Get editor and add content
    await page.waitForTimeout(1000);
    const editor = page.locator('.ProseMirror').first();
    await editor.click();
    await editor.fill(sampleContent);
    await page.waitForTimeout(2000);

    // 4. Rich Text Editor
    console.log('Capturing: Rich Text Editor');
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'rich-text-editor.png') 
    });

    // 5. Task Creation Widget
    console.log('Capturing: Task Creation Widget');
    await editor.click();
    await page.keyboard.press('End'); // Go to end
    await page.keyboard.press('Enter'); // New line
    await page.type('!task '); // Trigger task widget
    await page.waitForTimeout(1500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'task-creation-widget.png') 
    });
    
    // Create a task
    const taskInput = page.locator('.task-input-widget input').first();
    await taskInput.fill('Review documentation');
    await page.keyboard.press('Tab'); // Cycle to Question type
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'task-types-cycling.png') 
    });
    await taskInput.press('Enter');
    await page.waitForTimeout(2000);

    // 6. Task Import Widget
    console.log('Capturing: Task Import Widget');
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.press('Enter');
    await page.type('@task '); // Trigger import widget
    await page.waitForTimeout(1500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'task-import-widget.png') 
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 7. Tasks in Editor
    console.log('Capturing: Interactive Tasks');
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'interactive-tasks.png') 
    });

    // 8. Sidebar and File Management
    console.log('Capturing: File Management');
    // Make sure sidebar is visible
    const sidebarButton = page.locator('button[title*="sidebar"]').first();
    await sidebarButton.click();
    await page.waitForTimeout(500);
    await sidebarButton.click(); // Make sure it's shown
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'file-management.png') 
    });

    // 9. Kanban Mini View
    console.log('Capturing: Mini Kanban');
    const tasksTab = page.locator('button:has-text("Tasks")');
    if (await tasksTab.count() > 0) {
      await tasksTab.click();
      await page.waitForTimeout(1500);
      await page.screenshot({ 
        path: path.join(screenshotsDir, 'mini-kanban.png') 
      });
    }

    // 10. Full Kanban Board
    console.log('Capturing: Full Kanban Board');
    const openFullKanban = page.locator('button:has-text("Open Full Kanban")');
    if (await openFullKanban.count() > 0) {
      await openFullKanban.click();
      await page.waitForTimeout(2000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, 'full-kanban-board.png'),
        fullPage: false 
      });
    }

    // 11. Context Menu
    console.log('Capturing: Context Menu');
    // Go back to editor
    const filesTab = page.locator('button:has-text("Files")');
    if (await filesTab.count() > 0) {
      await filesTab.click();
      await page.waitForTimeout(500);
    }
    
    // Right click in editor to show context menu
    await editor.click();
    await editor.click({ button: 'right' });
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'context-menu.png') 
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 12. Math Rendering
    console.log('Capturing: Math Rendering');
    // Scroll to show math
    await editor.click();
    await page.keyboard.press('Meta+f'); // Find
    await page.waitForTimeout(500);
    await page.type('Math Support');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'math-rendering.png') 
    });

    // 13. Extensions/Plugins View (if available)
    console.log('Capturing: Extensions View');
    const extensionsButton = page.locator('button[title*="extensions"]');
    if (await extensionsButton.count() > 0) {
      await extensionsButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({ 
        path: path.join(screenshotsDir, 'extensions-view.png') 
      });
    }

    // 14. Search Panel
    console.log('Capturing: Global Search');
    await page.keyboard.press('Meta+Shift+f'); // Global search
    await page.waitForTimeout(1000);
    if (await page.locator('.search-panel, [data-testid="search-panel"]').count() > 0) {
      await page.screenshot({ 
        path: path.join(screenshotsDir, 'global-search.png') 
      });
      await page.keyboard.press('Escape');
    }

    // 15. In-File Search
    console.log('Capturing: In-File Search');
    await page.keyboard.press('Meta+f'); // In-file search
    await page.waitForTimeout(1000);
    await page.type('task');
    await page.waitForTimeout(500);
    await page.screenshot({ 
      path: path.join(screenshotsDir, 'in-file-search.png') 
    });
    await page.keyboard.press('Escape');

    console.log('✅ Screenshot capture completed!');
    console.log(`📁 Screenshots saved to: ${screenshotsDir}`);
    
  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

// Run the screenshot capture
captureFeatureScreenshots();