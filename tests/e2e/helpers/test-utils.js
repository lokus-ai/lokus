import { expect } from '@playwright/test';

/**
 * Helper functions for E2E tests
 */

export async function waitForEditorLoad(page) {
  await page.waitForSelector('.ProseMirror, .tiptap-area', { timeout: 10000 });
  await page.waitForTimeout(500); // Additional wait for editor to be ready
}

export async function getEditor(page) {
  return page.locator('.ProseMirror').first();
}

export async function typeInEditor(page, text) {
  const editor = await getEditor(page);
  await editor.click();
  await editor.fill(text);
  return editor;
}

export async function useSlashCommand(page, command) {
  const editor = await getEditor(page);
  await editor.click();
  await editor.type(`/${command}`);
  await page.waitForTimeout(500);
  
  const commandMenu = page.locator('.slash-command-list, .command-menu, [data-testid="slash-menu"]');
  if (await commandMenu.count() > 0) {
    await page.keyboard.press('Enter');
    return true;
  }
  return false;
}

export async function navigateToPreferences(page) {
  const preferencesButton = page.locator(
    '[data-testid="preferences"], ' +
    'button:has-text("Preferences"), ' +
    '.preferences-button, ' +
    '[aria-label="Preferences"]'
  );
  
  if (await preferencesButton.count() > 0) {
    await preferencesButton.first().click();
    await page.waitForTimeout(1000);
    return true;
  }
  
  // Try keyboard shortcut
  await page.keyboard.press('Control+,');
  await page.waitForTimeout(1000);
  return false;
}

export async function selectPreferencesSection(page, section) {
  const sectionButton = page.locator(`button:has-text("${section}")`);
  if (await sectionButton.count() > 0) {
    await sectionButton.click();
    await page.waitForTimeout(500);
    return true;
  }
  return false;
}

export async function expectMathRendering(page, mathText) {
  const editor = await getEditor(page);
  
  // Check for math-specific elements
  const mathElements = editor.locator('.math-inline, .math-block, [data-type="math-inline"], [data-type="math-block"]');
  
  if (await mathElements.count() > 0) {
    await expect(mathElements.first()).toBeVisible();
    return true;
  }
  
  // Fallback: check content
  const content = await editor.textContent();
  expect(content).toContain(mathText);
  return false;
}

export async function expectWikiLink(page, linkText) {
  const editor = await getEditor(page);
  const wikiLink = editor.locator('[data-type="wiki-link"], .wiki-link');
  
  if (await wikiLink.count() > 0) {
    await expect(wikiLink).toContainText(linkText);
    return true;
  }
  return false;
}

export async function createTestFile(page, filename = 'test-file') {
  // Try to create a new file
  const newFileButton = page.locator(
    'button:has-text("New"), ' +
    'button:has-text("Create"), ' +
    '[data-testid="new-file"]'
  );
  
  if (await newFileButton.count() > 0) {
    await newFileButton.first().click();
    await page.waitForTimeout(1000);
    return true;
  }
  
  // Try keyboard shortcut
  await page.keyboard.press('Control+n');
  await page.waitForTimeout(1000);
  return false;
}

export async function saveFile(page) {
  await page.keyboard.press('Control+s');
  await page.waitForTimeout(1000);
}

export async function dismissDialog(page) {
  // Handle any dialogs that might appear
  page.on('dialog', async dialog => {
    await dialog.dismiss();
  });
}

export async function acceptPrompt(page, text) {
  page.on('dialog', async dialog => {
    if (dialog.type() === 'prompt') {
      await dialog.accept(text);
    }
  });
}

// Task System Helper Functions
export async function createTask(page, taskText, taskType = 'urgent') {
  const editor = await getEditor(page);
  await editor.click();
  
  // Trigger task creation
  await editor.type('!task ');
  await page.waitForTimeout(1000);
  
  // Wait for widget to appear
  const widget = page.locator('.task-input-widget');
  await expect(widget).toBeVisible();
  
  // Cycle to desired task type if not urgent
  const typeMap = { urgent: 0, question: 1, progress: 2, todo: 3 };
  const tabCount = typeMap[taskType] || 0;
  
  for (let i = 0; i < tabCount; i++) {
    await page.keyboard.press('Tab');
    await page.waitForTimeout(200);
  }
  
  // Fill and submit task
  const taskInput = page.locator('.task-input-widget input');
  await taskInput.fill(taskText);
  await taskInput.press('Enter');
  await page.waitForTimeout(2000);
  
  return page.locator('[data-task-text="true"]').last();
}

export async function importTask(page, searchQuery = '') {
  const editor = await getEditor(page);
  await editor.click();
  
  // Trigger task import
  await editor.type('@task ');
  await page.waitForTimeout(1500);
  
  // Wait for import widget
  const widget = page.locator('.task-import-widget');
  await expect(widget).toBeVisible();
  
  // Search if query provided
  if (searchQuery) {
    const searchInput = page.locator('.task-import-widget input[placeholder*="search"]');
    await searchInput.fill(searchQuery);
    await page.waitForTimeout(500);
  }
  
  // Select first task
  const taskItems = page.locator('.task-import-item');
  if (await taskItems.count() > 0) {
    await taskItems.first().click();
    await page.waitForTimeout(1500);
    return page.locator('[data-task-text="true"]').last();
  }
  
  // Or use Enter key
  const searchInput = page.locator('.task-import-widget input[placeholder*="search"]');
  await searchInput.press('Enter');
  await page.waitForTimeout(1500);
  
  return page.locator('[data-task-text="true"]').last();
}

export async function clickTaskElement(page, taskSelector = '[data-task-text="true"]') {
  const taskElement = page.locator(taskSelector);
  await expect(taskElement).toBeVisible();
  await taskElement.click();
  await page.waitForTimeout(1000);
  return taskElement;
}

export async function expectTaskInKanban(page, taskText) {
  // Check if kanban is visible
  const kanbanVisible = await page.locator('.kanban-board, .full-kanban, [data-file="__kanban__"]').count() > 0;
  expect(kanbanVisible).toBeTruthy();
  
  // Look for task in kanban
  const kanbanTask = page.locator('.task-card, .kanban-card, [data-task-id]').filter({ hasText: taskText });
  if (await kanbanTask.count() > 0) {
    await expect(kanbanTask.first()).toBeVisible();
    return true;
  }
  
  return false;
}

export async function expectTaskWithStatus(page, taskText, expectedEmoji) {
  const taskElement = page.locator('[data-task-text="true"]').filter({ hasText: taskText });
  await expect(taskElement).toBeVisible();
  await expect(taskElement).toContainText(expectedEmoji);
  return taskElement;
}

export async function navigateToKanban(page) {
  const kanbanTab = page.locator('[data-file="__kanban__"]');
  if (await kanbanTab.count() > 0) {
    await kanbanTab.click();
    await page.waitForTimeout(1000);
    return true;
  }
  
  // Try alternative selectors
  const kanbanButton = page.locator('button:has-text("kanban"), button:has-text("Kanban"), [aria-label*="kanban"]');
  if (await kanbanButton.count() > 0) {
    await kanbanButton.first().click();
    await page.waitForTimeout(1000);
    return true;
  }
  
  return false;
}

export async function getTaskElements(page) {
  return page.locator('[data-task-text="true"]');
}

export async function expectWidgetClosed(page, widgetSelector) {
  const widget = page.locator(widgetSelector);
  await expect(widget).not.toBeVisible();
}

export async function expectWidgetOpen(page, widgetSelector) {
  const widget = page.locator(widgetSelector);
  await expect(widget).toBeVisible();
}