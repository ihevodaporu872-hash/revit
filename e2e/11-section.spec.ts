import { test, expect } from '@playwright/test'

test.describe('Viewer - Section Planes', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should show Section button in toolbar', async ({ page }) => {
    const btn = page.locator('button[title="Section"]')
    await expect(btn).toBeVisible()
  })

  test('should activate Section tool on click', async ({ page }) => {
    const btn = page.locator('button[title="Section"]')
    await btn.click()
    await expect(btn).toHaveClass(/bg-primary/)
  })

  test('should show section panel when tool is active', async ({ page }) => {
    const btn = page.locator('button[title="Section"]')
    await btn.click()
    await expect(page.getByText('Planes')).toBeVisible()
    await expect(page.getByText('Box')).toBeVisible()
    await expect(page.getByText('Off')).toBeVisible()
  })

  test('should show axis controls in planes mode', async ({ page }) => {
    const btn = page.locator('button[title="Section"]')
    await btn.click()
    await expect(page.getByText('x-Axis')).toBeVisible()
    await expect(page.getByText('y-Axis')).toBeVisible()
    await expect(page.getByText('z-Axis')).toBeVisible()
  })

  test('should have Reset button', async ({ page }) => {
    const btn = page.locator('button[title="Section"]')
    await btn.click()
    await expect(page.getByText('Reset')).toBeVisible()
  })

  test('should toggle plane checkbox', async ({ page }) => {
    const btn = page.locator('button[title="Section"]')
    await btn.click()
    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await expect(checkbox).toBeChecked()
  })

  test('should show flip button for enabled planes', async ({ page }) => {
    const btn = page.locator('button[title="Section"]')
    await btn.click()
    const checkbox = page.locator('input[type="checkbox"]').first()
    await checkbox.check()
    await expect(page.getByText('Flip').first()).toBeVisible()
  })

  test('should switch to box mode', async ({ page }) => {
    const btn = page.locator('button[title="Section"]')
    await btn.click()
    await page.getByText('Box').click()
    // Box mode shows Min/Max sliders
    await expect(page.getByText('Min').first()).toBeVisible()
    await expect(page.getByText('Max').first()).toBeVisible()
  })

  test('should switch to off mode', async ({ page }) => {
    const btn = page.locator('button[title="Section"]')
    await btn.click()
    await page.getByText('Off', { exact: true }).click()
    await expect(page.getByText('Section clipping disabled')).toBeVisible()
  })

  test('should hide section panel when switching tool', async ({ page }) => {
    const sectionBtn = page.locator('button[title="Section"]')
    await sectionBtn.click()
    await expect(page.getByText('Planes')).toBeVisible()

    const selectBtn = page.locator('button[title="Select"]')
    await selectBtn.click()
    await expect(page.getByText('Section clipping disabled')).toBeHidden()
  })
})
