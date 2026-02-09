import { test, expect } from '@playwright/test'

test.describe('Module 4: BIM Validation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/validation')
  })

  test('should display validation page', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('BIM Validation')
  })

  test('should show stats', async ({ page }) => {
    await expect(page.locator('text=Models Validated').first()).toBeVisible()
  })

  test('should show file upload area', async ({ page }) => {
    await expect(page.getByText(/drop files|click to browse|Upload/i).first()).toBeVisible()
  })

  test('should show validation rules', async ({ page }) => {
    await expect(page.locator('main').getByText(/Naming|Property|Geometry|Classification|Spatial/i).first()).toBeVisible()
  })

  test('should have Run Validation button', async ({ page }) => {
    const runBtn = page.locator('main button:has-text("Validation")')
    await expect(runBtn.first()).toBeVisible()
  })
})
