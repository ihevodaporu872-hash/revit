import { test, expect } from '@playwright/test'

test.describe('PDF Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/pdf')
  })

  test.describe('Page Load', () => {
    test('should display PDF Viewer header', async ({ page }) => {
      await expect(page.locator('h2:has-text("PDF Viewer")')).toBeVisible()
    })

    test('should display subtitle text', async ({ page }) => {
      await expect(page.locator('text=View PDF with annotation overlay')).toBeVisible()
    })

    test('should display Upload PDF button', async ({ page }) => {
      await expect(page.locator('button:has-text("Upload PDF")')).toBeVisible()
    })

    test('should display Load Markup button (disabled without PDF)', async ({ page }) => {
      const markupBtn = page.locator('button:has-text("Load Markup")')
      await expect(markupBtn).toBeVisible()
      await expect(markupBtn).toBeDisabled()
    })

    test('should display drop zone placeholder', async ({ page }) => {
      await expect(page.locator('text=Drop PDF + markup files here')).toBeVisible()
    })
  })

  test.describe('Navigation', () => {
    test('should be accessible from sidebar', async ({ page }) => {
      await page.goto('/')
      const sidebarLink = page.locator('button:has-text("PDF")')
      await expect(sidebarLink).toBeVisible()
      await sidebarLink.click()
      await expect(page).toHaveURL('/pdf')
    })
  })

  test.describe('File Upload', () => {
    test('should have hidden file input for PDF', async ({ page }) => {
      const fileInput = page.locator('input[type="file"][accept*=".pdf"]')
      await expect(fileInput).toBeAttached()
    })

    test('should have hidden file input for markup', async ({ page }) => {
      const markupInput = page.locator('input[type="file"][accept*=".xml"]')
      await expect(markupInput).toBeAttached()
    })
  })
})
