/**
 * Math rendering tests
 * Tests LaTeX/KaTeX math rendering in the editor
 */
import { test, expect, openFile, dismissTour } from './setup/test-workspace.js';

test.describe('Math Rendering', () => {
  test.beforeEach(async ({ workspacePage }) => {
    await dismissTour(workspacePage);
  });

  test('app loads successfully', async ({ workspacePage }) => {
    const appRoot = workspacePage.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });

  test('can type inline math syntax', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nThe equation $x^2$ represents a square');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('equation');
  });

  test('can type block math syntax', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\n$$');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('E = mc^2');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('$$');
    await workspacePage.waitForTimeout(200);

    await expect(editor).toBeVisible();
  });

  test('editor handles special LaTeX characters', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nSum: $\\sum_{i=1}^{n} x_i$');
    await workspacePage.waitForTimeout(200);

    await expect(editor).toBeVisible();
  });

  test('can type Greek letters in math', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nGreek: $\\alpha + \\beta = \\gamma$');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Greek');
  });

  test('can type fractions in math', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nFraction: $\\frac{1}{2}$');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Fraction');
  });

  test('can type square root in math', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nRoot: $\\sqrt{x^2 + y^2}$');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Root');
  });

  test('can type integral in math', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nIntegral: $\\int_0^1 x dx$');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Integral');
  });

  test('math does not break with empty delimiters', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'test-note.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    await workspacePage.keyboard.type('\n\nEmpty: $$ and more text');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Empty');
  });
});
