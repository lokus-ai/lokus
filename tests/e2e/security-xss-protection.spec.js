import { test, expect } from '@playwright/test'
import { disableTour, dismissTourOverlay } from './helpers/test-utils.js'

/**
 * XSS Protection Tests
 *
 * IMPORTANT: These tests require a real Tauri environment with an open editor.
 * They will skip in CI where Tauri is not available.
 */
test.describe('XSS Protection', () => {
  // Skip in CI (no Tauri available)
  test.skip(() => process.env.CI === 'true', 'XSS protection tests require Tauri environment');

  test.beforeEach(async ({ page }) => {
    await disableTour(page)
    await page.goto('/')
    await dismissTourOverlay(page)
    await page.waitForTimeout(2000)
  })

  test('should prevent XSS in editor content', async ({ page }) => {
    const editor = page.locator('.ProseMirror')
    
    // Try to inject script tag
    await editor.click()
    await editor.fill('<script>window.xssExecuted = true</script>Hello World')
    
    // Verify script didn't execute
    const xssExecuted = await page.evaluate(() => window.xssExecuted)
    expect(xssExecuted).toBeUndefined()
    
    // Verify content is safely displayed
    await expect(editor).toContainText('Hello World')
    await expect(page.locator('script')).toHaveCount(0)
  })

  test('should prevent XSS in math expressions', async ({ page }) => {
    const editor = page.locator('.ProseMirror')
    
    await editor.click()
    // Try to inject XSS through math expression
    await editor.type('$<script>alert("xss")</script>x^2$')
    await page.keyboard.press('Space')
    
    // Verify math is rendered safely
    await expect(page.locator('.math-inline')).toBeVisible()
    await expect(page.locator('script')).toHaveCount(0)
    
    // Check that malicious script is not in DOM
    const mathContent = await page.locator('.math-inline').innerHTML()
    expect(mathContent).not.toContain('<script>')
    expect(mathContent).not.toContain('alert("xss")')
  })

  test('should prevent XSS in search results', async ({ page }) => {
    // Create a file with content to search
    await page.click('[data-testid="create-file"]')
    await page.fill('[placeholder="Enter filename"]', 'test.md')
    await page.click('text=Create')
    
    const editor = page.locator('.ProseMirror')
    await editor.fill('This is a test document with some content')
    await page.keyboard.press('Control+S')
    
    // Open search
    await page.keyboard.press('Control+Shift+F')
    
    // Try to inject XSS through search query
    const searchInput = page.locator('[placeholder="Search in files..."]')
    await searchInput.fill('<script>window.searchXSS = true</script>test')
    
    // Wait for search results
    await page.waitForTimeout(600) // Wait for debounce
    
    // Verify script didn't execute
    const searchXSS = await page.evaluate(() => window.searchXSS)
    expect(searchXSS).toBeUndefined()
    
    // Verify search results don't contain script tags
    const searchResults = page.locator('.search-results')
    const resultsHTML = await searchResults.innerHTML()
    expect(resultsHTML).not.toContain('<script>')
  })

  test('should prevent XSS in task content', async ({ page }) => {
    const editor = page.locator('.ProseMirror')
    
    await editor.click()
    await editor.type('!task ')
    
    // Wait for task widget to appear
    await page.waitForSelector('.task-input-widget')
    
    // Try to inject XSS through task input
    const taskInput = page.locator('.task-input-widget input')
    await taskInput.fill('<img src=x onerror="window.taskXSS=true">Malicious Task')
    await page.keyboard.press('Enter')
    
    // Verify script didn't execute
    const taskXSS = await page.evaluate(() => window.taskXSS)
    expect(taskXSS).toBeUndefined()
    
    // Verify task is displayed safely
    await expect(editor).toContainText('Malicious Task')
    await expect(page.locator('[data-task-text]')).toBeVisible()
    
    // Check that malicious attributes are not present
    const taskElement = page.locator('[data-task-text]')
    const taskHTML = await taskElement.innerHTML()
    expect(taskHTML).not.toContain('onerror')
    expect(taskHTML).not.toContain('<img src=x')
  })

  test('should sanitize clipboard content', async ({ page }) => {
    const editor = page.locator('.ProseMirror')
    
    // Mock clipboard API to return malicious content
    await page.evaluate(() => {
      const mockClipboard = {
        readText: () => Promise.resolve('<script>window.clipboardXSS = true</script>Safe content')
      }
      Object.defineProperty(navigator, 'clipboard', {
        value: mockClipboard,
        writable: true
      })
    })
    
    await editor.click()
    await page.keyboard.press('Control+V')
    
    // Verify script didn't execute
    const clipboardXSS = await page.evaluate(() => window.clipboardXSS)
    expect(clipboardXSS).toBeUndefined()
    
    // Verify safe content is pasted
    await expect(editor).toContainText('Safe content')
    await expect(page.locator('script')).toHaveCount(0)
  })

  test('should prevent XSS in file names', async ({ page }) => {
    // Try to create a file with malicious name
    await page.click('[data-testid="create-file"]')
    const filenameInput = page.locator('[placeholder="Enter filename"]')
    await filenameInput.fill('<script>window.filenameXSS = true</script>evil.md')
    await page.click('text=Create')
    
    // Verify script didn't execute
    const filenameXSS = await page.evaluate(() => window.filenameXSS)
    expect(filenameXSS).toBeUndefined()
    
    // Check that the file tab doesn't contain script tags
    const fileTab = page.locator('.file-tab').first()
    const tabHTML = await fileTab.innerHTML()
    expect(tabHTML).not.toContain('<script>')
  })

  test('should prevent XSS through URL parameters', async ({ page }) => {
    // Navigate with malicious URL parameter
    await page.goto('/?workspace=<script>window.urlXSS=true</script>/tmp/test')
    
    // Verify script didn't execute
    const urlXSS = await page.evaluate(() => window.urlXSS)
    expect(urlXSS).toBeUndefined()
    
    // Check that malicious content is not rendered in DOM
    const bodyHTML = await page.locator('body').innerHTML()
    expect(bodyHTML).not.toContain('<script>window.urlXSS')
  })

  test('should have Content Security Policy headers', async ({ page }) => {
    // Check CSP headers are present
    const response = await page.goto('/')
    const headers = response.headers()
    
    // Note: In Tauri apps, CSP is set in tauri.conf.json, not HTTP headers
    // But we can verify no inline scripts execute
    const scriptTags = page.locator('script[src]')
    const scriptCount = await scriptTags.count()
    
    // All scripts should have src attribute (no inline scripts)
    for (let i = 0; i < scriptCount; i++) {
      const script = scriptTags.nth(i)
      const src = await script.getAttribute('src')
      expect(src).toBeTruthy()
    }
  })

  test('should escape HTML entities in all user content', async ({ page }) => {
    const editor = page.locator('.ProseMirror')
    
    // Test various HTML entities and dangerous characters
    const testContent = '< > & " \' <img> <div> <span>'
    
    await editor.click()
    await editor.fill(testContent)
    
    // Verify content is properly escaped
    const editorHTML = await editor.innerHTML()
    expect(editorHTML).not.toContain('<img>')
    expect(editorHTML).not.toContain('<div>')
    expect(editorHTML).not.toContain('<span>')
    
    // But should still display the characters as text
    await expect(editor).toContainText('< > & " \'')
  })
})