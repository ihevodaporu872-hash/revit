import { test, expect } from '@playwright/test'

test.describe('Module 8: QTO Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/qto')
  })

  test('should display QTO reports page', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('QTO Reports')
  })

  test('should show file upload area', async ({ page }) => {
    await expect(page.getByText(/drop files|click to browse|Upload/i).first()).toBeVisible()
  })

  test('should show grouping options', async ({ page }) => {
    await expect(page.locator('main').getByText('Type').first()).toBeVisible()
  })

  test('should have Generate Report button', async ({ page }) => {
    const genBtn = page.locator('main button:has-text("Generate")')
    await expect(genBtn.first()).toBeVisible()
  })

  test('should show tabs', async ({ page }) => {
    await expect(page.locator('main').getByText(/Generate|History/).first()).toBeVisible()
  })
})
