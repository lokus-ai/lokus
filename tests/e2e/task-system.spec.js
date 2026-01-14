/**
 * Task system tests
 * Tests checkbox/task functionality in the editor
 */
import { test, expect, openFile, dismissTour } from './setup/test-workspace.js';

test.describe('Task System', () => {
  test.beforeEach(async ({ workspacePage }) => {
    await dismissTour(workspacePage);
  });

  test('app loads successfully', async ({ workspacePage }) => {
    const appRoot = workspacePage.locator('#root');
    await expect(appRoot).toBeVisible({ timeout: 10000 });
  });

  test('can type task syntax in editor', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'daily-notes.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    // Type task/checkbox syntax
    await workspacePage.keyboard.type('\n\n- [ ] This is a task');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- [x] This task is complete');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('This is a task');
  });

  test('can create multiple tasks', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'daily-notes.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    // Type multiple tasks
    await workspacePage.keyboard.type('\n\n## Task List');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- [ ] First task');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- [ ] Second task');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- [ ] Third task');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('First task');
    expect(content).toContain('Second task');
  });

  test('tasks persist in editor content', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'daily-notes.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    // Type a task
    await workspacePage.keyboard.type('\n\n- [ ] Remember to test');
    await workspacePage.waitForTimeout(300);

    const content = await editor.textContent();
    expect(content).toContain('Remember to test');
  });

  test('can create nested task list', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'daily-notes.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    // Type nested tasks
    await workspacePage.keyboard.type('\n\n- [ ] Main task');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.press('Tab');
    await workspacePage.keyboard.type('- [ ] Subtask 1');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- [ ] Subtask 2');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Main task');
  });

  test('can mix tasks with regular list items', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'daily-notes.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    // Type mixed list
    await workspacePage.keyboard.type('\n\nShopping list:');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- [ ] Buy groceries');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- Milk');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- Bread');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Shopping');
  });

  test('task with description text', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'daily-notes.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    // Type task with detailed description
    await workspacePage.keyboard.type('\n\n- [ ] Complete project documentation');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('  This includes API docs and user guide');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('documentation');
  });

  test('can create task list under heading', async ({ workspacePage }) => {
    const editor = await openFile(workspacePage, 'daily-notes.md');
    await editor.click();
    await workspacePage.keyboard.press('End');

    // Type heading followed by tasks
    await workspacePage.keyboard.type('\n\n## Today\'s Tasks');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- [ ] Morning standup');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- [ ] Code review');
    await workspacePage.keyboard.press('Enter');
    await workspacePage.keyboard.type('- [ ] Deploy to staging');
    await workspacePage.waitForTimeout(200);

    const content = await editor.textContent();
    expect(content).toContain('Today');
  });
});
