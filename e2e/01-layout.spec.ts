import { test, expect } from '@playwright/test'

test.describe('Layout & Navigation', () => {
  test('should load the app and show sidebar', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByText('Jens', { exact: true }).first()).toBeVisible()
  })

  test('should redirect / to /converter', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/converter/)
  })

  test('should show all 8 module links in sidebar', async ({ page }) => {
    await page.goto('/')
    const modules = [
      'CAD Converter',
      'D Viewer',
      'Cost Estimate',
      'BIM Validation',
      'AI Analysis',
      'Project Mgmt',
      'Documents',
      'QTO Reports',
    ]
    for (const mod of modules) {
      await expect(page.locator(`text=${mod}`).first()).toBeVisible()
    }
  })

  test('should navigate between modules', async ({ page }) => {
    await page.goto('/')

    await page.click('text=3D Viewer')
    await expect(page).toHaveURL(/\/viewer/)

    await page.click('text=Cost Estimate')
    await expect(page).toHaveURL(/\/cost/)

    await page.click('text=BIM Validation')
    await expect(page).toHaveURL(/\/validation/)

    await page.click('text=AI Analysis')
    await expect(page).toHaveURL(/\/ai-analysis/)

    await page.click('text=Project Mgmt')
    await expect(page).toHaveURL(/\/project/)

    await page.click('text=Documents')
    await expect(page).toHaveURL(/\/documents/)

    await page.click('text=QTO Reports')
    await expect(page).toHaveURL(/\/qto/)

    await page.click('text=CAD Converter')
    await expect(page).toHaveURL(/\/converter/)
  })

  test('should toggle sidebar', async ({ page }) => {
    await page.goto('/')
    const sidebarText = page.locator('text=Jens Platform v1.0')
    await expect(sidebarText).toBeVisible()

    // Click collapse button (ChevronLeft)
    const collapseBtn = page.locator('aside button').first()
    await collapseBtn.click()

    // Sidebar text should be hidden
    await expect(sidebarText).not.toBeVisible()

    // Click expand button (ChevronRight)
    await collapseBtn.click()
    await expect(sidebarText).toBeVisible()
  })

  test('should show page title in top bar', async ({ page }) => {
    await page.goto('/converter')
    await expect(page.locator('header h1')).toHaveText('CAD/BIM Converter')

    await page.goto('/cost')
    await expect(page.locator('header h1')).toHaveText('CWICR Cost Estimation')
  })

  test('should have search bar in top bar', async ({ page }) => {
    await page.goto('/')
    const search = page.locator('input[placeholder="Search..."]')
    await expect(search).toBeVisible()
  })
})
