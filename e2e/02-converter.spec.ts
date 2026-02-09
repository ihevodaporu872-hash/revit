import { test, expect } from '@playwright/test'

test.describe('Module 1: CAD/BIM Converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/converter')
  })

  test('should display converter page with stats', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('CAD/BIM Converter')
    await expect(page.locator('text=Files Converted')).toBeVisible()
    await expect(page.locator('text=Success Rate')).toBeVisible()
  })

  test('should show file upload area', async ({ page }) => {
    await expect(page.getByText(/drop files|click to browse|Upload/i).first()).toBeVisible()
  })

  test('should have format selection options', async ({ page }) => {
    await expect(page.locator('text=Excel').first()).toBeVisible()
  })

  test('should show tabs', async ({ page }) => {
    await expect(page.locator('main').getByText('New Conversion').first()).toBeVisible()
  })

  test('should switch to Conversion History tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Conversion History' }).click()
    await page.waitForTimeout(300)
  })

  test('should have convert button', async ({ page }) => {
    const convertBtn = page.locator('main button:has-text("Convert")')
    await expect(convertBtn.first()).toBeVisible()
  })
})
