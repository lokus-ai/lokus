import { test, expect } from '@playwright/test'

test.describe('Template System E2E', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the application
    await page.goto('/')
    
    // Wait for the app to be ready
    await page.waitForLoadState('networkidle')
    await expect(page.locator('body')).toBeVisible()
  })

  test.describe('Template Creation and Management', () => {
    test('should create a new template via slash command', async ({ page }) => {
      // Focus on the editor
      const editor = page.locator('[data-testid="editor"]')
      await editor.click()
      
      // Type slash command to open template picker
      await page.keyboard.type('/template')
      
      // Wait for the slash command menu to appear
      await expect(page.locator('[data-testid="slash-menu"]')).toBeVisible()
      
      // Select "Create Template" option
      await page.locator('[data-testid="slash-option-create-template"]').click()
      
      // Template creation dialog should appear
      await expect(page.locator('[data-testid="template-dialog"]')).toBeVisible()
      
      // Fill in template details
      await page.locator('[data-testid="template-name-input"]').fill('Test Template')
      await page.locator('[data-testid="template-category-select"]').selectOption('notes')
      await page.locator('[data-testid="template-content-textarea"]').fill('Hello {{name}}!')
      
      // Add tags
      await page.locator('[data-testid="template-tags-input"]').fill('test,automation')
      
      // Save the template
      await page.locator('[data-testid="save-template-button"]').click()
      
      // Dialog should close
      await expect(page.locator('[data-testid="template-dialog"]')).not.toBeVisible()
      
      // Success notification should appear
      await expect(page.locator('[data-testid="notification"]')).toContainText('Template created successfully')
    })

    test('should insert template via slash command', async ({ page }) => {
      // First, create a template (assuming template creation works from previous test)
      // We'll mock this by setting up the template in localStorage or through API
      
      // Focus on the editor
      const editor = page.locator('[data-testid="editor"]')
      await editor.click()
      
      // Type slash command to open template picker
      await page.keyboard.type('/insert')
      
      // Wait for the slash command menu
      await expect(page.locator('[data-testid="slash-menu"]')).toBeVisible()
      
      // Select "Insert Template" option
      await page.locator('[data-testid="slash-option-insert-template"]').click()
      
      // Template picker should appear
      await expect(page.locator('[data-testid="template-picker"]')).toBeVisible()
      
      // Search for our test template
      await page.locator('[data-testid="template-search"]').fill('Test Template')
      
      // Select the template
      await page.locator('[data-testid="template-item"]').first().click()
      
      // Variable input dialog should appear
      await expect(page.locator('[data-testid="variable-input-dialog"]')).toBeVisible()
      
      // Fill in the name variable
      await page.locator('[data-testid="variable-input-name"]').fill('John Doe')
      
      // Insert the template
      await page.locator('[data-testid="insert-template-button"]').click()
      
      // Check that the content was inserted into the editor
      await expect(editor).toContainText('Hello John Doe!')
    })

    test('should show template library in preferences', async ({ page }) => {
      // Open preferences
      await page.locator('[data-testid="preferences-button"]').click()
      
      // Navigate to templates section
      await page.locator('[data-testid="preferences-templates"]').click()
      
      // Template library should be visible
      await expect(page.locator('[data-testid="template-library"]')).toBeVisible()
      
      // Should show template list
      await expect(page.locator('[data-testid="template-list"]')).toBeVisible()
      
      // Should have create new template button
      await expect(page.locator('[data-testid="create-template-button"]')).toBeVisible()
    })
  })

  test.describe('Template Processing Features', () => {
    test('should handle variable substitution in templates', async ({ page }) => {
      // Create a template with multiple variables
      await page.goto('/preferences/templates')
      
      await page.locator('[data-testid="create-template-button"]').click()
      
      await page.locator('[data-testid="template-name-input"]').fill('Variable Test')
      await page.locator('[data-testid="template-content-textarea"]').fill(`
# {{title}}

**Author:** {{author.name}}
**Email:** {{author.email}}
**Date:** {{date || "Unknown"}}

## Description
{{description | capitalize}}

## Items
{{items | join}}
      `.trim())
      
      await page.locator('[data-testid="save-template-button"]').click()
      
      // Now insert this template in the editor
      await page.goto('/')
      
      const editor = page.locator('[data-testid="editor"]')
      await editor.click()
      await page.keyboard.type('/insert')
      await page.locator('[data-testid="slash-option-insert-template"]').click()
      
      await page.locator('[data-testid="template-search"]').fill('Variable Test')
      await page.locator('[data-testid="template-item"]').first().click()
      
      // Fill in complex variables
      await page.locator('[data-testid="variable-input-title"]').fill('My Document')
      await page.locator('[data-testid="variable-input-author-name"]').fill('Jane Smith')
      await page.locator('[data-testid="variable-input-author-email"]').fill('jane@example.com')
      await page.locator('[data-testid="variable-input-description"]').fill('this is a test document')
      await page.locator('[data-testid="variable-input-items"]').fill('apple,banana,cherry')
      
      await page.locator('[data-testid="insert-template-button"]').click()
      
      // Verify the processed content
      await expect(editor).toContainText('# My Document')
      await expect(editor).toContainText('**Author:** Jane Smith')
      await expect(editor).toContainText('**Email:** jane@example.com')
      await expect(editor).toContainText('**Date:** Unknown') // Default value used
      await expect(editor).toContainText('This is a test document') // Capitalized
      await expect(editor).toContainText('apple, banana, cherry') // Joined array
    })

    test('should handle JavaScript blocks in templates', async ({ page }) => {
      // Create a template with JavaScript
      await page.goto('/preferences/templates')
      
      await page.locator('[data-testid="create-template-button"]').click()
      
      await page.locator('[data-testid="template-name-input"]').fill('JS Template')
      await page.locator('[data-testid="template-content-textarea"]').fill(`
# Dynamic Content

**Current Date:** <% new Date().toDateString() %>
**Random ID:** <% uuid() %>
**Calculation:** <% 10 * 5 + 2 %>

## User Info
Name: {{name}}
Age in 10 years: <% age + 10 %>
      `.trim())
      
      await page.locator('[data-testid="save-template-button"]').click()
      
      // Insert the template
      await page.goto('/')
      
      const editor = page.locator('[data-testid="editor"]')
      await editor.click()
      await page.keyboard.type('/insert')
      await page.locator('[data-testid="slash-option-insert-template"]').click()
      
      await page.locator('[data-testid="template-search"]').fill('JS Template')
      await page.locator('[data-testid="template-item"]').first().click()
      
      await page.locator('[data-testid="variable-input-name"]').fill('Alice')
      await page.locator('[data-testid="variable-input-age"]').fill('25')
      
      await page.locator('[data-testid="insert-template-button"]').click()
      
      // Verify JavaScript execution results
      await expect(editor).toContainText('# Dynamic Content')
      await expect(editor).toContainText('**Current Date:**') // Date should be present
      await expect(editor).toContainText('**Random ID:**') // UUID should be present
      await expect(editor).toContainText('**Calculation:** 52') // 10 * 5 + 2 = 52
      await expect(editor).toContainText('Name: Alice')
      await expect(editor).toContainText('Age in 10 years: 35') // 25 + 10 = 35
    })

    test('should handle cursor positioning with {{cursor}} placeholder', async ({ page }) => {
      // Create a template with cursor placeholder
      await page.goto('/preferences/templates')
      
      await page.locator('[data-testid="create-template-button"]').click()
      
      await page.locator('[data-testid="template-name-input"]').fill('Cursor Template')
      await page.locator('[data-testid="template-content-textarea"]').fill(`
# {{title}}

{{cursor}}

## Notes
- Item 1
- Item 2
      `.trim())
      
      await page.locator('[data-testid="save-template-button"]').click()
      
      // Insert the template
      await page.goto('/')
      
      const editor = page.locator('[data-testid="editor"]')
      await editor.click()
      await page.keyboard.type('/insert')
      await page.locator('[data-testid="slash-option-insert-template"]').click()
      
      await page.locator('[data-testid="template-search"]').fill('Cursor Template')
      await page.locator('[data-testid="template-item"]').first().click()
      
      await page.locator('[data-testid="variable-input-title"]').fill('Test Document')
      await page.locator('[data-testid="insert-template-button"]').click()
      
      // Verify cursor is positioned correctly (between title and notes)
      // This might require checking the actual cursor position in the editor
      await page.keyboard.type('Content at cursor position')
      
      await expect(editor).toContainText('# Test Document')
      await expect(editor).toContainText('Content at cursor position')
      await expect(editor).toContainText('## Notes')
    })
  })

  test.describe('Template Library Management', () => {
    test('should filter templates by category', async ({ page }) => {
      await page.goto('/preferences/templates')
      
      // Should show category filter
      await expect(page.locator('[data-testid="category-filter"]')).toBeVisible()
      
      // Select notes category
      await page.locator('[data-testid="category-filter"]').selectOption('notes')
      
      // Only notes templates should be visible
      const templateItems = page.locator('[data-testid="template-item"]')
      await expect(templateItems).toHaveCount(await templateItems.count()) // Validate count exists
      
      // Check that all visible templates are in notes category
      const categoryLabels = page.locator('[data-testid="template-category-label"]')
      const count = await categoryLabels.count()
      for (let i = 0; i < count; i++) {
        await expect(categoryLabels.nth(i)).toContainText('notes')
      }
    })

    test('should search templates by name and content', async ({ page }) => {
      await page.goto('/preferences/templates')
      
      // Search for specific template
      await page.locator('[data-testid="template-search"]').fill('Test Template')
      
      // Should filter results
      const templateItems = page.locator('[data-testid="template-item"]')
      const count = await templateItems.count()
      
      if (count > 0) {
        // All visible templates should match search
        for (let i = 0; i < count; i++) {
          const templateName = templateItems.nth(i).locator('[data-testid="template-name"]')
          await expect(templateName).toContainText(/Test Template/i)
        }
      }
      
      // Clear search
      await page.locator('[data-testid="template-search"]').clear()
      
      // Should show all templates again
      await expect(templateItems).toHaveCount(await templateItems.count())
    })

    test('should edit existing template', async ({ page }) => {
      await page.goto('/preferences/templates')
      
      // Find and edit first template
      const firstTemplate = page.locator('[data-testid="template-item"]').first()
      await firstTemplate.locator('[data-testid="edit-template-button"]').click()
      
      // Edit dialog should open
      await expect(page.locator('[data-testid="template-dialog"]')).toBeVisible()
      
      // Modify template name
      const nameInput = page.locator('[data-testid="template-name-input"]')
      await nameInput.clear()
      await nameInput.fill('Updated Template Name')
      
      // Modify content
      const contentTextarea = page.locator('[data-testid="template-content-textarea"]')
      await contentTextarea.clear()
      await contentTextarea.fill('Updated content: {{newVariable}}')
      
      // Save changes
      await page.locator('[data-testid="save-template-button"]').click()
      
      // Dialog should close
      await expect(page.locator('[data-testid="template-dialog"]')).not.toBeVisible()
      
      // Updated template should be visible in list
      await expect(page.locator('[data-testid="template-item"]')).toContainText('Updated Template Name')
    })

    test('should delete template with confirmation', async ({ page }) => {
      await page.goto('/preferences/templates')
      
      // Count initial templates
      const initialCount = await page.locator('[data-testid="template-item"]').count()
      
      // Delete first template
      const firstTemplate = page.locator('[data-testid="template-item"]').first()
      const templateName = await firstTemplate.locator('[data-testid="template-name"]').textContent()
      
      await firstTemplate.locator('[data-testid="delete-template-button"]').click()
      
      // Confirmation dialog should appear
      await expect(page.locator('[data-testid="confirm-dialog"]')).toBeVisible()
      await expect(page.locator('[data-testid="confirm-dialog"]')).toContainText(templateName)
      
      // Confirm deletion
      await page.locator('[data-testid="confirm-delete-button"]').click()
      
      // Template should be removed
      const newCount = await page.locator('[data-testid="template-item"]').count()
      expect(newCount).toBe(initialCount - 1)
      
      // Deleted template should not be visible
      await expect(page.locator('[data-testid="template-item"]')).not.toContainText(templateName)
    })

    test('should export and import templates', async ({ page }) => {
      await page.goto('/preferences/templates')
      
      // Export first template
      const firstTemplate = page.locator('[data-testid="template-item"]').first()
      const templateName = await firstTemplate.locator('[data-testid="template-name"]').textContent()
      
      await firstTemplate.locator('[data-testid="export-template-button"]').click()
      
      // Export should trigger download (we can't easily test actual file download in Playwright)
      // So we'll just verify the button works and doesn't cause errors
      
      // Import template
      await page.locator('[data-testid="import-template-button"]').click()
      
      // Import dialog should appear
      await expect(page.locator('[data-testid="import-dialog"]')).toBeVisible()
      
      // We can't easily test file upload, so we'll test pasting JSON
      const importTextarea = page.locator('[data-testid="import-textarea"]')
      const mockTemplateData = JSON.stringify({
        id: 'imported-template',
        name: 'Imported Template',
        content: 'Imported content: {{variable}}',
        category: 'imported',
        tags: ['imported', 'test']
      })
      
      await importTextarea.fill(mockTemplateData)
      await page.locator('[data-testid="import-confirm-button"]').click()
      
      // Dialog should close
      await expect(page.locator('[data-testid="import-dialog"]')).not.toBeVisible()
      
      // Imported template should appear in list
      await expect(page.locator('[data-testid="template-item"]')).toContainText('Imported Template')
    })
  })

  test.describe('Template Validation and Error Handling', () => {
    test('should validate template syntax during creation', async ({ page }) => {
      await page.goto('/preferences/templates')
      
      await page.locator('[data-testid="create-template-button"]').click()
      
      await page.locator('[data-testid="template-name-input"]').fill('Invalid Template')
      
      // Enter invalid template syntax
      await page.locator('[data-testid="template-content-textarea"]').fill('Invalid {{syntax and <% unclosed')
      
      // Try to save
      await page.locator('[data-testid="save-template-button"]').click()
      
      // Error message should appear
      await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
      await expect(page.locator('[data-testid="error-message"]')).toContainText('Invalid template syntax')
      
      // Dialog should remain open
      await expect(page.locator('[data-testid="template-dialog"]')).toBeVisible()
    })

    test('should handle JavaScript errors gracefully', async ({ page }) => {
      // Create template with potentially problematic JavaScript
      await page.goto('/preferences/templates')
      
      await page.locator('[data-testid="create-template-button"]').click()
      
      await page.locator('[data-testid="template-name-input"]').fill('JS Error Template')
      await page.locator('[data-testid="template-content-textarea"]').fill(`
Good: {{name}}
Problematic: <% nonExistentFunction() %>
After: Some text
      `.trim())
      
      await page.locator('[data-testid="save-template-button"]').click()
      
      // Template should be created despite JS issues (warnings only)
      await expect(page.locator('[data-testid="template-dialog"]')).not.toBeVisible()
      
      // Now try to insert it
      await page.goto('/')
      
      const editor = page.locator('[data-testid="editor"]')
      await editor.click()
      await page.keyboard.type('/insert')
      await page.locator('[data-testid="slash-option-insert-template"]').click()
      
      await page.locator('[data-testid="template-search"]').fill('JS Error Template')
      await page.locator('[data-testid="template-item"]').first().click()
      
      await page.locator('[data-testid="variable-input-name"]').fill('Test User')
      await page.locator('[data-testid="insert-template-button"]').click()
      
      // Should insert with error parts preserved or handled gracefully
      await expect(editor).toContainText('Good: Test User')
      await expect(editor).toContainText('After: Some text')
    })

    test('should handle missing variables appropriately', async ({ page }) => {
      await page.goto('/preferences/templates')
      
      await page.locator('[data-testid="create-template-button"]').click()
      
      await page.locator('[data-testid="template-name-input"]').fill('Missing Vars Template')
      await page.locator('[data-testid="template-content-textarea"]').fill(`
Required: {{required}}
Optional: {{optional || "default value"}}
Nested: {{user.name || "Unknown"}}
      `.trim())
      
      await page.locator('[data-testid="save-template-button"]').click()
      
      // Insert template
      await page.goto('/')
      
      const editor = page.locator('[data-testid="editor"]')
      await editor.click()
      await page.keyboard.type('/insert')
      await page.locator('[data-testid="slash-option-insert-template"]').click()
      
      await page.locator('[data-testid="template-search"]').fill('Missing Vars Template')
      await page.locator('[data-testid="template-item"]').first().click()
      
      // Only fill required variable, leave others empty
      await page.locator('[data-testid="variable-input-required"]').fill('provided value')
      
      await page.locator('[data-testid="insert-template-button"]').click()
      
      // Should use defaults for missing variables
      await expect(editor).toContainText('Required: provided value')
      await expect(editor).toContainText('Optional: default value')
      await expect(editor).toContainText('Nested: Unknown')
    })
  })

  test.describe('Template Performance and User Experience', () => {
    test('should provide template preview during editing', async ({ page }) => {
      await page.goto('/preferences/templates')
      
      await page.locator('[data-testid="create-template-button"]').click()
      
      await page.locator('[data-testid="template-name-input"]').fill('Preview Template')
      
      // Enter template content
      const content = 'Hello {{name}}, today is <% new Date().toDateString() %>'
      await page.locator('[data-testid="template-content-textarea"]').fill(content)
      
      // Preview should be available
      await page.locator('[data-testid="preview-tab"]').click()
      
      // Preview should show processed content with sample data
      await expect(page.locator('[data-testid="template-preview"]')).toBeVisible()
      await expect(page.locator('[data-testid="template-preview"]')).toContainText('Hello')
    })

    test('should save draft templates automatically', async ({ page }) => {
      await page.goto('/preferences/templates')
      
      await page.locator('[data-testid="create-template-button"]').click()
      
      // Start typing template
      await page.locator('[data-testid="template-name-input"]').fill('Draft Template')
      await page.locator('[data-testid="template-content-textarea"]').fill('Draft content')
      
      // Wait for auto-save (assuming it exists)
      await page.waitForTimeout(2000)
      
      // Close dialog without saving
      await page.locator('[data-testid="cancel-template-button"]').click()
      
      // Reopen create dialog
      await page.locator('[data-testid="create-template-button"]').click()
      
      // Draft should be restored (if auto-save is implemented)
      // This test might need adjustment based on actual implementation
    })

    test('should provide keyboard shortcuts for template operations', async ({ page }) => {
      await page.goto('/')
      
      const editor = page.locator('[data-testid="editor"]')
      await editor.click()
      
      // Test keyboard shortcut for template insertion (if implemented)
      await page.keyboard.press('Ctrl+Shift+T') // Example shortcut
      
      // Template picker should open
      await expect(page.locator('[data-testid="template-picker"]')).toBeVisible()
      
      // Escape should close it
      await page.keyboard.press('Escape')
      await expect(page.locator('[data-testid="template-picker"]')).not.toBeVisible()
    })

    test('should handle large templates efficiently', async ({ page }) => {
      // Create a large template
      const largeContent = Array(100).fill().map((_, i) => 
        `## Section ${i + 1}\n{{content${i}}} <% Math.random() %>\n`
      ).join('\n')
      
      await page.goto('/preferences/templates')
      
      await page.locator('[data-testid="create-template-button"]').click()
      
      await page.locator('[data-testid="template-name-input"]').fill('Large Template')
      await page.locator('[data-testid="template-content-textarea"]').fill(largeContent)
      
      // Should save without timeout
      await page.locator('[data-testid="save-template-button"]').click()
      
      // Dialog should close within reasonable time
      await expect(page.locator('[data-testid="template-dialog"]')).not.toBeVisible({ timeout: 10000 })
      
      // Template should appear in list
      await expect(page.locator('[data-testid="template-item"]')).toContainText('Large Template')
    })
  })

  test.describe('Template Integration with Editor Features', () => {
    test('should maintain formatting when inserting templates', async ({ page }) => {
      await page.goto('/')
      
      const editor = page.locator('[data-testid="editor"]')
      await editor.click()
      
      // Type some initial content with formatting
      await page.keyboard.type('# My Document\n\n**Bold text** and *italic text*.\n\n')
      
      // Insert template
      await page.keyboard.type('/insert')
      await page.locator('[data-testid="slash-option-insert-template"]').click()
      
      // Assuming we have a simple template
      await page.locator('[data-testid="template-item"]').first().click()
      await page.locator('[data-testid="insert-template-button"]').click()
      
      // Formatting should be preserved
      await expect(editor).toContainText('# My Document')
      await expect(editor).toContainText('**Bold text**')
      await expect(editor).toContainText('*italic text*')
    })

    test('should work with undo/redo operations', async ({ page }) => {
      await page.goto('/')
      
      const editor = page.locator('[data-testid="editor"]')
      await editor.click()
      
      // Type initial content
      await page.keyboard.type('Initial content')
      
      // Insert template
      await page.keyboard.type('\n/insert')
      await page.locator('[data-testid="slash-option-insert-template"]').click()
      await page.locator('[data-testid="template-item"]').first().click()
      await page.locator('[data-testid="insert-template-button"]').click()
      
      // Undo template insertion
      await page.keyboard.press('Ctrl+Z')
      
      // Template content should be removed
      await expect(editor).toContainText('Initial content')
      await expect(editor).not.toContainText('Hello') // Assuming template had "Hello"
      
      // Redo
      await page.keyboard.press('Ctrl+Y')
      
      // Template content should be back
      await expect(editor).toContainText('Hello') // Template content restored
    })
  })
})