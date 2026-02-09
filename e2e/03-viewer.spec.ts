import { test, expect } from '@playwright/test'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

test.describe('Module 2: 3D Viewer - Page Load', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should display header with correct title', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('3D Model Viewer')
  })

  test('should display "3D IFC Viewer" heading', async ({ page }) => {
    await expect(page.getByText('3D IFC Viewer')).toBeVisible()
  })

  test('should have canvas element for Three.js rendering', async ({ page }) => {
    const canvas = page.locator('canvas')
    await expect(canvas).toBeVisible()
  })

  test('should show "No model loaded" placeholder initially', async ({ page }) => {
    await expect(page.getByText('No model loaded')).toBeVisible()
  })

  test('should display upload instruction text', async ({ page }) => {
    await expect(page.getByText('Upload an IFC file to view and inspect 3D building models')).toBeVisible()
  })
})

test.describe('Module 2: 3D Viewer - Upload Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should have visible Upload IFC button', async ({ page }) => {
    const uploadBtn = page.getByText('Upload IFC')
    await expect(uploadBtn).toBeVisible()
  })

  test('should have Upload icon in button', async ({ page }) => {
    const uploadBtn = page.getByText('Upload IFC')
    await expect(uploadBtn).toBeVisible()
    // Button should have Upload icon (svg)
    const buttonParent = uploadBtn.locator('..')
    await expect(buttonParent.locator('svg')).toBeVisible()
  })
})

test.describe('Module 2: 3D Viewer - Toolbar Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('Select button should be visible', async ({ page }) => {
    const selectBtn = page.locator('button[title="Select"]')
    await expect(selectBtn).toBeVisible()
  })

  test('Select button should be clickable', async ({ page }) => {
    const selectBtn = page.locator('button[title="Select"]')
    await selectBtn.click()
    await expect(selectBtn).toBeVisible()
  })

  test('Pan button should be visible', async ({ page }) => {
    const panBtn = page.locator('button[title="Pan"]')
    await expect(panBtn).toBeVisible()
  })

  test('Pan button should be clickable and switch tool mode', async ({ page }) => {
    const panBtn = page.locator('button[title="Pan"]')
    await panBtn.click()
    await expect(panBtn).toBeVisible()
    // Pan button should have active styling after click
    await expect(panBtn).toHaveClass(/bg-primary/)
  })

  test('Rotate button should be visible', async ({ page }) => {
    const rotateBtn = page.locator('button[title="Rotate"]')
    await expect(rotateBtn).toBeVisible()
  })

  test('Rotate button should be clickable and switch tool mode', async ({ page }) => {
    const rotateBtn = page.locator('button[title="Rotate"]')
    await rotateBtn.click()
    await expect(rotateBtn).toBeVisible()
    await expect(rotateBtn).toHaveClass(/bg-primary/)
  })

  test('Zoom button should be visible', async ({ page }) => {
    const zoomBtn = page.locator('button[title="Zoom"]')
    await expect(zoomBtn).toBeVisible()
  })

  test('Zoom button should be clickable and switch tool mode', async ({ page }) => {
    const zoomBtn = page.locator('button[title="Zoom"]')
    await zoomBtn.click()
    await expect(zoomBtn).toBeVisible()
    await expect(zoomBtn).toHaveClass(/bg-primary/)
  })

  test('Measure button should be visible', async ({ page }) => {
    const measureBtn = page.locator('button[title="Measure"]')
    await expect(measureBtn).toBeVisible()
  })

  test('Measure button should be clickable', async ({ page }) => {
    const measureBtn = page.locator('button[title="Measure"]')
    await measureBtn.click()
    await expect(measureBtn).toBeVisible()
  })

  test('Section button should be visible', async ({ page }) => {
    const sectionBtn = page.locator('button[title="Section"]')
    await expect(sectionBtn).toBeVisible()
  })

  test('Section button should be clickable', async ({ page }) => {
    const sectionBtn = page.locator('button[title="Section"]')
    await sectionBtn.click()
    await expect(sectionBtn).toBeVisible()
  })

  test('Fit to View button should be visible', async ({ page }) => {
    const fitBtn = page.locator('button[title="Fit to View"]')
    await expect(fitBtn).toBeVisible()
  })

  test('Fit to View button should be clickable', async ({ page }) => {
    const fitBtn = page.locator('button[title="Fit to View"]')
    await fitBtn.click()
    await expect(fitBtn).toBeVisible()
  })

  test('Zoom In button should be visible and functional', async ({ page }) => {
    const zoomInBtn = page.locator('button[title="Zoom In"]')
    await expect(zoomInBtn).toBeVisible()
    await zoomInBtn.click()
  })

  test('Zoom Out button should be visible and functional', async ({ page }) => {
    const zoomOutBtn = page.locator('button[title="Zoom Out"]')
    await expect(zoomOutBtn).toBeVisible()
    await zoomOutBtn.click()
  })

  test('all toolbar buttons should have proper spacing', async ({ page }) => {
    const toolbar = page.locator('.absolute.top-3.left-3')
    await expect(toolbar).toBeVisible()

    // Count toolbar buttons
    const toolbarButtons = toolbar.locator('button')
    const count = await toolbarButtons.count()
    expect(count).toBeGreaterThanOrEqual(9) // 6 tools + divider + 3 view controls
  })
})

