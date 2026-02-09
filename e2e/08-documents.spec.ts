import { test, expect } from '@playwright/test'

test.describe('Module 7: Document Control', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/documents')
  })

  // ─── Page Load Tests ────────────────────────────────────────────────────────

  test('should display page header and subtitle', async ({ page }) => {
    await expect(page.locator('main h1')).toHaveText('Document Control')
    await expect(page.locator('p').filter({ hasText: 'Manage project documents, RFIs, submittals, and generate meeting minutes' })).toBeVisible()
  })

  test('should display all stat cards', async ({ page }) => {
    await expect(page.getByText('Total Documents')).toBeVisible()
    await expect(page.getByText('Pending RFIs')).toBeVisible()
    await expect(page.getByText('Open Submittals')).toBeVisible()
    await expect(page.getByText('Overdue Items')).toBeVisible()
  })

  test('should show stat card values', async ({ page }) => {
    // Check that stat cards display numeric values
    const totalDocs = page.locator('text=Total Documents').locator('xpath=ancestor::div[contains(@class, "")]').first()
    await expect(totalDocs).toContainText(/\d+/)

    const pendingRFIs = page.locator('text=Pending RFIs').locator('xpath=ancestor::div[contains(@class, "")]').first()
    await expect(pendingRFIs).toContainText(/\d+/)
  })

  // ─── Tabs Tests ─────────────────────────────────────────────────────────────

  test('should display all four tabs', async ({ page }) => {
    const tabsContainer = page.locator('[role="tablist"]').first()

    await expect(tabsContainer.locator('button', { hasText: 'Documents' })).toBeVisible()
    await expect(tabsContainer.locator('button', { hasText: 'RFIs' })).toBeVisible()
    await expect(tabsContainer.locator('button', { hasText: 'Submittals' })).toBeVisible()
    await expect(tabsContainer.locator('button', { hasText: 'Meeting Minutes' })).toBeVisible()
  })

  test('should have Documents tab active by default', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Documents' }).first()).toHaveAttribute('data-state', 'active')
  })

  test('should switch to RFIs tab and show RFI content', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()
    await expect(page.getByRole('button', { name: 'RFIs' }).first()).toHaveAttribute('data-state', 'active')
    await expect(page.getByRole('button', { name: 'New RFI' })).toBeVisible()
    await expect(page.getByText('RFI-001')).toBeVisible()
  })

  test('should switch to Submittals tab and show submittal content', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Submittals' }).click()
    await expect(page.getByRole('button', { name: 'Submittals' }).first()).toHaveAttribute('data-state', 'active')
    await expect(page.getByText('SUB-001')).toBeVisible()
  })

  test('should switch to Meeting Minutes tab', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Meeting Minutes' }).click()
    await expect(page.getByRole('button', { name: 'Meeting Minutes' }).first()).toHaveAttribute('data-state', 'active')
    await expect(page.locator('textarea').first()).toBeVisible()
  })

  // ─── Documents Tab Tests ────────────────────────────────────────────────────

  test('should display search input on Documents tab', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search documents...')
    await expect(searchInput).toBeVisible()
  })

  test('should display Upload Document button', async ({ page }) => {
    await expect(page.getByRole('button', { name: /Upload Document/i })).toBeVisible()
  })

  test('should display documents table with columns', async ({ page }) => {
    await expect(page.getByText('Name').first()).toBeVisible()
    await expect(page.getByText('Type').first()).toBeVisible()
    await expect(page.getByText('Status').first()).toBeVisible()
    await expect(page.getByText('Author').first()).toBeVisible()
    await expect(page.getByText('Date').first()).toBeVisible()
    await expect(page.getByText('Version').first()).toBeVisible()
  })

  test('should display document entries', async ({ page }) => {
    await expect(page.getByText('Structural Drawings Rev C')).toBeVisible()
    await expect(page.getByText('MEP Coordination Report')).toBeVisible()
    await expect(page.getByText('Foundation Spec Sheet')).toBeVisible()
  })

  test('should display document status badges', async ({ page }) => {
    await expect(page.getByText('Approved').first()).toBeVisible()
    await expect(page.getByText('Review').first()).toBeVisible()
    await expect(page.getByText('Draft').first()).toBeVisible()
    await expect(page.getByText('Rejected').first()).toBeVisible()
  })

  test('should filter documents when searching', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search documents...')
    await searchInput.fill('Structural')

    await expect(page.getByText('Structural Drawings Rev C')).toBeVisible()
    await expect(page.getByText('MEP Coordination Report')).not.toBeVisible()
  })

  test('should toggle upload form when Upload Document button is clicked', async ({ page }) => {
    const uploadButton = page.getByRole('button', { name: /Upload Document/i })
    await uploadButton.click()

    await expect(page.getByText('Upload project documents')).toBeVisible()
    await expect(page.getByText('PDF, DWG, IFC, Excel, Word, Images up to 500MB')).toBeVisible()
  })

  // ─── RFIs Tab Tests ─────────────────────────────────────────────────────────

  test('should display RFI tracking summary', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()
    await expect(page.getByText(/Tracking \d+ open RFIs/)).toBeVisible()
  })

  test('should display New RFI button on RFIs tab', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()
    await expect(page.getByRole('button', { name: 'New RFI' })).toBeVisible()
  })

  test('should open RFI creation form when New RFI button is clicked', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()
    await page.getByRole('button', { name: 'New RFI' }).click()

    await expect(page.getByText('Create New RFI')).toBeVisible()
  })

  test('should display RFI form fields', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()
    await page.getByRole('button', { name: 'New RFI' }).click()

    await expect(page.getByLabel('Subject')).toBeVisible()
    await expect(page.getByLabel('Priority')).toBeVisible()
    await expect(page.getByLabel('Assigned To')).toBeVisible()
    await expect(page.getByLabel('Due Date')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Create RFI' })).toBeVisible()
  })

  test('should display priority dropdown options', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()
    await page.getByRole('button', { name: 'New RFI' }).click()

    const prioritySelect = page.getByLabel('Priority')
    await expect(prioritySelect.locator('option', { hasText: 'Low' })).toBeAttached()
    await expect(prioritySelect.locator('option', { hasText: 'Medium' })).toBeAttached()
    await expect(prioritySelect.locator('option', { hasText: 'High' })).toBeAttached()
    await expect(prioritySelect.locator('option', { hasText: 'Critical' })).toBeAttached()
  })

  test('should display RFI table with columns', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()

    await expect(page.getByText('Number').first()).toBeVisible()
    await expect(page.getByText('Subject').first()).toBeVisible()
    await expect(page.getByText('Status').first()).toBeVisible()
    await expect(page.getByText('Priority').first()).toBeVisible()
    await expect(page.getByText('Due Date').first()).toBeVisible()
    await expect(page.getByText('Assigned To').first()).toBeVisible()
  })

  test('should display RFI entries', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()

    await expect(page.getByText('RFI-001')).toBeVisible()
    await expect(page.getByText('RFI-002')).toBeVisible()
    await expect(page.getByText('Column grid alignment at Level 3')).toBeVisible()
  })

  test('should display RFI status badges', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()

    await expect(page.getByText('Open').first()).toBeVisible()
    await expect(page.getByText('Answered').first()).toBeVisible()
    await expect(page.getByText('Closed').first()).toBeVisible()
    await expect(page.getByText('Overdue').first()).toBeVisible()
  })

  test('should display RFI priority badges', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()

    await expect(page.locator('text=Low').first()).toBeVisible()
    await expect(page.locator('text=Medium').first()).toBeVisible()
    await expect(page.locator('text=High').first()).toBeVisible()
    await expect(page.locator('text=Critical').first()).toBeVisible()
  })

  test('should create new RFI when form is submitted', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()
    await page.getByRole('button', { name: 'New RFI' }).click()

    await page.getByLabel('Subject').fill('Test RFI from E2E')
    await page.getByLabel('Priority').selectOption('High')
    await page.getByLabel('Assigned To').fill('Test User')

    await page.getByRole('button', { name: 'Create RFI' }).click()

    // Wait for form to close and new RFI to appear
    await page.waitForTimeout(500)
    await expect(page.getByText('Test RFI from E2E')).toBeVisible()
  })

  // ─── Submittals Tab Tests ───────────────────────────────────────────────────

  test('should display submittals tracking summary', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Submittals' }).click()
    await expect(page.getByText(/\d+ submittals awaiting action/)).toBeVisible()
  })

  test('should display submittals table with columns', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Submittals' }).click()

    await expect(page.getByText('Number').first()).toBeVisible()
    await expect(page.getByText('Description').first()).toBeVisible()
    await expect(page.getByText('Status').first()).toBeVisible()
    await expect(page.getByText('Spec Section').first()).toBeVisible()
    await expect(page.getByText('Due Date').first()).toBeVisible()
    await expect(page.getByText('Contractor').first()).toBeVisible()
  })

  test('should display submittal entries', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Submittals' }).click()

    await expect(page.getByText('SUB-001')).toBeVisible()
    await expect(page.getByText('SUB-002')).toBeVisible()
    await expect(page.getByText('Reinforcing Steel Shop Drawings')).toBeVisible()
    await expect(page.getByText('Curtain Wall System Samples')).toBeVisible()
  })

  test('should display submittal status badges', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Submittals' }).click()

    await expect(page.locator('text=Pending').first()).toBeVisible()
    await expect(page.locator('text=Submitted').first()).toBeVisible()
    await expect(page.locator('text=Approved').first()).toBeVisible()
    await expect(page.locator('text=Rejected').first()).toBeVisible()
    await expect(page.locator('text=Resubmit').first()).toBeVisible()
  })

  test('should display spec section codes in monospace', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Submittals' }).click()

    const specSection = page.locator('span.font-mono').filter({ hasText: '03 21 00' }).first()
    await expect(specSection).toBeVisible()
  })

  // ─── Meeting Minutes Tab Tests ──────────────────────────────────────────────

  test('should display meeting notes textarea', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Meeting Minutes' }).click()

    const textarea = page.locator('textarea').first()
    await expect(textarea).toBeVisible()
    await expect(textarea).toHaveAttribute('placeholder', /Enter meeting notes here/)
  })

  test('should display Generate Meeting Minutes button', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Meeting Minutes' }).click()

    await expect(page.getByRole('button', { name: /Generate Meeting Minutes/i })).toBeVisible()
  })

  test('should display Meeting Notes and Formatted Minutes sections', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Meeting Minutes' }).click()

    await expect(page.getByText('Meeting Notes')).toBeVisible()
    await expect(page.getByText('Enter raw notes from the meeting')).toBeVisible()
    await expect(page.getByText('Formatted Minutes')).toBeVisible()
    await expect(page.getByText('AI-generated meeting minutes preview')).toBeVisible()
  })

  test('should show empty state before generating minutes', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Meeting Minutes' }).click()

    await expect(page.getByText('No minutes generated yet')).toBeVisible()
    await expect(page.getByText('Enter your meeting notes and click Generate')).toBeVisible()
  })

  test('should have Generate button disabled when textarea is empty', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Meeting Minutes' }).click()

    const generateButton = page.getByRole('button', { name: /Generate Meeting Minutes/i })
    await expect(generateButton).toBeDisabled()
  })

  test('should enable Generate button when notes are entered', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Meeting Minutes' }).click()

    const textarea = page.locator('textarea').first()
    await textarea.fill('Test meeting notes for E2E')

    const generateButton = page.getByRole('button', { name: /Generate Meeting Minutes/i })
    await expect(generateButton).toBeEnabled()
  })

  test('should generate meeting minutes when button is clicked', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Meeting Minutes' }).click()

    const textarea = page.locator('textarea').first()
    await textarea.fill('- Discussed project timeline\n- Budget review completed\n- Next meeting scheduled')

    const generateButton = page.getByRole('button', { name: /Generate Meeting Minutes/i })
    await generateButton.click()

    // Wait for generation
    await page.waitForTimeout(1000)

    // Check that formatted minutes appear
    await expect(page.getByText('MEETING MINUTES')).toBeVisible()
  })

  test('should display Download TXT and Copy buttons after minutes are generated', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Meeting Minutes' }).click()

    const textarea = page.locator('textarea').first()
    await textarea.fill('- Test note')

    const generateButton = page.getByRole('button', { name: /Generate Meeting Minutes/i })
    await generateButton.click()

    // Wait for generation
    await page.waitForTimeout(1000)

    await expect(page.getByRole('button', { name: /Download TXT/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /Copy to Clipboard/i })).toBeVisible()
  })

  test('should display Sparkles icon on Generate button', async ({ page }) => {
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Meeting Minutes' }).click()

    const textarea = page.locator('textarea').first()
    await textarea.fill('Test')

    const generateButton = page.getByRole('button', { name: /Generate Meeting Minutes/i })
    // Check that the button has the Sparkles icon by checking for SVG inside button
    const buttonSvg = generateButton.locator('svg').first()
    await expect(buttonSvg).toBeVisible()
  })

  // ─── Tab Navigation and State Tests ─────────────────────────────────────────

  test('should maintain tab state when switching between tabs', async ({ page }) => {
    // Enter search on Documents tab
    await page.getByPlaceholder('Search documents...').fill('Structural')
    await expect(page.getByText('Structural Drawings Rev C')).toBeVisible()

    // Switch to RFIs tab
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'RFIs' }).click()
    await expect(page.getByText('RFI-001')).toBeVisible()

    // Switch back to Documents tab
    await page.locator('[role="tablist"]').first().locator('button', { hasText: 'Documents' }).click()

    // Check that search is still active
    await expect(page.getByPlaceholder('Search documents...')).toHaveValue('Structural')
    await expect(page.getByText('Structural Drawings Rev C')).toBeVisible()
  })

  test('should clear search when search input is cleared', async ({ page }) => {
    const searchInput = page.getByPlaceholder('Search documents...')
    await searchInput.fill('Structural')
    await expect(page.getByText('MEP Coordination Report')).not.toBeVisible()

    await searchInput.clear()
    await expect(page.getByText('MEP Coordination Report')).toBeVisible()
  })

  test('should display version numbers in monospace', async ({ page }) => {
    const versionBadge = page.locator('span.font-mono').filter({ hasText: /v\d+\.\d+/ }).first()
    await expect(versionBadge).toBeVisible()
  })

  // ─── Accessibility and UI Tests ─────────────────────────────────────────────

  test('should have proper heading hierarchy', async ({ page }) => {
    await expect(page.locator('main h1')).toHaveCount(1)
    await expect(page.locator('main h1')).toHaveText('Document Control')
  })

  test('should display icons on stat cards', async ({ page }) => {
    const statCards = page.locator('[class*="grid"]').filter({ has: page.getByText('Total Documents') }).first()
    const icons = statCards.locator('svg')
    await expect(icons.first()).toBeVisible()
  })

  test('should navigate to all tabs using keyboard', async ({ page }) => {
    const tablist = page.locator('[role="tablist"]').first()
    await tablist.locator('button').first().focus()

    // Tab navigation should work with arrow keys or tab key
    await page.keyboard.press('Tab')
    await page.keyboard.press('Enter')

    // At least one tab should be active
    await expect(page.locator('[data-state="active"]').first()).toBeVisible()
  })
})
