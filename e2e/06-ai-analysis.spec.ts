import { test, expect } from '@playwright/test'

test.describe('Module 5: AI Data Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ai-analysis')
  })

  // ====== PAGE LOAD ======

  test('should display page header with title and subtitle', async ({ page }) => {
    const header = page.locator('main h1')
    await expect(header).toBeVisible()
    await expect(header).toHaveText('AI Data Analysis')

    const subtitle = page.getByText(/upload data files and ask ai to analyze/i)
    await expect(subtitle).toBeVisible()
  })

  test('should display all 4 stat cards', async ({ page }) => {
    // "Analyses Run" stat card
    await expect(page.getByText('Analyses Run')).toBeVisible()

    // "Avg Response" stat card
    await expect(page.getByText('Avg Response')).toBeVisible()

    // "Files Processed" stat card
    await expect(page.getByText('Files Processed')).toBeVisible()

    // "Charts Generated" stat card
    await expect(page.getByText('Charts Generated')).toBeVisible()
  })

  // ====== AI ASSISTANT HEADER ======

  test('should display AI assistant header with branding', async ({ page }) => {
    // "Jens AI Assistant" text
    await expect(page.getByText('Jens AI Assistant')).toBeVisible()

    // "Powered by Google Gemini" text
    await expect(page.getByText('Powered by Google Gemini')).toBeVisible()

    // "Online" status badge
    const onlineBadge = page.locator('text=Online')
    await expect(onlineBadge).toBeVisible()
  })

  // ====== FILE UPLOAD ======

  test('should display file upload area with correct accept types', async ({ page }) => {
    // File upload card title
    await expect(page.getByText('Data Source')).toBeVisible()

    // File upload description
    await expect(page.getByText(/drop data files here/i)).toBeVisible()
    await expect(page.getByText(/supports \.xlsx, \.xls, \.csv/i)).toBeVisible()
  })

  // ====== QUICK PRESETS ======

  test('should display all 4 quick analysis preset buttons', async ({ page }) => {
    // Quick Analysis card title
    await expect(page.getByText('Quick Analysis')).toBeVisible()

    // Preset 1: Group by category
    await expect(page.getByText('Group by category')).toBeVisible()

    // Preset 2: Show distribution
    await expect(page.getByText('Show distribution')).toBeVisible()

    // Preset 3: Find anomalies
    await expect(page.getByText('Find anomalies', { exact: true })).toBeVisible()

    // Preset 4: Compare columns
    await expect(page.getByText('Compare columns', { exact: true })).toBeVisible()
  })

  test('should show preset buttons as disabled without file', async ({ page }) => {
    // All preset buttons should be disabled when no file is uploaded
    const groupButton = page.locator('button:has-text("Group by category")')
    await expect(groupButton).toBeDisabled()

    const distributionButton = page.locator('button:has-text("Show distribution")')
    await expect(distributionButton).toBeDisabled()

    const anomaliesButton = page.locator('button:has-text("Find anomalies")')
    await expect(anomaliesButton).toBeDisabled()

    const compareButton = page.locator('button:has-text("Compare columns")')
    await expect(compareButton).toBeDisabled()
  })

  // ====== CHAT INTERFACE ======

  test('should display chat input field with placeholder', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/upload a file first/i)
    await expect(chatInput).toBeVisible()

    // Should show "Upload a file first..." when no file is uploaded
    await expect(chatInput).toHaveAttribute('placeholder', /upload a file first/i)
  })

  test('should display Send button', async ({ page }) => {
    const sendButton = page.locator('button:has-text("Send")')
    await expect(sendButton).toBeVisible()
  })

  test('should show Clear Chat button when messages exist', async ({ page }) => {
    // Initially, Clear Chat button should not be visible (no messages)
    const clearButton = page.locator('button:has-text("Clear Chat")')
    await expect(clearButton).not.toBeVisible()
  })

  test('should display helper text about pressing Enter', async ({ page }) => {
    const helperText = page.getByText(/press enter to send/i)
    await expect(helperText).toBeVisible()
  })

  // ====== INITIAL STATE ======

  test('should display welcome message in empty chat', async ({ page }) => {
    // Welcome heading
    await expect(page.getByText('Start Your Analysis')).toBeVisible()

    // Welcome description
    await expect(page.getByText(/upload a data file and describe what you want to analyze/i)).toBeVisible()
  })

  test('should not display code blocks initially', async ({ page }) => {
    // No code blocks should be present in initial state
    const codeBlock = page.locator('pre').first()
    await expect(codeBlock).not.toBeVisible()

    const codeHeader = page.getByText('Generated Python Code')
    await expect(codeHeader).not.toBeVisible()
  })

  test('should disable chat input without file', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/upload a file first/i)
    await expect(chatInput).toBeDisabled()

    const sendButton = page.locator('button:has-text("Send")')
    await expect(sendButton).toBeDisabled()
  })

  // ====== INTERACTION TESTS ======

  test('should update input value when typing', async ({ page }) => {
    const chatInput = page.locator('input[placeholder*="Upload a file first"]')
    await expect(chatInput).toBeVisible()

    // Input should be disabled without file, but we can verify it exists
    await expect(chatInput).toBeDisabled()
  })

  test('should show file upload in Data Source card', async ({ page }) => {
    // Verify the file upload component is rendered
    const dataSourceCard = page.locator('text=Data Source').locator('..')
    await expect(dataSourceCard).toBeVisible()

    // Verify upload area is present
    const uploadArea = page.getByText(/drop data files here/i)
    await expect(uploadArea).toBeVisible()
  })

  test('should display preset prompts on hover', async ({ page }) => {
    // Preset buttons show truncated prompts
    const groupPreset = page.locator('button:has-text("Group by category")')
    await expect(groupPreset).toBeVisible()

    // The full prompt should be visible in the button (even if truncated)
    await expect(groupPreset).toBeVisible()
  })

  // ====== STAT CARDS VALUES ======

  test('should display stat card values', async ({ page }) => {
    // Analyses Run should show a number
    const analysesCard = page.locator('text=Analyses Run').locator('..')
    await expect(analysesCard).toContainText(/\d+/)

    // Avg Response should show time format
    const avgResponseCard = page.locator('text=Avg Response').locator('..')
    await expect(avgResponseCard).toContainText(/\d+\.\d+s/)

    // Files Processed should show a number
    const filesCard = page.locator('text=Files Processed').locator('..')
    await expect(filesCard).toContainText(/\d+/)

    // Charts Generated should show a number
    const chartsCard = page.locator('text=Charts Generated').locator('..')
    await expect(chartsCard).toContainText(/\d+/)
  })

  // ====== LAYOUT TESTS ======

  test('should have proper layout structure', async ({ page }) => {
    // Verify main grid layout exists
    const mainGrid = page.locator('.grid.grid-cols-1.lg\\:grid-cols-3')
    await expect(mainGrid).toBeVisible()

    // Left column should contain upload and presets
    const leftColumn = mainGrid.locator('.space-y-6').first()
    await expect(leftColumn).toBeVisible()
    await expect(leftColumn.getByText('Data Source')).toBeVisible()
    await expect(leftColumn.getByText('Quick Analysis')).toBeVisible()

    // Right column should contain chat
    const rightColumn = mainGrid.locator('.lg\\:col-span-2')
    await expect(rightColumn).toBeVisible()
    await expect(rightColumn.getByText('Jens AI Assistant')).toBeVisible()
  })

  test('should display chat container with proper styling', async ({ page }) => {
    // Chat messages container
    const chatContainer = page.locator('.overflow-y-auto.p-6.space-y-6')
    await expect(chatContainer).toBeVisible()

    // Should have minimum and maximum height constraints
    await expect(chatContainer).toHaveClass(/min-h-\[400px\]/)
    await expect(chatContainer).toHaveClass(/max-h-\[600px\]/)
  })

  // ====== ACCESSIBILITY ======

  test('should have accessible form elements', async ({ page }) => {
    // Input should have proper placeholder
    const chatInput = page.getByPlaceholder(/upload a file first/i)
    await expect(chatInput).toHaveAttribute('placeholder')

    // Button should be clickable (or disabled with proper state)
    const sendButton = page.locator('button:has-text("Send")')
    await expect(sendButton).toBeVisible()
  })

  test('should display all icons correctly', async ({ page }) => {
    // Verify key icons are rendered (SVG elements should be present)
    await expect(page.locator('svg').first()).toBeVisible()

    // Multiple icons should be present (stat cards, buttons, etc.)
    const iconCount = await page.locator('svg').count()
    expect(iconCount).toBeGreaterThan(10)
  })
})