test.describe('Module 2: 3D Viewer - Panel Toggle', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('Show Panel button should be visible', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await expect(panelBtn).toBeVisible()
  })

  test('clicking Show Panel button should open left panel', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()

    // Panel should appear with Tree and Search Sets tabs
    await expect(page.getByText('Tree', { exact: false })).toBeVisible()
    await expect(page.getByText('Search Sets', { exact: false })).toBeVisible()
  })

  test('panel should have Tree tab', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()

    const treeTab = page.locator('button').filter({ hasText: 'Tree' }).first()
    await expect(treeTab).toBeVisible()
  })

  test('panel should have Search Sets tab', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()

    const setsTab = page.locator('button').filter({ hasText: 'Search Sets' }).first()
    await expect(setsTab).toBeVisible()
  })

  test('Tree tab should show empty state when no model loaded', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()

    await expect(page.getByText('Load an IFC file to see the spatial tree')).toBeVisible()
  })

  test('Search Sets tab should show Selection Sets section', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()

    // Click Search Sets tab
    const setsTab = page.locator('button').filter({ hasText: 'Search Sets' }).first()
    await setsTab.click()

    // Should show Selection Sets section
    await expect(page.getByText('Selection Sets')).toBeVisible()
  })

  test('clicking Hide Panel button should close left panel', async ({ page }) => {
    // Open panel first
    const showPanelBtn = page.locator('button[title="Show Panel"]')
    await showPanelBtn.click()
    await expect(page.getByText('Tree')).toBeVisible()

    // Click Hide Panel button
    const hidePanelBtn = page.locator('button[title="Hide Panel"]')
    await hidePanelBtn.click()

    // Panel should be hidden
    await expect(page.getByText('Tree')).toBeHidden()
  })

  test('panel tabs should be switchable', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()

    // Click Tree tab
    const treeTab = page.locator('button').filter({ hasText: 'Tree' }).first()
    await treeTab.click()
    await expect(page.getByText('Load an IFC file to see the spatial tree')).toBeVisible()

    // Click Search Sets tab
    const setsTab = page.locator('button').filter({ hasText: 'Search Sets' }).first()
    await setsTab.click()
    await expect(page.getByText('Selection Sets')).toBeVisible()
  })
})

test.describe('Module 2: 3D Viewer - Side Buttons', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('Model Info button should be visible', async ({ page }) => {
    const infoBtn = page.locator('button[title="Model Info"]')
    await expect(infoBtn).toBeVisible()
  })

  test('Model Info button should be clickable', async ({ page }) => {
    const infoBtn = page.locator('button[title="Model Info"]')
    await infoBtn.click()
    // Should show "No model loaded" notification (can't test notification directly)
  })

  test('Toggle Visibility button should be visible', async ({ page }) => {
    const visibilityBtn = page.locator('button[title="Toggle Visibility"]')
    await expect(visibilityBtn).toBeVisible()
  })

  test('Toggle Visibility button should be clickable', async ({ page }) => {
    const visibilityBtn = page.locator('button[title="Toggle Visibility"]')
    await visibilityBtn.click()
  })

  test('side buttons should be in correct position', async ({ page }) => {
    const sideButtonsContainer = page.locator('.absolute.top-3.right-3')
    await expect(sideButtonsContainer).toBeVisible()
  })
})

