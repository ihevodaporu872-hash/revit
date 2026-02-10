import { test, expect } from '@playwright/test'

test.describe('Module 3: CWICR Cost Estimation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/cost')
  })

  test.describe('Page Load', () => {
    test('should display header with title', async ({ page }) => {
      const header = page.locator('main h1')
      await expect(header).toBeVisible()
      await expect(header).toContainText('CWICR')
    })

    test('should display subtitle with languages', async ({ page }) => {
      const subtitle = page.locator('text=/9 языках/')
      await expect(subtitle).toBeVisible()
    })

    test('should display all 4 stat cards', async ({ page }) => {
      await expect(page.locator('text=/Статус базы/').first()).toBeVisible()
      await expect(page.locator('text=/Активна/').first()).toBeVisible()

      await expect(page.locator('text=/Языки/').first()).toBeVisible()
      await expect(page.locator('text=9').first()).toBeVisible()

      await expect(page.locator('text=/Среднее время ответа/').first()).toBeVisible()
      await expect(page.locator('text=0.3s').first()).toBeVisible()

      await expect(page.locator('text=/Смет сегодня/').first()).toBeVisible()
      await expect(page.locator('text=7').first()).toBeVisible()
    })
  })

  test.describe('Tabs', () => {
    test('should display all tabs', async ({ page }) => {
      await expect(page.getByRole('tab', { name: /Семантический поиск/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /Классификация ИИ/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /Умная смета/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /Расчёт сметы/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /Сравнение ВОР/i })).toBeVisible()
      await expect(page.getByRole('tab', { name: /История/i })).toBeVisible()
    })

    test('should have Семантический поиск as default active tab', async ({ page }) => {
      await expect(page.locator('input[placeholder*="Поиск позиций"]')).toBeVisible()
    })

    test('should switch to Классификация ИИ tab', async ({ page }) => {
      await page.getByRole('tab', { name: /Классификация ИИ/i }).click()
      await page.waitForTimeout(300)
      await expect(page.locator('text=Классификация ВОР')).toBeVisible()
    })

    test('should switch to Расчёт сметы tab', async ({ page }) => {
      await page.getByRole('tab', { name: /Расчёт сметы/i }).click()
      await page.waitForTimeout(300)
      await expect(page.locator('[data-slot="card-title"]:has-text("Расчёт сметы")')).toBeVisible()
    })

    test('should switch to История tab', async ({ page }) => {
      await page.getByRole('tab', { name: /История/i }).click()
      await page.waitForTimeout(300)
      await expect(page.locator('text=Последние сметы')).toBeVisible()
    })

    test('should switch between tabs multiple times', async ({ page }) => {
      await page.getByRole('tab', { name: /Классификация ИИ/i }).click()
      await page.waitForTimeout(200)
      await expect(page.locator('text=Классификация ВОР')).toBeVisible()

      await page.getByRole('tab', { name: /Семантический поиск/i }).click()
      await page.waitForTimeout(200)
      await expect(page.locator('input[placeholder*="Поиск позиций"]')).toBeVisible()

      await page.getByRole('tab', { name: /История/i }).click()
      await page.waitForTimeout(200)
      await expect(page.locator('text=Последние сметы')).toBeVisible()

      await page.getByRole('tab', { name: /Расчёт сметы/i }).click()
      await page.waitForTimeout(200)
      await expect(page.locator('[data-slot="card-title"]:has-text("Расчёт сметы")')).toBeVisible()
    })
  })

  test.describe('Semantic Search Tab', () => {
    test('should display language selector with EN as default', async ({ page }) => {
      const langButton = page.locator('button').filter({ hasText: 'EN' }).first()
      await expect(langButton).toBeVisible()
    })

    test('should display search input with placeholder', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Поиск позиций"]')
      await expect(searchInput).toBeVisible()
    })

    test('should display Найти button', async ({ page }) => {
      const searchButton = page.getByRole('button', { name: /Найти/i })
      await expect(searchButton).toBeVisible()
    })

    test('should allow typing in search input', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Поиск позиций"]')
      await searchInput.fill('concrete')
      await expect(searchInput).toHaveValue('concrete')
    })

    test('should display empty state before search', async ({ page }) => {
      await expect(page.locator('text=Выполните поиск строительных позиций')).toBeVisible()
    })

    test('should perform search and display results', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Поиск позиций"]')
      await searchInput.fill('concrete')

      const searchButton = page.getByRole('button', { name: /Найти/i })
      await searchButton.click()

      await page.waitForTimeout(1000)

      await expect(page.locator('text=Результаты поиска')).toBeVisible()
    })

    test('should trigger search on Enter key', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Поиск позиций"]')
      await searchInput.fill('steel')
      await searchInput.press('Enter')

      await page.waitForTimeout(1000)

      await expect(page.locator('text=Результаты поиска')).toBeVisible()
    })

    test('should display Add button for search results', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Поиск позиций"]')
      await searchInput.fill('concrete')

      await page.getByRole('button', { name: /Найти/i }).click()
      await page.waitForTimeout(1000)

      const addButtons = page.getByRole('button', { name: /Add/i })
      await expect(addButtons.first()).toBeVisible()
    })
  })

  test.describe('AI Classification Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: /Классификация ИИ/i }).click()
      await page.waitForTimeout(300)
    })

    test('should display VOR classification title', async ({ page }) => {
      await expect(page.locator('text=Классификация ВОР')).toBeVisible()
    })

    test('should display upload subtitle', async ({ page }) => {
      await expect(page.locator('text=Загрузите Excel-файл с ВОР')).toBeVisible()
    })

    test('should display Gemini AI label', async ({ page }) => {
      await expect(page.locator('text=Gemini AI').first()).toBeVisible()
    })

    test('should display Классифицировать ВОР button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Классифицировать ВОР/i })).toBeVisible()
    })
  })

  test.describe('Cost Calculation Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: /Расчёт сметы/i }).click()
      await page.waitForTimeout(300)
    })

    test('should display Расчёт сметы title', async ({ page }) => {
      await expect(page.locator('[data-slot="card-title"]:has-text("Расчёт сметы")')).toBeVisible()
    })

    test('should display empty state when no items added', async ({ page }) => {
      await expect(page.locator('text=Позиции пока не добавлены')).toBeVisible()
    })

    test('should display cost table when items exist', async ({ page }) => {
      // First add items via search
      await page.getByRole('tab', { name: /Семантический поиск/i }).click()
      await page.waitForTimeout(300)

      const searchInput = page.locator('input[placeholder*="Поиск позиций"]')
      await searchInput.fill('concrete')
      await page.getByRole('button', { name: /Найти/i }).click()
      await page.waitForTimeout(1000)

      // Add first item
      const addButton = page.getByRole('button', { name: /Add/i }).first()
      await addButton.click()
      await page.waitForTimeout(500)

      // Switch back to Cost Calculation
      await page.getByRole('tab', { name: /Расчёт сметы/i }).click()
      await page.waitForTimeout(300)

      // Check for table headers
      await expect(page.locator('th:has-text("Код")')).toBeVisible()
      await expect(page.locator('th:has-text("Описание")')).toBeVisible()
    })

    test('should display Общий итог when items exist', async ({ page }) => {
      // Add items first
      await page.getByRole('tab', { name: /Семантический поиск/i }).click()
      await page.waitForTimeout(300)

      const searchInput = page.locator('input[placeholder*="Поиск позиций"]')
      await searchInput.fill('concrete')
      await page.getByRole('button', { name: /Найти/i }).click()
      await page.waitForTimeout(1000)

      await page.getByRole('button', { name: /Add/i }).first().click()
      await page.waitForTimeout(500)

      await page.getByRole('tab', { name: /Расчёт сметы/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('text=Общий итог')).toBeVisible()
    })
  })

  test.describe('History Tab', () => {
    test.beforeEach(async ({ page }) => {
      await page.getByRole('tab', { name: /История/i }).click()
      await page.waitForTimeout(300)
    })

    test('should display Последние сметы title', async ({ page }) => {
      await expect(page.locator('text=Последние сметы')).toBeVisible()
    })

    test('should display subtitle with estimate count', async ({ page }) => {
      await expect(page.locator('text=/\\d+ дней/')).toBeVisible()
    })

    test('should display Экспорт всего button', async ({ page }) => {
      await expect(page.getByRole('button', { name: /Экспорт всего/i })).toBeVisible()
    })

    test('should display recent estimate data', async ({ page }) => {
      await expect(page.locator('td').filter({ hasText: /Hospital|Office|Residential|Parking|School/ }).first()).toBeVisible()
    })

    test('should display language badges in history', async ({ page }) => {
      const badges = page.locator('td').filter({ hasText: /EN|DE|RU|ES/ })
      await expect(badges.first()).toBeVisible()
    })
  })

  test.describe('Integration Flow', () => {
    test('should complete full workflow: search, add item, view in cost table', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Поиск позиций"]')
      await searchInput.fill('concrete')
      await page.getByRole('button', { name: /Найти/i }).click()
      await page.waitForTimeout(1000)

      await page.getByRole('button', { name: /Add/i }).first().click()
      await page.waitForTimeout(500)

      await page.getByRole('tab', { name: /Расчёт сметы/i }).click()
      await page.waitForTimeout(300)

      await expect(page.locator('[data-slot="card-title"]:has-text("Расчёт сметы")')).toBeVisible()
      await expect(page.locator('text=Общий итог')).toBeVisible()
    })
  })

  test.describe('Accessibility', () => {
    test('should have proper heading hierarchy', async ({ page }) => {
      const h1 = page.locator('main h1')
      await expect(h1).toHaveCount(1)
      await expect(h1).toContainText('CWICR')
    })

    test('should have accessible buttons with labels', async ({ page }) => {
      const searchButton = page.getByRole('button', { name: /Найти/i })
      await expect(searchButton).toBeVisible()
    })

    test('should have input fields with placeholders', async ({ page }) => {
      const searchInput = page.locator('input[placeholder*="Поиск позиций"]')
      await expect(searchInput).toHaveAttribute('placeholder')
    })
  })
})
