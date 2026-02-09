import { test, expect } from '@playwright/test'

test.describe('Module 3: CWICR Cost Estimation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cost')
  })

  test.describe('Page Load', () => {
    test('should display header with title', async ({ page }) => {
      const header = page.locator('h1:has-text("CWICR Cost Estimation")')
      await expect(header).toBeVisible()
    })

    test('should display subtitle with 55,719 work items and 9 languages', async ({ page }) => {
      const subtitle = page.locator('text=Search 55,719 construction work items across 9 languages')
      await expect(subtitle).toBeVisible()
    })

    test('should display all 4 stat cards', async ({ page }) => {
      await expect(page.locator('text=Total Items')).toBeVisible()
      await expect(page.locator('text=55,719').first()).toBeVisible()

      await expect(page.locator('text=Languages')).toBeVisible()
      await expect(page.locator('text=9').first()).toBeVisible()

      await expect(page.locator('text=Avg Response Time')).toBeVisible()
      await expect(page.locator('text=0.3s')).toBeVisible()

      await expect(page.locator('text=Estimates Today')).toBeVisible()
      await expect(page.locator('text=7').first()).toBeVisible()
    })
  })

  test.describe('Tabs', () => {
    test('should display all 4 tabs', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Semantic Search/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /AI Classification/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Cost Calculation/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /History/i })).toBeVisible()
    })

    test('should have Semantic Search as default active tab', async ({ page }) => {
      // Check for search input presence (unique to Semantic Search tab)
      await expect(page.locator('input[placeholder*="Search work items"]')).toBeVisible()
    })

    test('should switch to AI Classification tab', async ({ page }) => {
      await page.getByRole('button', { name: /AI Classification/i }).click()
      await page.waitForTimeout(300)
      await expect(page.locator('text=BIM Element Classification')).toBeVisible()
    })

    test('should switch to Cost Calculation tab', async ({ page }) => {
      await page.getByRole('button', { name: /Cost Calculation/i }).click()
      await page.waitForTimeout(300)
      await expect(page.locator('text=Cost Calculation')).toBeVisible()
    })

    test('should switch to History tab', async ({ page }) => {
      await page.getByRole('button', { name: /History/i }).click()
      await page.waitForTimeout(300)
      await expect(page.locator('text=Recent Estimates')).toBeVisible()
    })

    test('should switch between tabs multiple times', async ({ page }) => {
      await page.getByRole('button', { name: /AI Classification/i }).click()
      await page.waitForTimeout(200)
      await expect(page.locator('text=BIM Element Classification')).toBeVisible()

      await page.getByRole('button', { name: /Semantic Search/i }).click()
      await page.waitForTimeout(200)
      await expect(page.locator('input[placeholder*="Search work items"]')).toBeVisible()

      await page.getByRole('button', { name: /History/i }).click()
      await page.waitForTimeout(200)
      await expect(page.locator('text=Recent Estimates')).toBeVisible()

      await page.getByRole('button', { name: /Cost Calculation/i }).click()
      await page.waitForTimeout(200)
      await expect(page.locator('text=Cost Calculation')).toBeVisible()
    })
  })

  test.describe('Semantic Search Tab', () => {
    test('should display language selector with EN as default', async ({ page }) => {
      const langButton = page.locator('button').filter({ hasText: 'EN' }).first()
      await expect(langButton).toBeVisible()
    })

    test('should display search input with placeholder', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await expect(searchInput).toBeVisible()
      await expect(searchInput).toHaveAttribute('placeholder', /Search work items/)
    })

    test('should display Search button', async ({ page }) => {
      const searchButton = page.getByRole('button', { name: /^Search$/i })
      await expect(searchButton).toBeVisible()
    })

    test('should open language dropdown on click', async ({ page }) => {
      const langButton = page.locator('button').filter({ hasText: 'EN' }).first()
      await langButton.click()
      await page.waitForTimeout(200)

      // Check for language options in dropdown
      await expect(page.locator('text=English')).toBeVisible()
      await expect(page.locator('text=Deutsch')).toBeVisible()
      await expect(page.locator('text=Русский')).toBeVisible()
    })

    test('should display all 9 language options in dropdown', async ({ page }) => {
      const langButton = page.locator('button').filter({ hasText: 'EN' }).first()
      await langButton.click()
      await page.waitForTimeout(200)

      await expect(page.locator('text=English')).toBeVisible()
      await expect(page.locator('text=Deutsch')).toBeVisible()
      await expect(page.locator('text=Русский')).toBeVisible()
      await expect(page.locator('text=中文')).toBeVisible()
      await expect(page.locator('text=العربية')).toBeVisible()
      await expect(page.locator('text=Español')).toBeVisible()
      await expect(page.locator('text=Français')).toBeVisible()
      await expect(page.locator('text=Português')).toBeVisible()
      await expect(page.locator('text=हिन्दी')).toBeVisible()
    })

    test('should select a different language', async ({ page }) => {
      const langButton = page.locator('button').filter({ hasText: 'EN' }).first()
      await langButton.click()
      await page.waitForTimeout(200)

      await page.locator('text=Deutsch').click()
      await page.waitForTimeout(200)

      await expect(page.locator('button').filter({ hasText: 'DE' }).first()).toBeVisible()
    })

    test('should close language dropdown after selection', async ({ page }) => {
      const langButton = page.locator('button').filter({ hasText: 'EN' }).first()
      await langButton.click()
      await page.waitForTimeout(200)

      await page.locator('text=Español').click()
      await page.waitForTimeout(300)

      // Dropdown should be closed - English option should not be visible
      await expect(page.locator('text=English')).not.toBeVisible()
    })

    test('should allow typing in search input', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await searchInput.fill('concrete')
      await expect(searchInput).toHaveValue('concrete')
    })

    test('should display empty state before search', async ({ page }) => {
      await expect(page.locator('text=Search for construction work items')).toBeVisible()
    })

    test('should perform search and display results', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await searchInput.fill('concrete')

      const searchButton = page.getByRole('button', { name: /^Search$/i })
      await searchButton.click()

      // Wait for search to complete
      await page.waitForTimeout(1000)

      // Check for search results
      await expect(page.locator('text=Search Results')).toBeVisible()
    })

    test('should trigger search on Enter key', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await searchInput.fill('steel')
      await searchInput.press('Enter')

      await page.waitForTimeout(1000)

      await expect(page.locator('text=Search Results')).toBeVisible()
    })

    test('should display Add button for search results', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await searchInput.fill('concrete')

      await page.getByRole('button', { name: /^Search$/i }).click()
      await page.waitForTimeout(1000)

      const addButtons = page.getByRole('button', { name: /Add/i })
      await expect(addButtons.first()).toBeVisible()
    })
  })

  test.describe('AI Classification Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /AI Classification/i }).click()
      await page.waitForTimeout(300)
    })

    test('should display BIM Element Classification title', async ({ page }) => {
      await expect(page.locator('text=BIM Element Classification')).toBeVisible()
    })

    test('should display upload subtitle', async ({ page }) => {
      await expect(page.locator('text=Upload an Excel file with BIM elements')).toBeVisible()
    })

    test('should display upload dropzone', async ({ page }) => {
      await expect(page.locator('text=Drop Excel file with BIM elements')).toBeVisible()
    })

    test('should display supported file info', async ({ page }) => {
      await expect(page.locator('text=Supports .xlsx with columns')).toBeVisible()
    })

    test('should display Classify Elements button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Classify Elements/i })).toBeVisible()
    })

    test('should display "Powered by Gemini AI" text', async ({ page }) => {
      await expect(page.locator('text=Powered by')).toBeVisible()
      await expect(page.locator('text=Gemini AI')).toBeVisible()
    })

    test('should show loading state when classifying', async ({ page }) => {
      await page.getByRole('button', { name: /Classify Elements/i }).click()

      await expect(page.getByRole('button', { name: /Classifying with AI/i })).toBeVisible()
    })

    test('should display classification results after processing', async ({ page }) => {
      await page.getByRole('button', { name: /Classify Elements/i }).click()

      // Wait for classification to complete
      await page.waitForTimeout(2500)

      await expect(page.locator('text=Classification Results')).toBeVisible()
    })

    test('should display Add All to Estimate button in results', async ({ page }) => {
      await page.getByRole('button', { name: /Classify Elements/i }).click()
      await page.waitForTimeout(2500)

      await expect(page.getByRole('button', { name: /Add All to Estimate/i })).toBeVisible()
    })

    test('should display confidence badges in results', async ({ page }) => {
      await page.getByRole('button', { name: /Classify Elements/i }).click()
      await page.waitForTimeout(2500)

      // Check for percentage badges
      await expect(page.locator('text=/\\d+%/')).toBeVisible()
    })
  })

  test.describe('Cost Calculation Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /Cost Calculation/i }).click()
      await page.waitForTimeout(300)
    })

    test('should display Cost Calculation title', async ({ page }) => {
      await expect(page.locator('text=Cost Calculation')).toBeVisible()
    })

    test('should display Export Excel button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Export Excel/i })).toBeVisible()
    })

    test('should display Export PDF button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Export PDF/i })).toBeVisible()
    })

    test('should display empty state when no items added', async ({ page }) => {
      await expect(page.locator('text=No items added yet')).toBeVisible()
      await expect(page.locator('text=Search for work items or classify BIM elements')).toBeVisible()
    })

    test('should display cost table when items exist', async ({ page }) => {
      // First add items via search
      await page.getByRole('button', { name: /Semantic Search/i }).click()
      await page.waitForTimeout(300)

      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await searchInput.fill('concrete')
      await page.getByRole('button', { name: /^Search$/i }).click()
      await page.waitForTimeout(1000)

      // Add first item
      const addButton = page.getByRole('button', { name: /Add/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)

      // Switch back to Cost Calculation
      await page.getByRole('button', { name: /Cost Calculation/i }).click()
      await page.waitForTimeout(300)

      // Check for table headers
      await expect(page.locator('th:has-text("Code")')).toBeVisible()
      await expect(page.locator('th:has-text("Description")')).toBeVisible()
      await expect(page.locator('th:has-text("Unit")')).toBeVisible()
      await expect(page.locator('th:has-text("Unit Price")')).toBeVisible()
      await expect(page.locator('th:has-text("Quantity")')).toBeVisible()
      await expect(page.locator('th:has-text("Total")')).toBeVisible()
    })

    test('should display Grand Total when items exist', async ({ page }) => {
      // Add items first
      await page.getByRole('button', { name: /Semantic Search/i }).click()
      await page.waitForTimeout(300)

      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await searchInput.fill('concrete')
      await page.getByRole('button', { name: /^Search$/i }).click()
      await page.waitForTimeout(1000)

      await page.getByRole('button', { name: /Add/i }).first().click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: /Cost Calculation/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('text=Grand Total')).toBeVisible()
    })

    test('should display quantity controls for items', async ({ page }) => {
      // Add items first
      await page.getByRole('button', { name: /Semantic Search/i }).click()
      await page.waitForTimeout(300)

      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await searchInput.fill('concrete')
      await page.getByRole('button', { name: /^Search$/i }).click()
      await page.waitForTimeout(1000)

      await page.getByRole('button', { name: /Add/i }).first().click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: /Cost Calculation/i }).click()
      await page.waitForTimeout(300)

      // Check for plus/minus buttons
      const minusButtons = page.locator('button').filter({ has: page.locator('svg') }).filter({ hasText: '' })
      await expect(minusButtons.first()).toBeVisible()
    })

    test('should display delete button for items', async ({ page }) => {
      // Add items first
      await page.getByRole('button', { name: /Semantic Search/i }).click()
      await page.waitForTimeout(300)

      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await searchInput.fill('concrete')
      await page.getByRole('button', { name: /^Search$/i }).click()
      await page.waitForTimeout(1000)

      await page.getByRole('button', { name: /Add/i }).first().click()
      await page.waitForTimeout(500)

      await page.getByRole('button', { name: /Cost Calculation/i }).click()
      await page.waitForTimeout(300)

      // Check for trash icon button (delete)
      const trashButtons = page.locator('button').filter({ has: page.locator('svg') })
      expect(await trashButtons.count()).toBeGreaterThan(0)
    })

    test('should click Export Excel button', async ({ page }) => {
      const exportButton = page.getByRole('button', { name: /Export Excel/i })
      await exportButton.click()
      await page.waitForTimeout(200)
    })

    test('should click Export PDF button', async ({ page }) => {
      const exportButton = page.getByRole('button', { name: /Export PDF/i })
      await exportButton.click()
      await page.waitForTimeout(200)
    })
  })

  test.describe('History Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('button', { name: /History/i }).click()
      await page.waitForTimeout(300)
    })

    test('should display Recent Estimates title', async ({ page }) => {
      await expect(page.locator('text=Recent Estimates')).toBeVisible()
    })

    test('should display subtitle with estimate count', async ({ page }) => {
      await expect(page.locator('text=/\\d+ estimates in the last 7 days/')).toBeVisible()
    })

    test('should display Export All button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Export All/i })).toBeVisible()
    })

    test('should display history table with headers', async ({ page }) => {
      await expect(page.locator('th:has-text("Estimate Name")')).toBeVisible()
      await expect(page.locator('th:has-text("Items")')).toBeVisible()
      await expect(page.locator('th:has-text("Total Cost")')).toBeVisible()
      await expect(page.locator('th:has-text("Language")')).toBeVisible()
      await expect(page.locator('th:has-text("Date")')).toBeVisible()
    })

    test('should display recent estimate data', async ({ page }) => {
      // Check for at least one estimate name
      await expect(page.locator('td').filter({ hasText: /Hospital|Office|Residential|Parking|School/ }).first()).toBeVisible()
    })

    test('should display language badges in history', async ({ page }) => {
      // Check for language code badges (EN, DE, RU, ES, etc.)
      const badges = page.locator('td').filter({ hasText: /EN|DE|RU|ES/ })
      await expect(badges.first()).toBeVisible()
    })

    test('should click Export All button', async ({ page }) => {
      const exportButton = page.getByRole('button', { name: /Export All/i })
      await exportButton.click()
      await page.waitForTimeout(200)
    })
  })

  test.describe('Integration Flow', () => {
    test('should complete full workflow: search, add item, view in cost table', async ({ page }) => {
      // Step 1: Search for items
      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await searchInput.fill('concrete')
      await page.getByRole('button', { name: /^Search$/i }).click()
      await page.waitForTimeout(1000)

      // Step 2: Add item to cost estimate
      await page.getByRole('button', { name: /Add/i }).first().click()
      await page.waitForTimeout(500)

      // Step 3: Switch to Cost Calculation tab
      await page.getByRole('button', { name: /Cost Calculation/i }).click()
      await page.waitForTimeout(300)

      // Step 4: Verify item appears in cost table
      await expect(page.locator('text=Cost Calculation')).toBeVisible()
      await expect(page.locator('text=Grand Total')).toBeVisible()
    })

    test('should complete classification workflow', async ({ page }) => {
      // Step 1: Go to AI Classification tab
      await page.getByRole('button', { name: /AI Classification/i }).click()
      await page.waitForTimeout(300)

      // Step 2: Start classification
      await page.getByRole('button', { name: /Classify Elements/i }).click()
      await page.waitForTimeout(2500)

      // Step 3: Verify results appear
      await expect(page.locator('text=Classification Results')).toBeVisible()

      // Step 4: Add to cost estimate
      await page.getByRole('button', { name: /Add All to Estimate/i }).click()
      await page.waitForTimeout(500)

      // Step 5: Switch to Cost Calculation
      await page.getByRole('button', { name: /Cost Calculation/i }).click()
      await page.waitForTimeout(300)

      // Step 6: Verify items in cost table
      await expect(page.locator('text=Grand Total')).toBeVisible()
    })

    test('should switch languages and maintain state', async ({ page }) => {
      // Search with EN
      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await searchInput.fill('concrete')

      // Switch to DE
      const langButton = page.locator('button').filter({ hasText: 'EN' }).first()
      await langButton.click()
      await page.waitForTimeout(200)
      await page.locator('text=Deutsch').click()
      await page.waitForTimeout(300)

      // Verify search query is still there
      await expect(searchInput).toHaveValue('concrete')
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.locator('h1')
      await expect(h1).toHaveCount(1)
      await expect(h1).toHaveText('CWICR Cost Estimation')
    })

    test('should have accessible buttons with labels', async ({ page }) => {
      const searchButton = page.getByRole('button', { name: /^Search$/i })
      await expect(searchButton).toBeVisible()

      const tabButtons = page.locator('[role="button"]').filter({ hasText: /Semantic Search|AI Classification|Cost Calculation|History/ })
      expect(await tabButtons.count()).toBe(4)
    })

    test('should have input fields with placeholders', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Search work items"]')
      await expect(searchInput).toHaveAttribute('placeholder')
    })
  })
})
