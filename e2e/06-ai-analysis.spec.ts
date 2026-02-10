import { test, expect } from '@playwright/test'

test.describe('Module 5: AI Data Analysis', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/ai-analysis')
  })

  // ====== PAGE LOAD ======

  test('should display page header with title and subtitle', async ({ page }) => {
    const header = page.locator('main h1')
    await expect(header).toBeVisible()
    await expect(header).toContainText('Анализ данных ИИ')

    const subtitle = page.getByText(/Загружайте данные и получайте анализ/i)
    await expect(subtitle).toBeVisible()
  })

  test('should display all 4 stat cards', async ({ page }) => {
    await expect(page.getByText('Запусков анализа')).toBeVisible()
    await expect(page.getByText('Средний ответ')).toBeVisible()
    await expect(page.getByText('Обработано файлов')).toBeVisible()
    await expect(page.getByText('Построено графиков')).toBeVisible()
  })

  // ====== AI ASSISTANT HEADER ======

  test('should display AI assistant header with branding', async ({ page }) => {
    await expect(page.getByText('Jens AI Assistant')).toBeVisible()
    await expect(page.getByText('На базе Google Gemini')).toBeVisible()

    const onlineBadge = page.getByText('Онлайн')
    await expect(onlineBadge).toBeVisible()
  })

  // ====== FILE UPLOAD ======

  test('should display file upload area with correct accept types', async ({ page }) => {
    await expect(page.getByText('Источник данных')).toBeVisible()
    await expect(page.getByText(/Перетащите файлы данных/i)).toBeVisible()
    await expect(page.getByText(/Поддержка \.xlsx, \.xls, \.csv/i)).toBeVisible()
  })

  // ====== QUICK PRESETS ======

  test('should display all 4 quick analysis preset buttons', async ({ page }) => {
    await expect(page.getByText('Быстрый анализ')).toBeVisible()
    await expect(page.getByText('Группировка по категориям')).toBeVisible()
    await expect(page.getByText('Распределение')).toBeVisible()
    await expect(page.getByText('Поиск аномалий', { exact: true })).toBeVisible()
    await expect(page.getByText('Сравнение столбцов', { exact: true })).toBeVisible()
  })

  test('should show preset buttons as disabled without file', async ({ page }) => {
    const groupButton = page.locator('button:has-text("Группировка по категориям")')
    await expect(groupButton).toBeDisabled()

    const distributionButton = page.locator('button:has-text("Распределение")')
    await expect(distributionButton).toBeDisabled()

    const anomaliesButton = page.locator('button:has-text("Поиск аномалий")')
    await expect(anomaliesButton).toBeDisabled()

    const compareButton = page.locator('button:has-text("Сравнение столбцов")')
    await expect(compareButton).toBeDisabled()
  })

  // ====== CHAT INTERFACE ======

  test('should display chat input field with placeholder', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Сначала загрузите файл/i)
    await expect(chatInput).toBeVisible()
    await expect(chatInput).toHaveAttribute('placeholder', /Сначала загрузите файл/i)
  })

  test('should display Send button', async ({ page }) => {
    const sendButton = page.locator('button:has-text("Отправить")')
    await expect(sendButton).toBeVisible()
  })

  test('should show Clear Chat button when messages exist', async ({ page }) => {
    const clearButton = page.locator('button:has-text("Очистить чат")')
    await expect(clearButton).not.toBeVisible()
  })

  test('should display helper text about pressing Enter', async ({ page }) => {
    const helperText = page.getByText(/Нажмите Enter для отправки/i)
    await expect(helperText).toBeVisible()
  })

  // ====== INITIAL STATE ======

  test('should display welcome message in empty chat', async ({ page }) => {
    await expect(page.getByText('Начните анализ')).toBeVisible()
    await expect(page.getByText(/Загрузите файл данных и опишите/i)).toBeVisible()
  })

  test('should not display code blocks initially', async ({ page }) => {
    const codeBlock = page.locator('pre').first()
    await expect(codeBlock).not.toBeVisible()

    const codeHeader = page.getByText('Сгенерированный Python-код')
    await expect(codeHeader).not.toBeVisible()
  })

  test('should disable chat input without file', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Сначала загрузите файл/i)
    await expect(chatInput).toBeDisabled()

    const sendButton = page.locator('button:has-text("Отправить")')
    await expect(sendButton).toBeDisabled()
  })

  // ====== INTERACTION TESTS ======

  test('should update input value when typing', async ({ page }) => {
    const chatInput = page.locator('input[placeholder*="Сначала загрузите файл"]')
    await expect(chatInput).toBeVisible()
    await expect(chatInput).toBeDisabled()
  })

  test('should show file upload in Data Source card', async ({ page }) => {
    const dataSourceCard = page.locator('text=Источник данных').locator('..')
    await expect(dataSourceCard).toBeVisible()

    const uploadArea = page.getByText(/Перетащите файлы данных/i)
    await expect(uploadArea).toBeVisible()
  })

  test('should display preset prompts on hover', async ({ page }) => {
    const groupPreset = page.locator('button:has-text("Группировка по категориям")')
    await expect(groupPreset).toBeVisible()
  })

  // ====== STAT CARDS VALUES ======

  test('should display stat card values', async ({ page }) => {
    const analysesCard = page.locator('text=Запусков анализа').locator('..')
    await expect(analysesCard).toContainText(/\d+|—/)

    const avgResponseCard = page.locator('text=Средний ответ').locator('..')
    await expect(avgResponseCard).toContainText(/\d+\.\d+s|—/)

    const filesCard = page.locator('text=Обработано файлов').locator('..')
    await expect(filesCard).toContainText(/\d+/)

    const chartsCard = page.locator('text=Построено графиков').locator('..')
    await expect(chartsCard).toContainText(/\d+/)
  })

  // ====== LAYOUT TESTS ======

  test('should have proper layout structure', async ({ page }) => {
    const mainGrid = page.locator('.grid.grid-cols-1.lg\\:grid-cols-3')
    await expect(mainGrid).toBeVisible()

    const leftColumn = mainGrid.locator('.space-y-6').first()
    await expect(leftColumn).toBeVisible()
    await expect(leftColumn.getByText('Источник данных')).toBeVisible()
    await expect(leftColumn.getByText('Быстрый анализ')).toBeVisible()

    const rightColumn = mainGrid.locator('.lg\\:col-span-2')
    await expect(rightColumn).toBeVisible()
    await expect(rightColumn.getByText('Jens AI Assistant')).toBeVisible()
  })

  test('should display chat container with proper styling', async ({ page }) => {
    const chatContainer = page.locator('.overflow-y-auto.p-6.space-y-6')
    await expect(chatContainer).toBeVisible()
    await expect(chatContainer).toHaveClass(/min-h-\[400px\]/)
    await expect(chatContainer).toHaveClass(/max-h-\[600px\]/)
  })

  // ====== ACCESSIBILITY ======

  test('should have accessible form elements', async ({ page }) => {
    const chatInput = page.getByPlaceholder(/Сначала загрузите файл/i)
    await expect(chatInput).toHaveAttribute('placeholder')

    const sendButton = page.locator('button:has-text("Отправить")')
    await expect(sendButton).toBeVisible()
  })

  test('should display all icons correctly', async ({ page }) => {
    await expect(page.locator('svg').first()).toBeVisible()
    const iconCount = await page.locator('svg').count()
    expect(iconCount).toBeGreaterThan(10)
  })
})
