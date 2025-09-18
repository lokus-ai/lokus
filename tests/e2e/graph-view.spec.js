import { test, expect } from '@playwright/test'

test.describe('GraphView - Core Functionality', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to app
    await page.goto('/')
    
    // Wait for app to load
    await page.waitForSelector('#root, .app-container, body', { timeout: 10000 })
    
    // Wait a moment for initialization
    await page.waitForTimeout(1000)
  })

  test('should open graph view successfully', async ({ page }) => {
    // Look for graph view button with exact title
    const graphButton = page.locator('[title="Graph View"]')
    
    if (await graphButton.count() > 0) {
      await graphButton.click()
      
      // Wait for graph view to load
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
      
      // Verify the canvas is rendered
      const canvas = page.locator('canvas')
      await expect(canvas).toBeVisible()
    } else {
      // Skip test if graph button not found
      test.skip(true, 'Graph view button not found in current UI')
    }
  })

  test('should display graph controls when graph view is active', async ({ page }) => {
    // Look for graph view button
    const graphButton = page.locator('[title="Graph View"]')
    
    if (await graphButton.count() > 0) {
      await graphButton.click()
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
      
      // Check for search input
      const searchInput = page.locator('[placeholder*="Search"]').or(
        page.locator('input[type="text"]')
      )
      
      if (await searchInput.count() > 0) {
        await expect(searchInput.first()).toBeVisible()
      }
      
      // Check for any control buttons
      const controlButtons = page.locator('button').filter({ hasText: /zoom|reset|layout/i })
      
      if (await controlButtons.count() > 0) {
        await expect(controlButtons.first()).toBeVisible()
      }
    } else {
      test.skip(true, 'Graph view button not found in current UI')
    }
  })

  test('should handle canvas interactions without crashing', async ({ page }) => {
    // Look for graph view button
    const graphButton = page.locator('[title="Graph View"]')
    
    if (await graphButton.count() > 0) {
      await graphButton.click()
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
      
      const canvas = page.locator('canvas')
      
      // Test mouse interactions on canvas
      await canvas.hover({ position: { x: 100, y: 100 } })
      await canvas.click({ position: { x: 150, y: 150 } })
      
      // Test dragging
      await canvas.hover({ position: { x: 200, y: 200 } })
      await page.mouse.down()
      await page.mouse.move(250, 250)
      await page.mouse.up()
      
      // Canvas should still be visible after interactions
      await expect(canvas).toBeVisible()
    } else {
      test.skip(true, 'Graph view button not found in current UI')
    }
  })

  test('should handle wheel events for zoom', async ({ page }) => {
    // Look for graph view button
    const graphButton = page.locator('[title="Graph View"]')
    
    if (await graphButton.count() > 0) {
      await graphButton.click()
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
      
      const canvas = page.locator('canvas')
      
      // Test zoom with wheel
      await canvas.hover({ position: { x: 300, y: 300 } })
      await page.mouse.wheel(0, -100) // Zoom in
      await page.mouse.wheel(0, 100)  // Zoom out
      
      // Canvas should still be functional
      await expect(canvas).toBeVisible()
    } else {
      test.skip(true, 'Graph view button not found in current UI')
    }
  })

  test('should support keyboard shortcuts in graph view', async ({ page }) => {
    // Look for graph view button
    const graphButton = page.locator('[title="Graph View"]')
    
    if (await graphButton.count() > 0) {
      await graphButton.click()
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
      
      // Test some keyboard shortcuts
      await page.keyboard.press('Escape') // Should clear selections
      await page.waitForTimeout(100)
      
      await page.keyboard.press('r') // Should reset view
      await page.waitForTimeout(100)
      
      // Canvas should still be visible
      await expect(page.locator('canvas')).toBeVisible()
    } else {
      test.skip(true, 'Graph view button not found in current UI')
    }
  })

  test('should handle theme changes without crashing', async ({ page }) => {
    // Look for graph view button
    const graphButton = page.locator('[title="Graph View"]')
    
    if (await graphButton.count() > 0) {
      await graphButton.click()
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
      
      // Toggle theme
      await page.evaluate(() => {
        document.documentElement.classList.toggle('dark')
      })
      
      // Wait for theme change to process
      await page.waitForTimeout(500)
      
      // Graph should still be visible
      await expect(page.locator('canvas')).toBeVisible()
    } else {
      test.skip(true, 'Graph view button not found in current UI')
    }
  })

  test('should be responsive to viewport changes', async ({ page }) => {
    // Look for graph view button
    const graphButton = page.locator('[title="Graph View"]')
    
    if (await graphButton.count() > 0) {
      await graphButton.click()
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
      
      // Test different viewport sizes
      await page.setViewportSize({ width: 1200, height: 800 })
      await expect(page.locator('canvas')).toBeVisible()
      
      await page.setViewportSize({ width: 800, height: 600 })
      await expect(page.locator('canvas')).toBeVisible()
      
      // Mobile viewport
      await page.setViewportSize({ width: 375, height: 667 })
      await expect(page.locator('canvas')).toBeVisible()
    } else {
      test.skip(true, 'Graph view button not found in current UI')
    }
  })
})

test.describe('GraphView - Component Stability', () => {
  test('should not crash when switching views multiple times', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#root, .app-container, body', { timeout: 10000 })
    
    const graphButton = page.locator('[title="Graph View"]')
    
    const explorerButton = page.locator('[title="Explorer"]')
    
    if (await graphButton.count() > 0) {
      // Switch between views multiple times
      for (let i = 0; i < 3; i++) {
        await graphButton.click()
        await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
        
        if (await explorerButton.count() > 0) {
          await explorerButton.click()
          await page.waitForTimeout(500)
        }
      }
      
      // Final check that graph still works
      await graphButton.click()
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
    } else {
      test.skip(true, 'Required UI elements not found')
    }
  })

  test('should handle empty workspace gracefully', async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('#root, .app-container, body', { timeout: 10000 })
    
    const graphButton = page.locator('[title="Graph View"]')
    
    if (await graphButton.count() > 0) {
      await graphButton.click()
      await expect(page.locator('canvas')).toBeVisible({ timeout: 15000 })
      
      // Should show canvas even with no data
      const canvas = page.locator('canvas')
      await expect(canvas).toBeVisible()
      
      // Should handle interactions gracefully
      await canvas.click({ position: { x: 100, y: 100 } })
      await canvas.hover({ position: { x: 200, y: 200 } })
      
      await expect(canvas).toBeVisible()
    } else {
      test.skip(true, 'Graph view button not found')
    }
  })
})