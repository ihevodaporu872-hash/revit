import { test, expect } from '@playwright/test'

test.describe('CAD Viewer', () => {
  test('should load page with CAD Viewer heading', async ({ page }) => {
    await page.goto('/cad-viewer')
    await expect(page.locator('h2:has-text("CAD Viewer")')).toBeVisible()
  })

  test('should show upload button', async ({ page }) => {
    await page.goto('/cad-viewer')
    await expect(page.getByRole('button', { name: 'Upload DWG/DXF' })).toBeVisible()
  })

  test('should have file input that accepts .dwg and .dxf', async ({ page }) => {
    await page.goto('/cad-viewer')
    const fileInput = page.locator('input[type="file"]')
    await expect(fileInput).toHaveAttribute('accept', '.dwg,.dxf')
  })

  test('should show empty state with drop hint', async ({ page }) => {
    await page.goto('/cad-viewer')
    // Wait for viewer init — empty state appears after viewerReady
    await expect(page.getByText('Drop a CAD file here')).toBeVisible({ timeout: 10000 })
    await expect(page.getByText('Supported formats: DWG, DXF')).toBeVisible()
  })

  test('should show subtitle text', async ({ page }) => {
    await page.goto('/cad-viewer')
    await expect(page.getByText('View DWG/DXF files')).toBeVisible()
  })

  test('should not show navigation controls before document is loaded', async ({ page }) => {
    await page.goto('/cad-viewer')
    // Wait for the page to settle
    await page.waitForTimeout(500)
    // Pan, Zoom, Fit etc. should not be visible without a loaded doc
    await expect(page.getByRole('button', { name: 'Pan' })).not.toBeVisible()
    await expect(page.getByRole('button', { name: 'Fit' })).not.toBeVisible()
  })
})
