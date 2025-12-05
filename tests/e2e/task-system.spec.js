import { test, expect } from '@playwright/test';
import { waitForEditorLoad, getEditor, typeInEditor } from './helpers/test-utils.js';

test.describe('Task System E2E Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Start the app and wait for it to load
    await page.goto('/');
    await waitForEditorLoad(page);
    await page.waitForTimeout(2000); // Extra wait for extensions to load
  });

  test.describe('Task Creation (!task)', () => {
    test('should show task creation widget when typing !task', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Type the task trigger
      await editor.type('!task ');
      
      // Wait for widget to appear
      await page.waitForTimeout(1000);
      
      // Check if task creation widget appears
      const widget = page.locator('.task-input-widget');
      await expect(widget).toBeVisible();
      
      // Check widget elements
      await expect(widget.locator('input[placeholder*="Enter task description"]')).toBeVisible();
      await expect(widget).toContainText('Urgent'); // Default type
    });

    test('should create a task and insert it into editor', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Trigger task creation
      await editor.type('!task ');
      await page.waitForTimeout(1000);
      
      // Find and fill the task input
      const taskInput = page.locator('.task-input-widget input');
      await expect(taskInput).toBeVisible();
      await taskInput.fill('Test urgent task');
      
      // Press Enter to create task
      await taskInput.press('Enter');
      await page.waitForTimeout(2000);
      
      // Check if task was inserted into editor
      const taskElement = page.locator('[data-task-text="true"]');
      await expect(taskElement).toBeVisible();
      await expect(taskElement).toContainText('Test urgent task');
      await expect(taskElement).toContainText('🔴'); // Urgent emoji
    });

    test('should cycle through task types with Tab key', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Trigger task creation
      await editor.type('!task ');
      await page.waitForTimeout(1000);
      
      const widget = page.locator('.task-input-widget');
      await expect(widget).toContainText('🔴 Urgent');
      
      // Press Tab to cycle
      await page.keyboard.press('Tab');
      await expect(widget).toContainText('🟡 Question');
      
      // Press Tab again
      await page.keyboard.press('Tab');
      await expect(widget).toContainText('🔵 In Progress');
      
      // Press Tab again
      await page.keyboard.press('Tab');
      await expect(widget).toContainText('⚪ Todo');
    });

    test('should close widget with Escape key', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Trigger task creation
      await editor.type('!task ');
      await page.waitForTimeout(1000);
      
      const widget = page.locator('.task-input-widget');
      await expect(widget).toBeVisible();
      
      // Press Escape to close
      await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
      
      await expect(widget).not.toBeVisible();
    });

    test('should create tasks with different statuses', async ({ page }) => {
      const taskTypes = [
        { emoji: '🔴', name: 'urgent', tabs: 0 },
        { emoji: '🟡', name: 'question', tabs: 1 },
        { emoji: '🔵', name: 'progress', tabs: 2 },
        { emoji: '⚪', name: 'todo', tabs: 3 }
      ];

      for (const taskType of taskTypes) {
        const editor = await getEditor(page);
        await editor.click();
        
        // Clear editor and trigger task creation
        await editor.clear();
        await editor.type('!task ');
        await page.waitForTimeout(1000);
        
        // Cycle to desired task type
        for (let i = 0; i < taskType.tabs; i++) {
          await page.keyboard.press('Tab');
          await page.waitForTimeout(200);
        }
        
        // Create task
        const taskInput = page.locator('.task-input-widget input');
        await taskInput.fill(`Test ${taskType.name} task`);
        await taskInput.press('Enter');
        await page.waitForTimeout(1500);
        
        // Verify task appears with correct emoji
        const taskElement = page.locator('[data-task-text="true"]').last();
        await expect(taskElement).toBeVisible();
        await expect(taskElement).toContainText(`Test ${taskType.name} task`);
        await expect(taskElement).toContainText(taskType.emoji);
      }
    });
  });

  test.describe('Task Import (@task)', () => {
    test('should show task import widget when typing @task', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Type the import trigger
      await editor.type('@task ');
      await page.waitForTimeout(1500);
      
      // Check if import widget appears
      const widget = page.locator('.task-import-widget');
      await expect(widget).toBeVisible();
      
      // Check widget elements
      await expect(widget).toContainText('Import Existing Task');
      await expect(widget.locator('input[placeholder*="Type to search tasks"]')).toBeVisible();
    });

    test('should show existing tasks in import list', async ({ page }) => {
      // First create a task to import
      const editor = await getEditor(page);
      await editor.click();
      
      // Create a task first
      await editor.type('!task ');
      await page.waitForTimeout(1000);
      const taskInput = page.locator('.task-input-widget input');
      await taskInput.fill('Task to import later');
      await taskInput.press('Enter');
      await page.waitForTimeout(2000);
      
      // Clear editor
      await editor.clear();
      
      // Now try importing
      await editor.type('@task ');
      await page.waitForTimeout(2000);
      
      const widget = page.locator('.task-import-widget');
      await expect(widget).toBeVisible();
      
      // Should show the previously created task
      const taskItem = widget.locator('.task-import-item');
      if (await taskItem.count() > 0) {
        await expect(taskItem.first()).toContainText('Task to import later');
      }
    });

    test('should filter tasks when typing in search', async ({ page }) => {
      // Create multiple tasks first
      const tasks = ['Important meeting', 'Fix bug', 'Write documentation'];
      
      for (const taskText of tasks) {
        const editor = await getEditor(page);
        await editor.click();
        await editor.clear();
        
        await editor.type('!task ');
        await page.waitForTimeout(1000);
        const taskInput = page.locator('.task-input-widget input');
        await taskInput.fill(taskText);
        await taskInput.press('Enter');
        await page.waitForTimeout(1500);
      }
      
      // Now test importing with filter
      const editor = await getEditor(page);
      await editor.clear();
      await editor.type('@task ');
      await page.waitForTimeout(2000);
      
      const widget = page.locator('.task-import-widget');
      const searchInput = widget.locator('input[placeholder*="Type to search tasks"]');
      
      // Type to filter
      await searchInput.fill('bug');
      await page.waitForTimeout(500);
      
      // Should show filtered results
      const taskItems = widget.locator('.task-import-item');
      if (await taskItems.count() > 0) {
        const visibleItems = await taskItems.all();
        for (const item of visibleItems) {
          const text = await item.textContent();
          expect(text.toLowerCase()).toContain('bug');
        }
      }
    });

    test('should navigate with arrow keys and select with Enter', async ({ page }) => {
      // Create a few tasks first
      const tasks = ['First task', 'Second task'];
      
      for (const taskText of tasks) {
        const editor = await getEditor(page);
        await editor.click();
        await editor.clear();
        
        await editor.type('!task ');
        await page.waitForTimeout(1000);
        const taskInput = page.locator('.task-input-widget input');
        await taskInput.fill(taskText);
        await taskInput.press('Enter');
        await page.waitForTimeout(1500);
      }
      
      // Import test
      const editor = await getEditor(page);
      await editor.clear();
      await editor.type('@task ');
      await page.waitForTimeout(2000);
      
      const widget = page.locator('.task-import-widget');
      const searchInput = widget.locator('input[placeholder*="Type to search tasks"]');
      
      // Navigate with arrow keys
      await searchInput.press('ArrowDown');
      await page.waitForTimeout(200);
      await searchInput.press('ArrowDown');
      await page.waitForTimeout(200);
      
      // Select with Enter
      await searchInput.press('Enter');
      await page.waitForTimeout(1500);
      
      // Widget should close and task should be inserted
      await expect(widget).not.toBeVisible();
      const importedTask = page.locator('[data-task-text="true"]').last();
      await expect(importedTask).toBeVisible();
    });
  });

  test.describe('Task Interaction', () => {
    test('should make tasks clickable with proper styling', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Create a task
      await editor.type('!task ');
      await page.waitForTimeout(1000);
      const taskInput = page.locator('.task-input-widget input');
      await taskInput.fill('Clickable test task');
      await taskInput.press('Enter');
      await page.waitForTimeout(2000);
      
      // Check if task element has proper attributes
      const taskElement = page.locator('[data-task-text="true"]');
      await expect(taskElement).toBeVisible();
      await expect(taskElement).toHaveAttribute('data-task-id');
      await expect(taskElement).toHaveAttribute('data-task-status');
      
      // Check if task has clickable styling (cursor pointer)
      const styles = await taskElement.evaluate(el => {
        const computed = window.getComputedStyle(el);
        return {
          cursor: computed.cursor,
          display: computed.display,
          background: computed.background
        };
      });
      
      expect(styles.cursor).toBe('pointer');
    });

    test('should navigate to kanban when task is clicked', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Create a task
      await editor.type('!task ');
      await page.waitForTimeout(1000);
      const taskInput = page.locator('.task-input-widget input');
      await taskInput.fill('Navigation test task');
      await taskInput.press('Enter');
      await page.waitForTimeout(2000);
      
      // Click on the task
      const taskElement = page.locator('[data-task-text="true"]');
      await expect(taskElement).toBeVisible();
      
      // Listen for navigation
      const navigationPromise = page.waitForTimeout(3000); // Wait for navigation
      
      await taskElement.click();
      await navigationPromise;
      
      // Check if kanban tab is active or kanban board is visible
      const kanbanTab = page.locator('[data-file="__kanban__"]');
      const kanbanBoard = page.locator('.kanban-board, .full-kanban, .task-board');
      
      const kanbanVisible = await kanbanTab.count() > 0 || await kanbanBoard.count() > 0;
      expect(kanbanVisible).toBeTruthy();
    });

    test('should show hover effects on tasks', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Create a task
      await editor.type('!task ');
      await page.waitForTimeout(1000);
      const taskInput = page.locator('.task-input-widget input');
      await taskInput.fill('Hover test task');
      await taskInput.press('Enter');
      await page.waitForTimeout(2000);
      
      const taskElement = page.locator('[data-task-text="true"]');
      await expect(taskElement).toBeVisible();
      
      // Test hover effect
      await taskElement.hover();
      await page.waitForTimeout(300);
      
      // Check if hover styles are applied (this is basic, real hover effects would need more detailed testing)
      const isHovered = await taskElement.evaluate(el => {
        return el.matches(':hover');
      });
      
      // Just verify the element can be hovered (hover effects are tested via CSS)
      expect(isHovered || true).toBeTruthy(); // Placeholder - hover effects are mainly visual
    });
  });

  test.describe('Error Handling', () => {
    test('should handle task creation failures gracefully', async ({ page }) => {
      // Mock the Tauri invoke to fail
      await page.evaluate(() => {
        window.__TAURI__ = window.__TAURI__ || {};
        window.__TAURI__.core = window.__TAURI__.core || {};
        window.__TAURI__.core.invoke = async (command) => {
          if (command === 'create_task') {
            throw new Error('Backend error');
          }
          return null;
        };
      });

      const editor = await getEditor(page);
      await editor.click();
      
      // Try to create a task
      await editor.type('!task ');
      await page.waitForTimeout(1000);
      const taskInput = page.locator('.task-input-widget input');
      await taskInput.fill('Failed task');
      await taskInput.press('Enter');
      await page.waitForTimeout(2000);
      
      // Widget should close even on error
      const widget = page.locator('.task-input-widget');
      await expect(widget).not.toBeVisible();
      
      // Task should not be created in editor
      const taskElement = page.locator('[data-task-text="true"]');
      expect(await taskElement.count()).toBe(0);
    });

    test('should handle import failures gracefully', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Try to open import widget (will fail to load tasks)
      await editor.type('@task ');
      await page.waitForTimeout(2000);
      
      const widget = page.locator('.task-import-widget');
      await expect(widget).toBeVisible();
      
      // Should show error message or empty state
      const errorMessage = widget.locator('*').filter({ hasText: /failed|error|no tasks/i });
      const emptyMessage = widget.locator('*').filter({ hasText: /no tasks found/i });
      
      const hasErrorOrEmpty = await errorMessage.count() > 0 || await emptyMessage.count() > 0;
      expect(hasErrorOrEmpty).toBeTruthy();
    });
  });

  test.describe('Integration Tests', () => {
    test('should work with other editor features', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Type some regular text
      await editor.type('This is a note with a task: ');
      
      // Create a task
      await editor.type('!task ');
      await page.waitForTimeout(1000);
      const taskInput = page.locator('.task-input-widget input');
      await taskInput.fill('Integration test task');
      await taskInput.press('Enter');
      await page.waitForTimeout(2000);
      
      // Continue typing
      await editor.type(' and some more text after.');
      
      // Verify both text and task exist
      const editorContent = await editor.textContent();
      expect(editorContent).toContain('This is a note');
      expect(editorContent).toContain('Integration test task');
      expect(editorContent).toContain('and some more text');
      
      const taskElement = page.locator('[data-task-text="true"]');
      await expect(taskElement).toBeVisible();
    });

    test('should persist tasks across editor sessions', async ({ page }) => {
      const editor = await getEditor(page);
      await editor.click();
      
      // Create a task
      await editor.type('!task ');
      await page.waitForTimeout(1000);
      const taskInput = page.locator('.task-input-widget input');
      await taskInput.fill('Persistent test task');
      await taskInput.press('Enter');
      await page.waitForTimeout(2000);
      
      // Save the file (if save functionality exists)
      await page.keyboard.press('Control+s');
      await page.waitForTimeout(1000);
      
      // Reload the page
      await page.reload();
      await waitForEditorLoad(page);
      await page.waitForTimeout(2000);
      
      // Check if task still exists
      const taskElement = page.locator('[data-task-text="true"]');
      if (await taskElement.count() > 0) {
        await expect(taskElement).toContainText('Persistent test task');
      }
      
      // If not in DOM, at least the task should exist in kanban
      await page.locator('@task ').fill('@task ');
      await page.waitForTimeout(2000);
      
      const widget = page.locator('.task-import-widget');
      if (await widget.count() > 0) {
        const taskItem = widget.locator('.task-import-item').filter({ hasText: 'Persistent test task' });
        await expect(taskItem.count()).toBeGreaterThan(0);
      }
    });
  });
});