/**
 * Markdown paste tests
 * Tests pasting content with markdown formatting
 */
import { test, expect, getEditor, openFile, dismissTour } from './setup/test-workspace.js';

test.describe('Markdown Paste', () => {
  test.beforeEach(async ({ workspacePage }) => {
    await dismissTour(workspacePage);
  });

  test('app loads successfully', async ({ workspacePage }) => {
    const appRoot = workspacePage.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });

  test('can type bold markdown syntax', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nThis is **bold** text');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('bold');
  });

  test('can type italic markdown syntax', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nThis is *italic* text');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('italic');
  });

  test('can type mixed markdown formatting', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\n# Heading with **bold** and *italic*');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Heading');
  });

  test('can type strikethrough markdown syntax', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nThis is ~~deleted~~ text');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('deleted');
  });

  test('can type inline code markdown syntax', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nUse `console.log()` for debugging');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('console');
  });

  test('can type link markdown syntax', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nVisit [Google](https://google.com) for search');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Google');
  });

  test('can type blockquote markdown syntax', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\n> This is a quote');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('> from someone famous');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('quote');
  });

  test('can type horizontal rule markdown syntax', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nAbove the line');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('---');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('Below the line');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('line');
  });

  test('can type numbered list markdown syntax', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\n1. First item');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('2. Second item');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('3. Third item');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('First');
  });
});
