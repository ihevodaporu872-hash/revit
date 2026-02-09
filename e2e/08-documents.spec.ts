import { test, expect } from '@playwright/test'

test.describe('Module 7: Document Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/documents')
  })

  test('should display document control page', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('Document Control')
  })

  test('should show tabs', async ({ page }) => {
    await expect(page.locator('main').getByText('Documents').first()).toBeVisible()
    await expect(page.locator('main').getByText('RFIs').first()).toBeVisible()
    await expect(page.locator('main').getByText('Meeting Minutes').first()).toBeVisible()
  })

  test('should show document data', async ({ page }) => {
    await expect(page.locator('main').getByText(/Draft|Approved|Review/).first()).toBeVisible()
  })

  test('should switch to RFIs tab', async ({ page }) => {
    await page.getByRole('button', { name: 'RFIs' }).click()
    await page.waitForTimeout(300)
    await expect(page.locator('main').getByText('RFI-001').first()).toBeVisible()
  })

  test('should switch to Meeting Minutes tab', async ({ page }) => {
    await page.getByRole('button', { name: 'Meeting Minutes' }).click()
    await page.waitForTimeout(300)
    const textarea = page.locator('main textarea')
    await expect(textarea.first()).toBeVisible()
  })

  test('should show stats', async ({ page }) => {
    await expect(page.locator('text=Total Documents').first()).toBeVisible()
  })
})
