import { test, expect } from '@playwright/test'

test.describe('Module 5: AI Data Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ai-analysis')
  })

  test('should display AI analysis page', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('AI Data Analysis')
  })

  test('should show stats', async ({ page }) => {
    await expect(page.locator('text=Analyses Run').first()).toBeVisible()
  })

  test('should show file upload area', async ({ page }) => {
    await expect(page.getByText(/drop files|click to browse|Upload/i).first()).toBeVisible()
  })

  test('should show quick analysis presets', async ({ page }) => {
    await expect(page.locator('main').getByText(/Group by|distribution|anomal/i).first()).toBeVisible()
  })
})
