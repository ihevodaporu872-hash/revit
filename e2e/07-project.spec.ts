import { test, expect } from '@playwright/test'

test.describe('Module 6: Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/project')
  })

  test('should display project management page', async ({ page }) => {
    await expect(page.locator('header h1')).toHaveText('Project Management')
  })

  test('should show kanban columns', async ({ page }) => {
    const columns = ['To Do', 'In Progress', 'Review', 'Done']
    for (const col of columns) {
      await expect(page.locator(`main >> text=${col}`).first()).toBeVisible()
    }
  })

  test('should show task cards with priorities', async ({ page }) => {
    await expect(page.locator('main').getByText(/High|Medium|Low/).first()).toBeVisible()
  })

  test('should have Add Task button', async ({ page }) => {
    const addBtn = page.locator('main button:has-text("Add Task")')
    await expect(addBtn).toBeVisible()
  })

  test('should open Add Task dialog', async ({ page }) => {
    await page.locator('main button:has-text("Add Task")').click()
    await page.waitForTimeout(300)
    await expect(page.getByText('Title').first()).toBeVisible()
  })

  test('should show stats', async ({ page }) => {
    await expect(page.locator('text=Total Tasks').first()).toBeVisible()
    await expect(page.locator('text=Completed').first()).toBeVisible()
  })
})
