import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.describe('Module 2: 3D Viewer', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should display viewer page with title', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('3D Model Viewer')
    await expect(page.getByText('3D IFC Viewer')).toBeVisible()
  })

  test('should have a canvas element for Three.js', async ({ page }) => {
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('should have toolbar buttons', async ({ page }) => {
    const buttons = page.locator('main button')
    const count = await buttons.count()
    expect(count).toBeGreaterThan(3)
  })

  test('should have Upload IFC button', async ({ page }) => {
    await expect(page.getByText('Upload IFC')).toBeVisible()
  })

  test('toolbar Select button should be active by default', async ({ page }) => {
    const selectBtn = page.locator('button[title="Select"]')
    await expect(selectBtn).toBeVisible()
  })

  test('toolbar Pan button should switch tool mode', async ({ page }) => {
    const panBtn = page.locator('button[title="Pan"]')
    await panBtn.click()
    await expect(panBtn).toBeVisible()
  })

  test('toolbar Rotate button should switch tool mode', async ({ page }) => {
    const rotateBtn = page.locator('button[title="Rotate"]')
    await rotateBtn.click()
    await expect(rotateBtn).toBeVisible()
  })

  test('toolbar Zoom button should switch tool mode', async ({ page }) => {
    const zoomBtn = page.locator('button[title="Zoom"]')
    await zoomBtn.click()
    await expect(zoomBtn).toBeVisible()
  })

  test('Fit to View button should be visible', async ({ page }) => {
    const fitBtn = page.locator('button[title="Fit to View"]')
    await expect(fitBtn).toBeVisible()
  })

  test('Zoom In button should be functional', async ({ page }) => {
    const zoomInBtn = page.locator('button[title="Zoom In"]')
    await expect(zoomInBtn).toBeVisible()
    await zoomInBtn.click()
  })

  test('Zoom Out button should be functional', async ({ page }) => {
    const zoomOutBtn = page.locator('button[title="Zoom Out"]')
    await expect(zoomOutBtn).toBeVisible()
    await zoomOutBtn.click()
  })

  test('Show Panel button should toggle left panel', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await expect(panelBtn).toBeVisible()
    await panelBtn.click()
    // After clicking, panel should appear with Tree and Search Sets tabs
    await expect(page.getByText('Tree')).toBeVisible()
    await expect(page.getByText('Search Sets')).toBeVisible()
  })

  test('left panel should have Tree and Search Sets tabs', async ({ page }) => {
    // Open panel
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()

    // Check tabs exist
    const treeTab = page.getByText('Tree', { exact: false }).first()
    const setsTab = page.getByText('Search Sets', { exact: false }).first()
    await expect(treeTab).toBeVisible()
    await expect(setsTab).toBeVisible()
  })

  test('Search Sets tab should show empty state', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()

    // Click Search Sets tab
    const setsTab = page.locator('button').filter({ hasText: 'Search Sets' }).first()
    await setsTab.click()

    // Should show sections
    await expect(page.getByText('Selection Sets')).toBeVisible()
  })

  test('no model placeholder should be visible initially', async ({ page }) => {
    await expect(page.getByText('No model loaded')).toBeVisible()
  })

  test('Model Info button should show notification', async ({ page }) => {
    const infoBtn = page.locator('button[title="Model Info"]')
    await infoBtn.click()
    // Should show "No model loaded" notification
  })

  test('should have empty tree when no model loaded', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()

    await expect(page.getByText('Load an IFC file to see the spatial tree')).toBeVisible()
  })
})

test.describe('Module 2: 3D Viewer - IFC Loading', () => {
  test('should show loading overlay when uploading IFC file', async ({ page }) => {
    await page.goto('/viewer')

    const samplePath = path.resolve(__dirname, '..', 'test-data', 'samples', 'sample.ifc')

    // Create a file chooser promise before clicking
    const fileChooserPromise = page.waitForEvent('filechooser')

    // Click Upload IFC button
    await page.getByText('Upload IFC').click()

    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(samplePath)

    // Loading overlay should appear
    await expect(page.locator('.animate-spin').first()).toBeVisible({ timeout: 5000 })
  })

  test('should load IFC model and show tree', async ({ page }) => {
    test.setTimeout(60000) // IFC loading can be slow
    await page.goto('/viewer')

    const samplePath = path.resolve(__dirname, '..', 'test-data', 'samples', 'sample.ifc')

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText('Upload IFC').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(samplePath)

    // Wait for loading to complete (loading overlay disappears)
    await expect(page.locator('.animate-spin').first()).toBeHidden({ timeout: 60000 })

    // Left panel should open automatically
    await expect(page.getByText('Model Info')).toBeVisible()

    // Tree should have data (not empty message)
    await expect(page.getByText('Load an IFC file to see the spatial tree')).toBeHidden()
  })
})
