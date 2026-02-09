import { test, expect } from '@playwright/test'

test.describe('Viewer - Drawing Mode & Viewpoints', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/viewer')
  })

  test('should show Drawing Mode button in side panel', async ({ page }) => {
    const btn = page.locator('button[title="Drawing Mode"]')
    await expect(btn).toBeVisible()
  })

  test('should toggle drawing mode on click', async ({ page }) => {
    const btn = page.locator('button[title="Drawing Mode"]')
    await btn.click()
    await expect(btn).toHaveClass(/bg-primary/)
  })

  test('should show drawing toolbar when drawing mode active', async ({ page }) => {
    const btn = page.locator('button[title="Drawing Mode"]')
    await btn.click()
    // Drawing toolbar should have Pen tool selected by default
    await expect(page.locator('button[title="Pen (P)"]')).toBeVisible()
  })

  test('should show all drawing tools', async ({ page }) => {
    const btn = page.locator('button[title="Drawing Mode"]')
    await btn.click()
    await expect(page.locator('button[title="Pen (P)"]')).toBeVisible()
    await expect(page.locator('button[title="Line (L)"]')).toBeVisible()
    await expect(page.locator('button[title="Rectangle (R)"]')).toBeVisible()
    await expect(page.locator('button[title="Circle (C)"]')).toBeVisible()
    await expect(page.locator('button[title="Arrow (A)"]')).toBeVisible()
    await expect(page.locator('button[title="Text (T)"]')).toBeVisible()
    await expect(page.locator('button[title="Eraser (E)"]')).toBeVisible()
  })

  test('should show undo and clear buttons', async ({ page }) => {
    const btn = page.locator('button[title="Drawing Mode"]')
    await btn.click()
    await expect(page.locator('button[title="Undo (Ctrl+Z)"]')).toBeVisible()
    await expect(page.locator('button[title="Clear All (Delete)"]')).toBeVisible()
  })

  test('should show save viewpoint button', async ({ page }) => {
    const btn = page.locator('button[title="Drawing Mode"]')
    await btn.click()
    await expect(page.locator('button[title="Save Viewpoint"]')).toBeVisible()
  })

  test('should open save viewpoint dialog', async ({ page }) => {
    const btn = page.locator('button[title="Drawing Mode"]')
    await btn.click()
    await page.locator('button[title="Save Viewpoint"]').click()
    await expect(page.getByText('Save Viewpoint')).toBeVisible()
    await expect(page.locator('input[placeholder="e.g. North Elevation"]')).toBeVisible()
  })

  test('should exit drawing mode on button click', async ({ page }) => {
    const btn = page.locator('button[title="Drawing Mode"]')
    await btn.click()
    await expect(page.locator('button[title="Pen (P)"]')).toBeVisible()

    const exitBtn = page.locator('button[title="Exit Drawing Mode"]')
    await exitBtn.click()
    await expect(page.locator('button[title="Pen (P)"]')).toBeHidden()
  })

  test('should show Viewpoints tab in left panel', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()
    await expect(page.getByText('Views')).toBeVisible()
  })

  test('should show empty viewpoints message', async ({ page }) => {
    const panelBtn = page.locator('button[title="Show Panel"]')
    await panelBtn.click()
    await page.getByText('Views').click()
    await expect(page.getByText('No viewpoints saved')).toBeVisible()
  })
})
