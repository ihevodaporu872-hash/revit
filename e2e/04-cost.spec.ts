import { test, expect } from '@playwright/test'

test.describe('Module 3: CWICR Cost Estimation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cost')
  })

  test('should display cost estimation page', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('CWICR Cost Estimation')
  })

  test('should show total items stat', async ({ page }) => {
    await expect(page.locator('text=55,719').first()).toBeVisible()
  })

  test('should have search input', async ({ page }) => {
    const searchInput = page.locator('main input[type="text"]').first()
    await expect(searchInput).toBeVisible()
  })

  test('should show language options', async ({ page }) => {
    await expect(page.locator('main').getByText('EN').first()).toBeVisible()
  })

  test('should show tabs', async ({ page }) => {
    await expect(page.locator('main').getByText(/Search/).first()).toBeVisible()
  })

  test('should switch to AI Classification tab', async ({ page }) => {
    await page.getByRole('button', { name: 'AI Classification' }).click()
    await page.waitForTimeout(300)
  })
})
