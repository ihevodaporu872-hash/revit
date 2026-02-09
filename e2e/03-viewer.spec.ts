import { test, expect } from '@playwright/test'

test.describe('Module 2: 3D Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should display viewer page', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('3D Model Viewer')
  })

  test('should have a canvas element for Three.js', async ({ page }) => {
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('should have toolbar buttons', async ({ page }) => {
    // Viewer has toolbar buttons - check at least some exist
    const buttons = page.locator('main button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(3)
  })
})
