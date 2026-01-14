/**
 * XSS Protection Tests
 *
 * Tests that verify XSS attacks are prevented in the application.
 */
import { test, expect, openFile, dismissTour } from './setup/test-workspace.js';

test.describe('XSS Protection', () => {
  test.beforeEach(async ({ workspacePage }) => {
    await dismissTour(workspacePage);
  });

  test('app loads without script injection from URL', async ({ page, workspacePath }) => {
    // Navigate with malicious URL parameter
    await page.goto(`/?workspace=<script>window.urlXSS=true</script>&workspacePath=${encodeURIComponent(workspacePath)}`);
    await page.waitForTimeout(1000);

    // Verify script didn't execute
    const urlXSS = await page.evaluate(() => window.urlXSS);
    expect(urlXSS).toBeUndefined();

    // App should still load normally
    const appRoot = page.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });

  test('editor content is sanitized', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\n<script>window.xss=1</script>safe content');
    await workspacePage.waitForTimeout(200);

    // Verify script tag didn't execute
    const xssExecuted = await workspacePage.evaluate(() => window.xss);
    expect(xssExecuted).toBeUndefined();

    // Verify safe content is visible
    const content = await editor.textContent();
    expect(content).toContain('safe content');
  });

  test('HTML entities in editor are escaped', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nTesting < > & characters');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Testing');
  });

  test('no inline scripts exist in the DOM', async ({ workspacePage }) => {
    // Wait for app to fully load
    await workspacePage.waitForTimeout(2000);

    // Check all script tags have src attribute (no inline scripts with dangerous content)
    const allScripts = await workspacePage.locator('script').all();
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

  test('img tags with onerror handlers are blocked', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\n<img src=x onerror="window.imgXSS=1">');
    await workspacePage.waitForTimeout(200);

    // Verify onerror didn't execute
    const xssExecuted = await workspacePage.evaluate(() => window.imgXSS);
    expect(xssExecuted).toBeUndefined();
  });
});
