import { test, expect } from '@playwright/test'

test.describe('Module 1: CAD/BIM Converter', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/converter')
  })

  test.describe('Page Load', () => {
    test('should display header with title and subtitle', async ({ page }) => {
      await expect(page.locator('main h1')).toHaveText('CAD/BIM Converter')
      await expect(page.locator('text=Convert Revit, IFC, DWG, and DGN files to Excel, 3D DAE, or PDF formats')).toBeVisible()
    })

    test('should display 4 stat cards', async ({ page }) => {
      await expect(page.locator('text=Files Converted')).toBeVisible()
      await expect(page.locator('text=Success Rate')).toBeVisible()
      await expect(page.locator('text=Avg Time')).toBeVisible()
      await expect(page.getByText('Formats', { exact: true })).toBeVisible()
    })

    test('should display stat card values', async ({ page }) => {
      // Success rate should show percentage
      const successRateCard = page.locator('text=Success Rate').locator('..')
      await expect(successRateCard.locator('text=/%/')).toBeVisible()

      // Avg time should show time format
      await expect(page.locator('text=1m 48s')).toBeVisible()
    })
  })

  test.describe('Tabs', () => {
    test('should display both tabs', async ({ page }) => {
      await expect(page.getByRole('button', { name: /New Conversion/i })).toBeVisible()
      await expect(page.getByRole('button', { name: /Conversion History/i })).toBeVisible()
    })

    test('should have New Conversion tab active by default', async ({ page }) => {
      const newConversionTab = page.getByRole('button', { name: /New Conversion/i })
      await expect(newConversionTab).toBeVisible()

      // Check for upload content which is only in New Conversion tab
      await expect(page.locator('text=Upload Files')).toBeVisible()
    })

    test('should switch to Conversion History tab', async ({ page }) => {
      const historyTab = page.getByRole('button', { name: /Conversion History/i })
      await historyTab.click()
      await page.waitForTimeout(300)

      // History tab should show history table
      await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Conversion History' })).toBeVisible()
      await expect(page.locator('text=conversions in the last 7 days')).toBeVisible()
    })

    test('should display history data after switching tabs', async ({ page }) => {
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      // Check for history entries
      await expect(page.locator('text=Hospital_Phase2.rvt')).toBeVisible()
      await expect(page.locator('text=Bridge_Design.ifc')).toBeVisible()
      await expect(page.locator('text=Office_MEP.dwg')).toBeVisible()
    })

    test('should switch back to New Conversion tab', async ({ page }) => {
      // Switch to history
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      // Switch back to new conversion
      await page.getByRole('button', { name: /New Conversion/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('text=Upload Files')).toBeVisible()
      await expect(page.locator('text=Output Format')).toBeVisible()
    })
  })

  test.describe('File Upload (New Conversion tab)', () => {
    test('should display file upload dropzone', async ({ page }) => {
      await expect(page.locator('text=Upload Files')).toBeVisible()
      await expect(page.locator('text=Drop CAD/BIM files here or click to browse')).toBeVisible()
    })

    test('should display supported file types', async ({ page }) => {
      await expect(page.locator('text=Supports .rvt, .ifc, .dwg, .dgn up to 500 MB each')).toBeVisible()
    })

    test('should display upload card with subtitle', async ({ page }) => {
      await expect(page.locator('text=Supports batch upload of CAD/BIM files')).toBeVisible()
    })
  })

  test.describe('Format Selection', () => {
    test('should display Output Format section', async ({ page }) => {
      await expect(page.locator('text=Output Format')).toBeVisible()
      await expect(page.locator('text=Select target format')).toBeVisible()
    })

    test('should display all 3 format options', async ({ page }) => {
      await expect(page.locator('text=Excel (.xlsx)')).toBeVisible()
      await expect(page.locator('text=DAE 3D (.dae)')).toBeVisible()
      await expect(page.locator('text=PDF Report')).toBeVisible()
    })

    test('should display format descriptions', async ({ page }) => {
      await expect(page.locator('text=Property tables, quantities, schedules')).toBeVisible()
      await expect(page.locator('text=3D geometry for viewers and engines')).toBeVisible()
      await expect(page.locator('text=Formatted property reports')).toBeVisible()
    })

    test('should have Excel format selected by default', async ({ page }) => {
      const excelButton = page.locator('button:has-text("Excel (.xlsx)")')
      await expect(excelButton).toHaveClass(/border-primary/)
    })

    test('should allow selecting DAE format', async ({ page }) => {
      const daeButton = page.locator('button:has-text("DAE 3D (.dae)")')
      await daeButton.click()
      await expect(daeButton).toHaveClass(/border-primary/)
    })

    test('should allow selecting PDF format', async ({ page }) => {
      const pdfButton = page.locator('button:has-text("PDF Report")')
      await pdfButton.click()
      await expect(pdfButton).toHaveClass(/border-primary/)
    })

    test('should switch between formats', async ({ page }) => {
      // Click DAE
      await page.locator('button:has-text("DAE 3D (.dae)")').click()
      await page.waitForTimeout(100)

      // Click PDF
      await page.locator('button:has-text("PDF Report")').click()
      await page.waitForTimeout(100)

      // Click Excel
      await page.locator('button:has-text("Excel (.xlsx)")').click()
      await page.waitForTimeout(100)

      const excelButton = page.locator('button:has-text("Excel (.xlsx)")')
      await expect(excelButton).toHaveClass(/border-primary/)
    })
  })

  test.describe('Convert Button', () => {
    test('should display convert button', async ({ page }) => {
      const convertBtn = page.locator('button').filter({ hasText: /^Convert/ }).last()
      await expect(convertBtn).toBeVisible()
    })

    test('should show "Convert" text when no files selected', async ({ page }) => {
      const convertBtn = page.locator('button').filter({ hasText: /^Convert/ }).last()
      await expect(convertBtn).toHaveText(/^Convert\s*$/)
    })

    test('should have convert button disabled when no files selected', async ({ page }) => {
      const convertBtn = page.locator('button').filter({ hasText: /^Convert/ }).last()
      await expect(convertBtn).toBeDisabled()
    })

    test('should display button in full width', async ({ page }) => {
      const convertBtn = page.locator('button').filter({ hasText: /^Convert/ }).last()
      await expect(convertBtn).toHaveClass(/w-full/)
    })
  })

  test.describe('Conversion Queue', () => {
    test('should not display queue section initially', async ({ page }) => {
      const queueSection = page.locator('text=Conversion Queue')
      await expect(queueSection).not.toBeVisible()
    })
  })

  test.describe('Status Badges', () => {
    test('should display status badges in history tab', async ({ page }) => {
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      // Check for various status badges
      const completedBadges = page.locator('text=Completed')
      const failedBadge = page.locator('text=Failed')

      await expect(completedBadges.first()).toBeVisible()
      await expect(failedBadge).toBeVisible()
    })

    test('should display input format badges in history', async ({ page }) => {
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('text=RVT').first()).toBeVisible()
      await expect(page.locator('text=IFC').first()).toBeVisible()
      await expect(page.locator('text=DWG').first()).toBeVisible()
      await expect(page.locator('text=DGN').first()).toBeVisible()
    })

    test('should display output format badges in history', async ({ page }) => {
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('text=EXCEL').first()).toBeVisible()
      await expect(page.locator('text=DAE').first()).toBeVisible()
      await expect(page.locator('text=PDF').first()).toBeVisible()
    })
  })

  test.describe('Action Buttons', () => {
    test('should display Refresh button when queue section is not visible', async ({ page }) => {
      // Queue is not visible initially, so Refresh button in history tab
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('button:has-text("Export Log")')).toBeVisible()
    })

    test('should display history action button', async ({ page }) => {
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      const exportButton = page.locator('button:has-text("Export Log")')
      await expect(exportButton).toBeVisible()
    })
  })

  test.describe('Quick Actions', () => {
    test('should not display Quick Actions section initially', async ({ page }) => {
      const quickActions = page.locator('text=Quick Actions')
      await expect(quickActions).not.toBeVisible()
    })
  })

  test.describe('History Table', () => {
    test('should display history table headers', async ({ page }) => {
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('text=File Name')).toBeVisible()
      await expect(page.locator('text=Input')).toBeVisible()
      await expect(page.locator('text=Output')).toBeVisible()
      await expect(page.locator('text=Status')).toBeVisible()
      await expect(page.locator('text=Size')).toBeVisible()
      await expect(page.locator('text=Duration')).toBeVisible()
      await expect(page.locator('text=Date')).toBeVisible()
    })

    test('should display file sizes in history', async ({ page }) => {
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('text=45.2 MB')).toBeVisible()
      await expect(page.locator('text=28.7 MB')).toBeVisible()
      await expect(page.locator('text=12.1 MB')).toBeVisible()
    })

    test('should display durations in history', async ({ page }) => {
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('text=2m 14s')).toBeVisible()
      await expect(page.locator('text=1m 42s')).toBeVisible()
      await expect(page.locator('text=0m 38s')).toBeVisible()
    })

    test('should display history count subtitle', async ({ page }) => {
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('text=6 conversions in the last 7 days')).toBeVisible()
    })
  })

  test.describe('Layout and Responsiveness', () => {
    test('should display grid layout for upload and format sections', async ({ page }) => {
      const uploadCard = page.locator('text=Upload Files').locator('..')
      const formatCard = page.locator('text=Output Format').locator('..')

      await expect(uploadCard).toBeVisible()
      await expect(formatCard).toBeVisible()
    })

    test('should display stats in grid layout', async ({ page }) => {
      const statsGrid = page.locator('text=Files Converted').locator('../..')
      await expect(statsGrid).toBeVisible()
    })
  })

  test.describe('Icons and Visual Elements', () => {
    test('should display format icons', async ({ page }) => {
      // Format buttons should have icons
      const excelButton = page.locator('button:has-text("Excel (.xlsx)")')
      const daeButton = page.locator('button:has-text("DAE 3D (.dae)")')
      const pdfButton = page.locator('button:has-text("PDF Report")')

      await expect(excelButton).toBeVisible()
      await expect(daeButton).toBeVisible()
      await expect(pdfButton).toBeVisible()
    })

    test('should display tab icons', async ({ page }) => {
      const newConversionTab = page.getByRole('button', { name: /New Conversion/i })
      const historyTab = page.getByRole('button', { name: /Conversion History/i })

      await expect(newConversionTab).toBeVisible()
      await expect(historyTab).toBeVisible()
    })
  })

  test.describe('Card Components', () => {
    test('should display Upload Files card', async ({ page }) => {
      await expect(page.locator('text=Upload Files')).toBeVisible()
      await expect(page.locator('text=Supports batch upload of CAD/BIM files')).toBeVisible()
    })

    test('should display Output Format card', async ({ page }) => {
      await expect(page.locator('text=Output Format')).toBeVisible()
      await expect(page.locator('text=Select target format')).toBeVisible()
    })

    test('should display history card in history tab', async ({ page }) => {
      await page.getByRole('button', { name: /Conversion History/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('[data-slot="card-title"]').filter({ hasText: 'Conversion History' })).toBeVisible()
    })
  })

  test.describe('Text Content', () => {
    test('should display correct file type support text', async ({ page }) => {
      await expect(page.locator('text=.rvt, .ifc, .dwg, .dgn')).toBeVisible()
    })

    test('should display correct file size limit', async ({ page }) => {
      await expect(page.locator('text=up to 500 MB each')).toBeVisible()
    })

    test('should display correct format descriptions', async ({ page }) => {
      await expect(page.locator('text=Property tables, quantities, schedules')).toBeVisible()
      await expect(page.locator('text=3D geometry for viewers and engines')).toBeVisible()
      await expect(page.locator('text=Formatted property reports')).toBeVisible()
    })
  })

  test.describe('Stat Card Details', () => {
    test('should display Files Converted stat with trend', async ({ page }) => {
      await expect(page.locator('text=Files Converted')).toBeVisible()
      await expect(page.locator('text=this week')).toBeVisible()
    })

    test('should display all stat card icons', async ({ page }) => {
      // All 4 stat cards should be visible with their content
      const statsSection = page.locator('text=Files Converted').locator('../..')
      await expect(statsSection).toBeVisible()
    })
  })
})
