import { test, expect } from '@playwright/test'

test.describe('Viewer - Advanced Features', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should show Zoom to Selected button', async ({ page }) => {
    const btn = page.locator('button[title="Zoom to Selected"]')
    await expect(btn).toBeVisible()
  })

  test('should disable Zoom to Selected when nothing selected', async ({ page }) => {
    const btn = page.locator('button[title="Zoom to Selected"]')
    await expect(btn).toHaveClass(/cursor-not-allowed/)
  })

  test('should have 4 left panel tabs when panel open', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()
    await expect(page.getByText('Tree')).toBeVisible()
    await expect(page.getByText('Sets')).toBeVisible()
    await expect(page.getByText('Views')).toBeVisible()
    await expect(page.getByText('Profiler')).toBeVisible()
  })

  test('all 4 tabs should be switchable', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()

    // Switch to Sets
    await page.getByText('Sets').click()
    await expect(page.getByText('Selection Sets')).toBeVisible()

    // Switch to Views
    await page.getByText('Views').click()
    await expect(page.getByText('No viewpoints saved')).toBeVisible()

    // Switch to Profiler
    await page.getByText('Profiler').click()
    await expect(page.getByText('Color By')).toBeVisible()

    // Switch back to Tree
    await page.getByText('Tree').click()
    await expect(page.getByText('Load an IFC file to see the spatial tree')).toBeVisible()
  })

  test('toolbar should have correct number of buttons', async ({ page }) => {
    const toolbar = page.locator('.absolute.top-3.left-3').first()
    const buttons = toolbar.locator('button')
    // 6 tools + Fit + Zoom to Selected + Zoom In + Zoom Out = 10
    const count = await buttons.count()
    expect(count).toBeGreaterThanOrEqual(10)
  })

  test('side buttons should have 5 buttons', async ({ page }) => {
    const sidePanel = page.locator('.absolute.top-3.right-3')
    const buttons = sidePanel.locator('button')
    // Panel toggle + Info + Visibility + Drawing + Export = 5
    const count = await buttons.count()
    expect(count).toBe(5)
  })

  test('should have annotation canvas in viewport', async ({ page }) => {
    const canvases = page.locator('canvas')
    // Three.js canvas + Annotation canvas = at least 2
    const count = await canvases.count()
    expect(count).toBeGreaterThanOrEqual(2)
  })
})
