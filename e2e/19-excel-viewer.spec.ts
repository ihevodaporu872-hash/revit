import { test, expect } from '@playwright/test'

test.describe('Excel Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/excel')
  })

  test.describe('Page Load', () => {
    test('should display Excel Viewer header', async ({ page }) => {
      await expect(page.locator('h2:has-text("Excel Viewer")')).toBeVisible()
    })

    test('should display subtitle with Univer mention', async ({ page }) => {
      await expect(page.locator('text=Powered by Univer')).toBeVisible()
    })

    test('should display Upload XLSX File button', async ({ page }) => {
      await expect(page.locator('label:has-text("Upload XLSX File")')).toBeVisible()
    })

    test('should render Univer spreadsheet container', async ({ page }) => {
      const container = page.locator('[data-testid="excel-container"]')
      await expect(container).toBeVisible()
    })
  })

  test.describe('Navigation', () => {
    test('should be accessible from sidebar', async ({ page }) => {
      await page.goto('/')
      const sidebarLink = page.locator('button:has-text("Excel")')
      await expect(sidebarLink).toBeVisible()
      await sidebarLink.click()
      await expect(page).toHaveURL('/excel')
    })
  })

  test.describe('File Upload', () => {
    test('should have hidden file input for Excel files', async ({ page }) => {
      const fileInput = page.locator('[data-testid="xlsx-file-input"]')
      await expect(fileInput).toBeAttached()
    })
  })

  test.describe('Univer Integration', () => {
    test('should initialize Univer spreadsheet engine', async ({ page }) => {
      // Wait for Univer to initialize and render
      await page.waitForTimeout(2000)
      const container = page.locator('[data-testid="excel-container"]')
      // Univer creates nested DOM elements when initialized
      const childCount = await container.locator('> *').count()
      expect(childCount).toBeGreaterThan(0)
    })
  })
})
