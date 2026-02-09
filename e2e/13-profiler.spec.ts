import { test, expect } from '@playwright/test'

test.describe('Viewer - Appearance Profiler', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should show Profiler tab in left panel', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()
    await expect(page.getByText('Profiler')).toBeVisible()
  })

  test('should show profiler panel when tab clicked', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()
    await page.getByText('Profiler').click()
    await expect(page.getByText('Color By')).toBeVisible()
  })

  test('should show field selector dropdown', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()
    await page.getByText('Profiler').click()
    const select = page.locator('select')
    await expect(select).toBeVisible()
    // Check options
    await expect(select.locator('option')).toHaveCount(4)
  })

  test('should have Apply button', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()
    await page.getByText('Profiler').click()
    await expect(page.getByText('Apply')).toBeVisible()
  })

  test('should have IFC Type as default selection', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()
    await page.getByText('Profiler').click()
    const select = page.locator('select')
    await expect(select).toHaveValue('type')
  })
})
