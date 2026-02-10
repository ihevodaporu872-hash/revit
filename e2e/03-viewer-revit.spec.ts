import { test, expect } from '@playwright/test'

test.describe('Revit Integration - Upload Button', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should have visible "Upload Revit (.xlsx)" button', async ({ page }) => {
    const revitBtn = page.getByText('Upload Revit (.xlsx)')
    await expect(revitBtn).toBeVisible()
  })

  test('should have FileSpreadsheet icon (svg) in button', async ({ page }) => {
    const revitBtn = page.getByText('Upload Revit (.xlsx)')
    await expect(revitBtn).toBeVisible()
    const buttonParent = revitBtn.locator('..')
    await expect(buttonParent.locator('svg')).toBeVisible()
  })
})

test.describe('Revit Integration - Match Status Before Upload', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('match status badge should NOT be visible initially', async ({ page }) => {
    await expect(page.getByText(/\d+\/\d+ matched/)).toHaveCount(0)
  })

  test('"Show Match" button should NOT be visible initially', async ({ page }) => {
    await expect(page.getByText('Show Match')).toHaveCount(0)
  })

  test('canvas and toolbar should coexist with Upload Revit button', async ({ page }) => {
    const canvas = page.locator('canvas').first()
    await expect(canvas).toBeVisible()

    const toolbar = page.locator('.absolute.top-3.left-3')
    await expect(toolbar).toBeVisible()

    const revitBtn = page.getByText('Upload Revit (.xlsx)')
    await expect(revitBtn).toBeVisible()
  })
})

test.describe('Revit Integration - Properties Panel Fallback', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('properties panel should NOT be visible without element selection', async ({ page }) => {
    await expect(page.getByText('Element Properties')).toHaveCount(0)
  })

  test('"Source: IFC only" badge should NOT appear without selected element', async ({ page }) => {
    await expect(page.getByText('Source: IFC only')).toHaveCount(0)
  })
})

test.describe('Revit Integration - Layout Integrity', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('Upload IFC and Upload Revit buttons should be in same header row', async ({ page }) => {
    const ifcBtn = page.getByTestId('upload-ifc-btn')
    const xlsxBtn = page.getByTestId('upload-revit-xlsx-btn')
    await expect(ifcBtn).toBeVisible()
    await expect(xlsxBtn).toBeVisible()

    const ifcBox = await ifcBtn.boundingBox()
    const xlsxBox = await xlsxBtn.boundingBox()
    expect(ifcBox).not.toBeNull()
    expect(xlsxBox).not.toBeNull()
    if (ifcBox && xlsxBox) {
      expect(Math.abs(ifcBox.y - xlsxBox.y)).toBeLessThan(20)
    }
  })

  test('Upload Revit button should be secondary variant', async ({ page }) => {
    const revitBtn = page.getByText('Upload Revit (.xlsx)')
    await expect(revitBtn).toBeVisible()
    // Secondary variant uses ShadcnButton with variant="secondary", which does NOT have bg-primary class
    await expect(revitBtn).not.toHaveClass(/bg-primary/)
  })

  test('header should show both upload options', async ({ page }) => {
    await expect(page.getByText('Upload IFC')).toBeVisible()
    await expect(page.getByText('Upload Revit (.xlsx)')).toBeVisible()
  })
})