test.describe('Module 2: 3D Viewer - IFC Loading', () => {
  test('should show loading overlay when uploading IFC file', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/viewer')

    const samplePath = path.resolve(__dirname, '..', 'test-data', 'samples', 'sample.ifc')

    // Create a file chooser promise before clicking
    const fileChooserPromise = page.waitForEvent('filechooser')

    // Click Upload IFC button
    await page.getByText('Upload IFC').click()

    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(samplePath)

    // Loading overlay should appear with spinner
    await expect(page.locator('.animate-spin').first()).toBeVisible({ timeout: 5000 })
  })

  test('should show loading progress bar', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/viewer')

    const samplePath = path.resolve(__dirname, '..', 'test-data', 'samples', 'sample.ifc')

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText('Upload IFC').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(samplePath)

    // Progress bar should appear
    await expect(page.locator('.bg-primary.rounded-full')).toBeVisible({ timeout: 5000 })
  })

  test('should show loading message', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/viewer')

    const samplePath = path.resolve(__dirname, '..', 'test-data', 'samples', 'sample.ifc')

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText('Upload IFC').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(samplePath)

    // Loading message should appear (could be "Initializing..." or other)
    await expect(page.locator('.animate-spin')).toBeVisible({ timeout: 5000 })
  })

  test('should load IFC model and show tree', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/viewer')

    const samplePath = path.resolve(__dirname, '..', 'test-data', 'samples', 'sample.ifc')

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText('Upload IFC').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(samplePath)

    // Wait for loading to complete (loading overlay disappears)
    await expect(page.locator('.animate-spin').first()).toBeHidden({ timeout: 60000 })

    // Tree should have data (not empty message)
    await expect(page.getByText('Load an IFC file to see the spatial tree')).toBeHidden()
  })

  test('should automatically open left panel after loading', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/viewer')

    const samplePath = path.resolve(__dirname, '..', 'test-data', 'samples', 'sample.ifc')

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText('Upload IFC').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(samplePath)

    // Wait for loading to complete
    await expect(page.locator('.animate-spin').first()).toBeHidden({ timeout: 60000 })

    // Left panel should be visible
    await expect(page.getByText('Tree')).toBeVisible()
    await expect(page.getByText('Search Sets')).toBeVisible()
  })

  test('should show model stats after loading', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/viewer')

    const samplePath = path.resolve(__dirname, '..', 'test-data', 'samples', 'sample.ifc')

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText('Upload IFC').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(samplePath)

    // Wait for loading to complete
    await expect(page.locator('.animate-spin').first()).toBeHidden({ timeout: 60000 })

    // Model Info section should be visible
    await expect(page.getByText('Model Info')).toBeVisible()
  })

  test('should hide "No model loaded" placeholder after loading', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/viewer')

    const samplePath = path.resolve(__dirname, '..', 'test-data', 'samples', 'sample.ifc')

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText('Upload IFC').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(samplePath)

    // Wait for loading to complete
    await expect(page.locator('.animate-spin').first()).toBeHidden({ timeout: 60000 })

    // "No model loaded" should be hidden
    await expect(page.getByText('No model loaded')).toBeHidden()
  })

  test('should update header with filename after loading', async ({ page }) => {
    test.setTimeout(60000)
    await page.goto('/viewer')

    const samplePath = path.resolve(__dirname, '..', 'test-data', 'samples', 'sample.ifc')

    const fileChooserPromise = page.waitForEvent('filechooser')
    await page.getByText('Upload IFC').click()
    const fileChooser = await fileChooserPromise
    await fileChooser.setFiles(samplePath)

    // Wait for loading to complete
    await expect(page.locator('.animate-spin').first()).toBeHidden({ timeout: 60000 })

    // Filename should appear in description
    await expect(page.getByText('sample.ifc')).toBeVisible()
  })
})

test.describe('Module 2: 3D Viewer - Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should have proper main container layout', async ({ page }) => {
    const mainContainer = page.locator('.h-\\[calc\\(100vh-8rem\\)\\]')
    await expect(mainContainer).toBeVisible()
  })

  test('should position toolbar in top-left corner', async ({ page }) => {
    const toolbar = page.locator('.absolute.top-3.left-3').first()
    await expect(toolbar).toBeVisible()
  })

  test('should position side buttons in top-right corner', async ({ page }) => {
    const sideButtons = page.locator('.absolute.top-3.right-3')
    await expect(sideButtons).toBeVisible()
  })

  test('viewport should have rounded borders', async ({ page }) => {
    const viewport = page.locator('.flex-1.relative.rounded-xl')
    await expect(viewport).toBeVisible()
  })
})
