import { chromium } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let appProcess = null;

async function startApp() {
  return new Promise((resolve, reject) => {
    appProcess = exec('npm run tauri dev', {
      cwd: path.join(__dirname, '..')
    });

    let resolved = false;
    const timeout = setTimeout(() => {
      if (!resolved) {
        resolved = true;
        resolve();
      }
    }, 15000); // Wait 15 seconds for app to start

    appProcess.stdout.on('data', (data) => {
      if (data.includes('localhost:1420') && !resolved) {
        resolved = true;
        clearTimeout(timeout);
        setTimeout(resolve, 3000); // Extra 3 seconds after detection
      }
    });

    appProcess.stderr.on('data', (data) => {
      console.error(data.toString());
    });
  });
}

async function stopApp() {
  if (appProcess) {
    appProcess.kill();
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
}

async function captureAllFeatures() {
  const browser = await chromium.launch({
    headless: false,
    slowMo: 100
  });

  const context = await browser.newContext({
    viewport: { width: 1400, height: 900 },
    extraHTTPHeaders: {
      'X-Test-Mode': 'true'
    }
  });

  const page = await context.newPage();

  // Create screenshots directory in docs
  const screenshotsDir = path.join(__dirname, '../../Lokus-docs/public/screenshots');
  if (!fs.existsSync(screenshotsDir)) {
    fs.mkdirSync(screenshotsDir, { recursive: true });
  }

  try {

    // Navigate to app
    await page.goto('http://localhost:1420');
    await page.waitForTimeout(5000);

    // Handle workspace launcher - use existing workspace

    // Look for "Open Existing Workspace" or recent workspace
    const openButton = page.locator('button:has-text("Open Existing")').or(
      page.locator('button:has-text("Open Workspace")')
    );

    if (await openButton.count() > 0) {
      await openButton.click();
      await page.waitForTimeout(2000);

      // Try to find and use the workspace path input
      const pathInput = page.locator('input[type="text"]').first();
      if (await pathInput.count() > 0) {
        // Use environment variable or default test workspace path
        const testWorkspacePath = process.env.TEST_WORKSPACE_PATH || './test-workspace';
        await pathInput.fill(testWorkspacePath);
        await page.waitForTimeout(1000);

        const confirmButton = page.locator('button:has-text("Open")').or(
          page.locator('button:has-text("Select")')
        );
        if (await confirmButton.count() > 0) {
          await confirmButton.click();
          await page.waitForTimeout(3000);
        }
      }
    } else {
      // Maybe workspace is in recent list - try clicking on it
      const recentWorkspace = page.locator('text=/My Knowledge/i').first();
      if (await recentWorkspace.count() > 0) {
        await recentWorkspace.click();
        await page.waitForTimeout(3000);
      }
    }

    // 1. MAIN INTERFACE
    await page.screenshot({
      path: path.join(screenshotsDir, '01-main-interface.png')
    });
    await page.waitForTimeout(1000);

    // 2. COMMAND PALETTE
    await page.keyboard.press('Meta+P');
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotsDir, '02-command-palette.png')
    });
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);

    // 3. CREATE SAMPLE NOTE
    await page.keyboard.press('Meta+N');
    await page.waitForTimeout(2000);

    const editor = page.locator('.ProseMirror').first();
    await editor.click();

    // 4. RICH TEXT EDITOR
    const sampleContent = `# Welcome to Lokus

This is a **sample note** with various **formatting** options.

## Text Formatting
- **Bold text**
- *Italic text*
- ~~Strikethrough~~
- ==Highlighted text==

## Math Support
Inline equation: $E = mc^2$

Block equation:
$$\\sum_{i=1}^{n} x_i = \\frac{n(n+1)}{2}$$

## Code Block
\`\`\`javascript
const greeting = "Hello, World!";
console.log(greeting);
\`\`\``;

    await editor.fill(sampleContent);
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(screenshotsDir, '03-editor-features.png')
    });

    // 5. WIKI LINKS
    await editor.click();
    await page.keyboard.press('End');
    await page.keyboard.type('\n\n## Wiki Links\n[[');
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotsDir, '04-wiki-links-autocomplete.png')
    });
    await page.keyboard.press('Escape');

    // 6. TASK MANAGEMENT
    await page.keyboard.type('\n\n## Tasks\n- [ ] Todo task\n- [x] Completed task\n- [>] In progress');
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(screenshotsDir, '05-task-lists.png')
    });

    // 7. FILE TREE / SIDEBAR
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: path.join(screenshotsDir, '06-file-tree.png')
    });

    // 8. SEARCH
    await page.keyboard.press('Meta+Shift+F');
    await page.waitForTimeout(1500);
    const searchInput = page.locator('input[placeholder*="Search"]').first();
    if (await searchInput.count() > 0) {
      await searchInput.fill('sample');
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: path.join(screenshotsDir, '07-search.png')
      });
      await page.keyboard.press('Escape');
    }

    // 9. PREFERENCES
    await page.keyboard.press('Meta+,');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(screenshotsDir, '08-preferences.png')
    });

    // Theme section
    const themeButton = page.locator('button:has-text("Appearance")');
    if (await themeButton.count() > 0) {
      await themeButton.click();
      await page.waitForTimeout(1500);
      await page.screenshot({
        path: path.join(screenshotsDir, '09-theme-settings.png')
      });
    }

    // Close preferences
    const closeButton = page.locator('button[aria-label*="Close"]').first();
    if (await closeButton.count() > 0) {
      await closeButton.click();
    } else {
      await page.keyboard.press('Escape');
    }
    await page.waitForTimeout(1000);

    // 10. GRAPH VIEW (if available)
    const graphButton = page.locator('button[title*="Graph"]').first();
    if (await graphButton.count() > 0) {
      await graphButton.click();
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(screenshotsDir, '10-graph-view.png')
      });
    }

    // 11. CANVAS (if available)
    const canvasButton = page.locator('button[title*="Canvas"]').first();
    if (await canvasButton.count() > 0) {
      await canvasButton.click();
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: path.join(screenshotsDir, '11-canvas.png')
      });
    }

    // 12. SPLIT VIEW
    // Try to trigger split view
    await page.keyboard.press('Meta+\\');
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(screenshotsDir, '12-split-view.png')
    });


  } catch (error) {
    console.error('❌ Error capturing screenshots:', error);
  } finally {
    await browser.close();
  }
}

async function main() {
  try {
    await startApp();
    await captureAllFeatures();
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await stopApp();
    process.exit(0);
  }
}

main();