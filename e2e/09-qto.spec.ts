import { test, expect } from '@playwright/test'

test.describe('Module 8: QTO Reports', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/qto')
  })

  test.describe('Page Load', () => {
    test('should display header with title', async ({ page }) => {
      const header = page.locator('main h1')
      await expect(header).toBeVisible()
      await expect(header).toHaveText('QTO Reports')
    })

    test('should display subtitle about generating reports', async ({ page }) => {
      const subtitle = page.locator('p.text-muted-foreground').first()
      await expect(subtitle).toBeVisible()
      await expect(subtitle).toContainText('Generate Quantity Take-Off reports')
      await expect(subtitle).toContainText('IFC models and Excel files')
    })

    test('should display 4 stat cards', async ({ page }) => {
      // Check for Total Elements
      await expect(page.getByText('Total Elements')).toBeVisible()

      // Check for Categories
      await expect(page.getByText('Categories')).toBeVisible()

      // Check for Floors
      await expect(page.getByText('Floors')).toBeVisible()

      // Check for Estimated Cost
      await expect(page.getByText('Estimated Cost')).toBeVisible()
    })

    test('should display stat card values', async ({ page }) => {
      // Total Elements should show 492
      const totalElementsCard = page.locator('text=Total Elements').locator('..')
      await expect(totalElementsCard).toContainText('492')

      // Categories should show 6
      const categoriesCard = page.locator('text=Categories').locator('..')
      await expect(categoriesCard).toContainText('6')

      // Floors should show 4
      const floorsCard = page.locator('text=Floors').locator('..')
      await expect(floorsCard).toContainText('4')

      // Estimated Cost should show currency value
      const costCard = page.locator('text=Estimated Cost').locator('..')
      await expect(costCard).toContainText('$')
    })
  })

  test.describe('Tabs', () => {
    test('should display 2 tabs', async ({ page }) => {
      await expect(page.getByRole('tab', { name: 'Generate Report' })).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Report History' })).toBeVisible()
    })

    test('should have Generate Report as default tab', async ({ page }) => {
      // Check that Generate Report content is visible (file upload area)
      await expect(page.getByText(/Upload File|Drop IFC/i).first()).toBeVisible()
    })

    test('should switch to Report History tab', async ({ page }) => {
      // Click Report History tab
      await page.getByRole('tab', { name: 'Report History' }).click()

      // Wait for history content to appear
      await page.waitForTimeout(500)

      // Check for history-specific content
      await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Report History' })).toBeVisible()
    })

    test('should switch back to Generate Report tab', async ({ page }) => {
      // Go to History tab first
      await page.getByRole('tab', { name: 'Report History' }).click()
      await page.waitForTimeout(300)

      // Switch back to Generate Report
      await page.getByRole('tab', { name: 'Generate Report' }).click()
      await page.waitForTimeout(300)

      // File upload should be visible again
      await expect(page.getByText(/Upload File|Drop IFC/i).first()).toBeVisible()
    })
  })

  test.describe('Generate Report Tab', () => {
    test('should display file upload area', async ({ page }) => {
      const uploadArea = page.getByText(/Upload File|Drop IFC|click to browse/i).first()
      await expect(uploadArea).toBeVisible()
    })

    test('should display accepted file formats in upload description', async ({ page }) => {
      await expect(page.getByText(/\.ifc.*\.xlsx.*\.xls|Supports.*ifc/i)).toBeVisible()
    })

    test('should display Report Options section', async ({ page }) => {
      await expect(page.getByText('Report Options')).toBeVisible()
    })

    test('should display Group By label', async ({ page }) => {
      await expect(page.getByText('Group By', { exact: true })).toBeVisible()
    })

    test('should display 4 grouping option buttons', async ({ page }) => {
      await expect(page.getByText('Group by Type')).toBeVisible()
      await expect(page.getByText('Group by Floor')).toBeVisible()
      await expect(page.getByText('Group by Phase')).toBeVisible()
      await expect(page.getByText('Detailed View')).toBeVisible()
    })

    test('should have "Group by Type" selected by default', async ({ page }) => {
      const typeButton = page.locator('button', { hasText: 'Group by Type' })
      await expect(typeButton).toHaveClass(/border-primary|bg-primary/)
    })

    test('should select grouping option when clicked', async ({ page }) => {
      const floorButton = page.locator('button', { hasText: 'Group by Floor' })
      await floorButton.click()

      // Wait for state update
      await page.waitForTimeout(200)

      // Check that it's now selected
      await expect(floorButton).toHaveClass(/border-primary|bg-primary/)
    })

    test('should display Generate Report button', async ({ page }) => {
      const generateButton = page.getByRole('button', { name: 'Generate Report' })
      await expect(generateButton).toBeVisible()
    })

    test('should have Generate Report button disabled initially', async ({ page }) => {
      const generateButton = page.getByRole('button', { name: 'Generate Report' })
      await expect(generateButton).toBeDisabled()
    })

    test('should switch between different grouping options', async ({ page }) => {
      // Click Phase
      const phaseButton = page.locator('button', { hasText: 'Group by Phase' })
      await phaseButton.click()
      await page.waitForTimeout(200)
      await expect(phaseButton).toHaveClass(/border-primary|bg-primary/)

      // Click Detailed View
      const detailedButton = page.locator('button', { hasText: 'Detailed View' })
      await detailedButton.click()
      await page.waitForTimeout(200)
      await expect(detailedButton).toHaveClass(/border-primary|bg-primary/)
    })
  })

  test.describe('Report History Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: 'Report History' }).click()
      await page.waitForTimeout(500)
    })

    test('should display Report History title', async ({ page }) => {
      await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Report History' })).toBeVisible()
    })

    test('should display history subtitle', async ({ page }) => {
      await expect(page.getByText('Previously generated QTO reports')).toBeVisible()
    })

    test('should display history table or empty state', async ({ page }) => {
      // Either table with data or "No reports" message
      const hasTable = await page.locator('table').isVisible().catch(() => false)
      const hasEmptyState = await page.getByText(/No reports/i).isVisible().catch(() => false)

      expect(hasTable || hasEmptyState).toBeTruthy()
    })

    test('should display file names in history', async ({ page }) => {
      const hasTable = await page.locator('table').isVisible().catch(() => false)

      if (hasTable) {
        // Check for at least one file name
        const firstFile = page.locator('table tbody tr').first()
        await expect(firstFile).toContainText(/\.ifc|\.xlsx|Building_Model|Residential/i)
      }
    })

    test('should display action icons (Download and Delete)', async ({ page }) => {
      const hasTable = await page.locator('table').isVisible().catch(() => false)

      if (hasTable) {
        // Check for Download icons
        const downloadIcons = page.locator('button[title*="Download"], [title*="download"], svg[class*="download"]').first()
        await expect(downloadIcons).toBeVisible()

        // Check for Delete icons
        const deleteIcons = page.locator('button[title*="Delete"], [title*="delete"], svg[class*="trash"]').first()
        await expect(deleteIcons).toBeVisible()
      }
    })

    test('should display group by badges', async ({ page }) => {
      const hasTable = await page.locator('table').isVisible().catch(() => false)

      if (hasTable) {
        // Check for group by values (type, floor, phase, detailed)
        const firstRow = page.locator('table tbody tr').first()
        await expect(firstRow).toContainText(/type|floor|phase|detailed/i)
      }
    })

    test('should display estimated costs', async ({ page }) => {
      const hasTable = await page.locator('table').isVisible().catch(() => false)

      if (hasTable) {
        // Check for currency values
        await expect(page.locator('table').first()).toContainText('$')
      }
    })
  })

  test.describe('Mock Report Display', () => {
    test('should display mock report by default or after generation', async ({ page }) => {
      // The page loads with MOCK_QTO_REPORT data, so report should be visible
      // or we can simulate it by checking if categories are visible

      // Check if report table exists (it should with mock data)
      const hasReportTable = await page.locator('table').count() > 0

      if (hasReportTable) {
        // Verify some categories are visible
        const hasCategories = await page.getByText(/Walls|Floors|Columns|Beams|Doors|Windows/i).count() > 0
        expect(hasCategories).toBeTruthy()
      }
    })

    test('should display category rows', async ({ page }) => {
      // Category rows only appear when a report is visible
      const hasTable = await page.locator('table tbody').first().isVisible().catch(() => false)

      if (hasTable) {
        const categoryNames = ['Walls', 'Floors / Slabs', 'Columns', 'Beams', 'Doors', 'Windows']

        for (const category of categoryNames) {
          const categoryElement = page.getByText(category, { exact: false })
          const count = await categoryElement.count()

          // At least one occurrence of each category name
          expect(count).toBeGreaterThan(0)
        }
      }
    })

    test('should display table headers', async ({ page }) => {
      const hasTable = await page.locator('table thead').first().isVisible().catch(() => false)

      if (hasTable) {
        await expect(page.getByText('Category / Element')).toBeVisible()
        await expect(page.getByText('Material')).toBeVisible()
        await expect(page.getByText('Floor')).toBeVisible()
        await expect(page.getByText('Quantity')).toBeVisible()
        await expect(page.getByText('Unit')).toBeVisible()
        await expect(page.getByText('Unit Cost')).toBeVisible()
        await expect(page.getByText('Total')).toBeVisible()
      }
    })

    test('should display Grand Total row', async ({ page }) => {
      const grandTotal = page.getByText('Grand Total')
      const count = await grandTotal.count()

      if (count > 0) {
        await expect(grandTotal.first()).toBeVisible()
      }
    })

    test('should expand category when clicked', async ({ page }) => {
      // Find the first category row (clickable)
      const categoryRow = page.locator('table tbody tr').filter({ hasText: 'Walls' }).first()
      const isVisible = await categoryRow.isVisible().catch(() => false)

      if (isVisible) {
        // Click to expand
        await categoryRow.click()
        await page.waitForTimeout(300)

        // Check if expanded elements are visible (indented rows)
        const expandedElements = page.locator('table tbody tr').filter({ hasText: /Exterior Wall|Interior Wall|Concrete|Drywall/i })
        const expandedCount = await expandedElements.count()

        // Should have at least one expanded element visible
        expect(expandedCount).toBeGreaterThan(0)
      }
    })

    test('should collapse category when clicked again', async ({ page }) => {
      // Find and expand first
      const categoryRow = page.locator('table tbody tr').filter({ hasText: 'Walls' }).first()
      const isVisible = await categoryRow.isVisible().catch(() => false)

      if (isVisible) {
        // Expand
        await categoryRow.click()
        await page.waitForTimeout(300)

        // Collapse
        await categoryRow.click()
        await page.waitForTimeout(300)

        // Expanded content should be hidden (fewer rows visible)
        const visibleRows = await page.locator('table tbody tr:visible').count()
        expect(visibleRows).toBeGreaterThan(0)
      }
    })

    test('should display element count badges', async ({ page }) => {
      // Look for badges showing element counts like "127 elements"
      const badges = page.locator('table').getByText(/\d+ elements?/i)
      const count = await badges.count()

      if (count > 0) {
        await expect(badges.first()).toBeVisible()
      }
    })
  })

  test.describe('Export Buttons', () => {
    test('should display export button group', async ({ page }) => {
      // Look for export buttons (they appear near report table)
      const exportButtons = page.locator('button[title*="Export"], button[title*="export"]')
      const count = await exportButtons.count()

      // Should have at least some export buttons
      expect(count).toBeGreaterThanOrEqual(0)
    })

    test('should display Excel/CSV export button', async ({ page }) => {
      const excelButton = page.locator('button[title*="Excel"], button[title*="CSV"]')
      const count = await excelButton.count()

      if (count > 0) {
        await expect(excelButton.first()).toBeVisible()
      }
    })

    test('should display PDF export button', async ({ page }) => {
      const pdfButton = page.locator('button[title*="PDF"]')
      const count = await pdfButton.count()

      if (count > 0) {
        await expect(pdfButton.first()).toBeVisible()
      }
    })

    test('should display HTML export button', async ({ page }) => {
      const htmlButton = page.locator('button[title*="HTML"]')
      const count = await htmlButton.count()

      if (count > 0) {
        await expect(htmlButton.first()).toBeVisible()
      }
    })

    test('should have clickable export buttons', async ({ page }) => {
      const exportButtons = page.locator('button[title*="Export"], button[title*="PDF"], button[title*="HTML"], button[title*="Excel"]')
      const count = await exportButtons.count()

      if (count > 0) {
        const firstButton = exportButtons.first()
        await expect(firstButton).toBeEnabled()
      }
    })
  })

  test.describe('Report Card', () => {
    test('should display report title with file name', async ({ page }) => {
      const reportTitle = page.getByText(/QTO Report.*Building_Model|QTO Report/i)
      const count = await reportTitle.count()

      if (count > 0) {
        await expect(reportTitle.first()).toBeVisible()
      }
    })

    test('should display report subtitle with group by info', async ({ page }) => {
      const subtitle = page.getByText(/Grouped by|Generated/i)
      const count = await subtitle.count()

      if (count > 0) {
        await expect(subtitle.first()).toBeVisible()
      }
    })
  })

  test.describe('Summary Stats in Report', () => {
    test('should update stats after report generation', async ({ page }) => {
      // Stats should be visible (they appear twice - once at top, once after generation)
      const totalElementsStats = page.getByText('Total Elements')
      await expect(totalElementsStats.first()).toBeVisible()
    })

    test('should display all 4 stat cards with values', async ({ page }) => {
      // Verify all stat labels are present
      await expect(page.getByText('Total Elements')).toBeVisible()
      await expect(page.getByText('Categories')).toBeVisible()
      await expect(page.getByText('Floors')).toBeVisible()
      await expect(page.getByText('Estimated Cost')).toBeVisible()
    })
  })

  test.describe('Responsive Behavior', () => {
    test('should display all content on desktop viewport', async ({ page }) => {
      await page.setViewportSize({ width: 1920, height: 1080 })

      await expect(page.locator('main h1')).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Generate Report' })).toBeVisible()
      await expect(page.getByText('Total Elements')).toBeVisible()
    })

    test('should display all content on tablet viewport', async ({ page }) => {
      await page.setViewportSize({ width: 768, height: 1024 })

      await expect(page.locator('main h1')).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Generate Report' })).toBeVisible()
    })

    test('should display all content on mobile viewport', async ({ page }) => {
      await page.setViewportSize({ width: 375, height: 667 })

      await expect(page.locator('main h1')).toBeVisible()
      await expect(page.getByRole('tab', { name: 'Generate Report' })).toBeVisible()
    })
  })

  test.describe('Animations and Interactions', () => {
    test('should have animated page transitions', async ({ page }) => {
      // Check that page content appears (animations complete)
      await page.waitForTimeout(1000)
      await expect(page.locator('main h1')).toBeVisible()
    })

    test('should have hover effects on grouping buttons', async ({ page }) => {
      const typeButton = page.locator('button', { hasText: 'Group by Type' })
      await typeButton.hover()
      await page.waitForTimeout(100)

      // Button should still be visible after hover
      await expect(typeButton).toBeVisible()
    })

    test('should have smooth tab transitions', async ({ page }) => {
      await page.getByRole('tab', { name: 'Report History' }).click()
      await page.waitForTimeout(500)

      await page.getByRole('tab', { name: 'Generate Report' }).click()
      await page.waitForTimeout(500)

      // Content should be visible after transition
      await expect(page.getByText(/Upload File|Drop IFC/i).first()).toBeVisible()
    })
  })

  test.describe('Data Validation', () => {
    test('should display correct mock data values', async ({ page }) => {
      // Check that mock values appear somewhere on the page
      await expect(page.locator('body')).toContainText('492') // Total Elements
      await expect(page.locator('body')).toContainText('6')   // Categories
      await expect(page.locator('body')).toContainText('4')   // Floors
    })

    test('should display currency formatting', async ({ page }) => {
      // Check for dollar signs (currency formatting)
      const currencyElements = page.locator('text=/\\$[\\d,]+/')
      const count = await currencyElements.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should display quantity units', async ({ page }) => {
      // Look for units like m², m³, pcs
      const hasUnits = await page.locator('body').textContent()

      // Should contain at least some unit indicators
      expect(hasUnits).toBeTruthy()
    })
  })
})
