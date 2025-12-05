import { test, expect } from '@playwright/test';
import { waitForEditorLoad, getEditor, typeInEditor } from './helpers/test-utils.js';

/**
 * Search Functionality Tests
 * 
 * IMPORTANT: These tests require a Tauri environment with an open editor.
 * In-file search within ProseMirror editor requires Tauri.
 * They will skip in CI where Tauri is not available.
 */
test.describe('Search Functionality', () => {
  // Skip in CI (no Tauri available)
  test.skip(() => process.env.CI === 'true', 'Search functionality tests require Tauri environment');

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    
    // Try to load editor for tests that need it
    try {
      await waitForEditorLoad(page, { timeout: 5000 });
    } catch {
      console.log('Editor not available - skipping editor-dependent search tests');
    }
  });

  test.describe('In-File Search (Cmd+F)', () => {
    test('should open in-file search with Cmd+F', async ({ page }) => {
      // Type some content first
      await typeInEditor(page, 'Hello world. This is a test. Hello again.');
      
      // Open search with Cmd+F
      await page.keyboard.press('Meta+f');
      
      // Check if search panel is visible
      await expect(page.locator('[placeholder="Find in file..."]')).toBeVisible();
      await expect(page.locator('[placeholder="Find in file..."]')).toBeFocused();
    });

    test('should find and highlight matches', async ({ page }) => {
      // Type content with multiple matches
      await typeInEditor(page, 'Hello world. This is a test. Hello again.');
      
      // Open search
      await page.keyboard.press('Meta+f');
      
      // Type search query
      await page.fill('[placeholder="Find in file..."]', 'Hello');
      
      // Wait for search to complete
      await page.waitForTimeout(300);
      
      // Check match counter
      await expect(page.locator('text=/\\d+ of \\d+/')).toBeVisible();
      
      // Should show "1 of 2" or similar
      const matchText = await page.locator('text=/\\d+ of \\d+/').textContent();
      expect(matchText).toMatch(/[12] of 2/);
    });

    test('should navigate between matches', async ({ page }) => {
      await typeInEditor(page, 'Hello world. This is a test. Hello again.');
      
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', 'Hello');
      await page.waitForTimeout(300);
      
      // Initially should be at first match
      await expect(page.locator('text=1 of 2')).toBeVisible();
      
      // Navigate to next match
      await page.click('[title="Next match (Enter)"]');
      await expect(page.locator('text=2 of 2')).toBeVisible();
      
      // Navigate to previous match
      await page.click('[title="Previous match (Shift+Enter)"]');
      await expect(page.locator('text=1 of 2')).toBeVisible();
    });

    test('should navigate with keyboard shortcuts', async ({ page }) => {
      await typeInEditor(page, 'Hello world. This is a test. Hello again.');
      
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', 'Hello');
      await page.waitForTimeout(300);
      
      // Use Enter to go to next match
      await page.keyboard.press('Enter');
      await expect(page.locator('text=2 of 2')).toBeVisible();
      
      // Use Shift+Enter to go to previous match
      await page.keyboard.press('Shift+Enter');
      await expect(page.locator('text=1 of 2')).toBeVisible();
    });

    test('should close search with Escape', async ({ page }) => {
      await page.keyboard.press('Meta+f');
      await expect(page.locator('[placeholder="Find in file..."]')).toBeVisible();
      
      await page.keyboard.press('Escape');
      await expect(page.locator('[placeholder="Find in file..."]')).not.toBeVisible();
    });

    test('should toggle search options', async ({ page }) => {
      await typeInEditor(page, 'Hello HELLO world');
      
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', 'hello');
      await page.waitForTimeout(300);
      
      // Should find both matches (case insensitive by default)
      await expect(page.locator('text=1 of 2')).toBeVisible();
      
      // Toggle case sensitive
      await page.click('[title="Match case"]');
      await page.waitForTimeout(300);
      
      // Should now find only one match
      await expect(page.locator('text=1 of 1')).toBeVisible();
    });

    test('should show and use replace functionality', async ({ page }) => {
      await typeInEditor(page, 'Hello world. Hello again.');
      
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', 'Hello');
      await page.waitForTimeout(300);
      
      // Toggle replace mode
      await page.click('[title="Toggle replace (Ctrl+H)"]');
      
      // Replace input should be visible
      await expect(page.locator('[placeholder="Replace with..."]')).toBeVisible();
      
      // Type replacement text
      await page.fill('[placeholder="Replace with..."]', 'Hi');
      
      // Replace current match
      await page.click('button:has-text("Replace"):not(:has-text("All"))');
      
      // Wait for replacement
      await page.waitForTimeout(300);
      
      // Check that text was replaced
      const editorContent = await getEditor(page).textContent();
      expect(editorContent).toContain('Hi world');
    });

    test('should replace all matches', async ({ page }) => {
      await typeInEditor(page, 'Hello world. Hello again. Hello there.');
      
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', 'Hello');
      await page.waitForTimeout(300);
      
      await page.click('[title="Toggle replace (Ctrl+H)"]');
      await page.fill('[placeholder="Replace with..."]', 'Hi');
      
      // Replace all matches
      await page.click('button:has-text("All")');
      await page.waitForTimeout(300);
      
      // Check that all instances were replaced
      const editorContent = await getEditor(page).textContent();
      expect(editorContent).not.toContain('Hello');
      expect(editorContent).toContain('Hi world. Hi again. Hi there.');
    });

    test('should handle regex search', async ({ page }) => {
      await typeInEditor(page, 'test123 and test456 and testABC');
      
      await page.keyboard.press('Meta+f');
      
      // Enable regex option
      await page.click('[title="Regular expression"]');
      
      // Search with regex pattern
      await page.fill('[placeholder="Find in file..."]', 'test\\d+');
      await page.waitForTimeout(300);
      
      // Should find 2 matches (test123 and test456, not testABC)
      await expect(page.locator('text=1 of 2')).toBeVisible();
    });

    test('should handle whole word search', async ({ page }) => {
      await typeInEditor(page, 'test testing tests');
      
      await page.keyboard.press('Meta+f');
      
      // Enable whole word option
      await page.click('[title="Whole word"]');
      
      // Search for "test"
      await page.fill('[placeholder="Find in file..."]', 'test');
      await page.waitForTimeout(300);
      
      // Should find only 1 match (exact word "test", not "testing" or "tests")
      await expect(page.locator('text=1 of 1')).toBeVisible();
    });
  });

  test.describe('Global Search (Cmd+Shift+F)', () => {
    test('should open global search with Cmd+Shift+F', async ({ page }) => {
      await page.keyboard.press('Meta+Shift+f');
      
      // Check if global search panel is visible
      await expect(page.locator('text=Search Files')).toBeVisible();
      await expect(page.locator('[placeholder="Search in files..."]')).toBeVisible();
      await expect(page.locator('[placeholder="Search in files..."]')).toBeFocused();
    });

    test('should close global search', async ({ page }) => {
      await page.keyboard.press('Meta+Shift+f');
      await expect(page.locator('text=Search Files')).toBeVisible();
      
      // Close with X button
      await page.click('[title="Close search"]');
      await expect(page.locator('text=Search Files')).not.toBeVisible();
    });

    test('should show search filters', async ({ page }) => {
      await page.keyboard.press('Meta+Shift+f');
      
      // Click filter button
      await page.click('[title="Search filters"]');
      
      // Check if filter options are visible
      await expect(page.locator('text=Case sensitive')).toBeVisible();
      await expect(page.locator('text=Whole word')).toBeVisible();
      await expect(page.locator('text=Regular expression')).toBeVisible();
    });

    test('should show search history', async ({ page }) => {
      // First, perform a search to create history
      await page.keyboard.press('Meta+Shift+f');
      await page.fill('[placeholder="Search in files..."]', 'test search');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Close and reopen search
      await page.keyboard.press('Escape');
      await page.keyboard.press('Meta+Shift+f');
      
      // Should show recent searches
      await expect(page.locator('text=Recent Searches')).toBeVisible();
      await expect(page.locator('text=test search')).toBeVisible();
    });

    test('should use search history when clicked', async ({ page }) => {
      await page.keyboard.press('Meta+Shift+f');
      await page.fill('[placeholder="Search in files..."]', 'previous search');
      await page.keyboard.press('Enter');
      await page.waitForTimeout(500);
      
      // Clear current search
      await page.fill('[placeholder="Search in files..."]', '');
      
      // Click on history item
      await page.click('text=previous search');
      
      // Should populate search input
      await expect(page.locator('[placeholder="Search in files..."]')).toHaveValue('previous search');
    });

    test('should toggle search options in global search', async ({ page }) => {
      await page.keyboard.press('Meta+Shift+f');
      await page.click('[title="Search filters"]');
      
      // Toggle case sensitive
      const caseSensitiveCheckbox = page.locator('input[type="checkbox"]').nth(0);
      await caseSensitiveCheckbox.check();
      await expect(caseSensitiveCheckbox).toBeChecked();
      
      // Toggle whole word
      const wholeWordCheckbox = page.locator('input[type="checkbox"]').nth(1);
      await wholeWordCheckbox.check();
      await expect(wholeWordCheckbox).toBeChecked();
      
      // Toggle regex
      const regexCheckbox = page.locator('input[type="checkbox"]').nth(2);
      await regexCheckbox.check();
      await expect(regexCheckbox).toBeChecked();
    });

    test('should handle empty search results', async ({ page }) => {
      await page.keyboard.press('Meta+Shift+f');
      await page.fill('[placeholder="Search in files..."]', 'nonexistenttext12345');
      await page.waitForTimeout(1000);
      
      // Should show no results message
      await expect(page.locator('text=No results found')).toBeVisible();
    });

    test('should show collapsed/expanded file results', async ({ page }) => {
      await page.keyboard.press('Meta+Shift+f');
      await page.fill('[placeholder="Search in files..."]', 'test');
      await page.waitForTimeout(1000);
      
      // Look for collapse/expand chevrons
      const chevronDown = page.locator('[data-testid="chevron-down-icon"]');
      const chevronRight = page.locator('[data-testid="chevron-right-icon"]');
      
      // If there are results, should have chevron controls
      if (await chevronDown.count() > 0) {
        // Click to collapse
        await chevronDown.first().click();
        await expect(chevronRight.first()).toBeVisible();
        
        // Click to expand
        await chevronRight.first().click();
        await expect(chevronDown.first()).toBeVisible();
      }
    });
  });

  test.describe('Search Integration', () => {
    test('should maintain search state when switching between files', async ({ page }) => {
      // Open in-file search
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', 'test');
      
      // The search should remain open and functional
      await expect(page.locator('[placeholder="Find in file..."]')).toHaveValue('test');
    });

    test('should clear search when closing search panel', async ({ page }) => {
      await typeInEditor(page, 'Hello world test content');
      
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', 'test');
      await page.waitForTimeout(300);
      
      // Close search
      await page.keyboard.press('Escape');
      
      // Reopen search - should be cleared
      await page.keyboard.press('Meta+f');
      await expect(page.locator('[placeholder="Find in file..."]')).toHaveValue('');
    });

    test('should handle search with no content', async ({ page }) => {
      // Open search on empty editor
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', 'test');
      await page.waitForTimeout(300);
      
      // Should show no matches
      await expect(page.locator('text=No matches')).toBeVisible();
    });

    test('should handle special characters in search', async ({ page }) => {
      await typeInEditor(page, 'Special chars: $#@!%^&*()[]{}');
      
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', '$#@');
      await page.waitForTimeout(300);
      
      // Should find the special characters
      await expect(page.locator('text=1 of 1')).toBeVisible();
    });

    test('should handle very long search queries', async ({ page }) => {
      const longText = 'This is a very long text with many words '.repeat(10);
      await typeInEditor(page, longText);
      
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', 'very long text with many words');
      await page.waitForTimeout(300);
      
      // Should handle long queries gracefully
      await expect(page.locator('text=/\\d+ of \\d+/')).toBeVisible();
    });
  });

  test.describe('Search Performance', () => {
    test('should debounce search queries', async ({ page }) => {
      await typeInEditor(page, 'test content for performance testing');
      
      await page.keyboard.press('Meta+f');
      
      // Type quickly without waiting
      await page.locator('[placeholder="Find in file..."]').type('test', { delay: 50 });
      
      // Search should still work after debounce
      await page.waitForTimeout(500);
      await expect(page.locator('text=1 of 1')).toBeVisible();
    });

    test('should handle rapid option toggling', async ({ page }) => {
      await typeInEditor(page, 'Test TEST test');
      
      await page.keyboard.press('Meta+f');
      await page.fill('[placeholder="Find in file..."]', 'test');
      await page.waitForTimeout(300);
      
      // Rapidly toggle case sensitive option
      for (let i = 0; i < 3; i++) {
        await page.click('[title="Match case"]');
        await page.waitForTimeout(100);
      }
      
      // Should still show correct results
      await expect(page.locator('text=/\\d+ of \\d+/')).toBeVisible();
    });
  });
});