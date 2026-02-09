import { test, expect } from '@playwright/test'

test.describe('Viewer - Measure Tool', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should show Measure button in toolbar', async ({ page }) => {
    const btn = page.locator('button[title="Measure"]')
    await expect(btn).toBeVisible()
  })

  test('should activate Measure tool on click', async ({ page }) => {
    const btn = page.locator('button[title="Measure"]')
    await btn.click()
    await expect(btn).toHaveClass(/bg-primary/)
  })

  test('should show measure panel when tool is active', async ({ page }) => {
    const btn = page.locator('button[title="Measure"]')
    await btn.click()
    await expect(page.getByText('Measurements', { exact: true })).toBeVisible()
  })

  test('should show status text in measure panel', async ({ page }) => {
    const btn = page.locator('button[title="Measure"]')
    await btn.click()
    await expect(page.getByText('Click to place point A')).toBeVisible()
  })

  test('should show "No measurements" when empty', async ({ page }) => {
    const btn = page.locator('button[title="Measure"]')
    await btn.click()
    await expect(page.getByText('No measurements')).toBeVisible()
  })

  test('should hide measure panel when switching tool', async ({ page }) => {
    const measureBtn = page.locator('button[title="Measure"]')
    await measureBtn.click()
    await expect(page.getByText('Measurements', { exact: true })).toBeVisible()

    const selectBtn = page.locator('button[title="Select"]')
    await selectBtn.click()
    await expect(page.getByText('Measurements', { exact: true })).toBeHidden()
  })
})
