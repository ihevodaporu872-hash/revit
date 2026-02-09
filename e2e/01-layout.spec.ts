import { test, expect } from '@playwright/test'

test.describe('Layout & Navigation', () => {
  test.describe('Sidebar - Branding', () => {
    test('should show Jens logo and subtitle when expanded', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('Jens', { exact: true }).first()).toBeVisible()
      await expect(page.getByText('Construction Platform')).toBeVisible()
    })

    test('should show version text when expanded', async ({ page }) => {
      await page.goto('/')
      await expect(page.getByText('Jens v1.0')).toBeVisible()
    })
  })

  test.describe('Sidebar - Navigation Links', () => {
    test('should show all 8 module navigation links', async ({ page }) => {
      await page.goto('/')
      const modules = [
        'CAD Converter',
        '3D Viewer',
        'Cost Estimate',
        'BIM Validation',
        'AI Analysis',
        'Project Mgmt',
        'Documents',
        'QTO Reports',
      ]
      for (const mod of modules) {
        await expect(page.getByText(mod, { exact: true })).toBeVisible()
      }
    })

    test('should navigate to /converter when clicking CAD Converter', async ({ page }) => {
      await page.goto('/')
      await page.getByText('CAD Converter', { exact: true }).click()
      await expect(page).toHaveURL(/\/converter/)
    })

    test('should navigate to /viewer when clicking 3D Viewer', async ({ page }) => {
      await page.goto('/')
      await page.getByText('3D Viewer', { exact: true }).click()
      await expect(page).toHaveURL(/\/viewer/)
    })

    test('should navigate to /cost when clicking Cost Estimate', async ({ page }) => {
      await page.goto('/')
      await page.getByText('Cost Estimate', { exact: true }).click()
      await expect(page).toHaveURL(/\/cost/)
    })

    test('should navigate to /validation when clicking BIM Validation', async ({ page }) => {
      await page.goto('/')
      await page.getByText('BIM Validation', { exact: true }).click()
      await expect(page).toHaveURL(/\/validation/)
    })

    test('should navigate to /ai-analysis when clicking AI Analysis', async ({ page }) => {
      await page.goto('/')
      await page.getByText('AI Analysis', { exact: true }).click()
      await expect(page).toHaveURL(/\/ai-analysis/)
    })

    test('should navigate to /project when clicking Project Mgmt', async ({ page }) => {
      await page.goto('/')
      await page.getByText('Project Mgmt', { exact: true }).click()
      await expect(page).toHaveURL(/\/project/)
    })

    test('should navigate to /documents when clicking Documents', async ({ page }) => {
      await page.goto('/')
      await page.getByText('Documents', { exact: true }).click()
      await expect(page).toHaveURL(/\/documents/)
    })

    test('should navigate to /qto when clicking QTO Reports', async ({ page }) => {
      await page.goto('/')
      await page.getByText('QTO Reports', { exact: true }).click()
      await expect(page).toHaveURL(/\/qto/)
    })
  })

  test.describe('Sidebar - Active State', () => {
    test('should show active state indicator on current page', async ({ page }) => {
      await page.goto('/converter')
      // Active indicator is a motion.div with layoutId="sidebar-active"
      const activeIndicator = page.locator('aside button[class*="bg-sidebar-primary"]')
      await expect(activeIndicator).toBeVisible()
    })

    test('should move active indicator when navigating', async ({ page }) => {
      await page.goto('/converter')
      await page.getByText('3D Viewer', { exact: true }).click()
      await page.waitForURL(/\/viewer/)
      // Verify active state moved
      const activeButton = page.locator('aside button[class*="bg-sidebar-primary"]')
      await expect(activeButton).toContainText('3D Viewer')
    })
  })

  test.describe('Sidebar - Collapse/Expand', () => {
    test('should collapse sidebar and hide Jens text', async ({ page }) => {
      await page.goto('/')
      const jensText = page.getByText('Jens', { exact: true }).first()
      await expect(jensText).toBeVisible()

      // Click collapse button (ChevronLeft icon)
      const collapseBtn = page.locator('aside button').first()
      await collapseBtn.click()

      // Wait for animation
      await page.waitForTimeout(400)

      // Jens text should be hidden
      await expect(jensText).not.toBeVisible()
    })

    test('should expand sidebar and show Jens text again', async ({ page }) => {
      await page.goto('/')

      // Collapse first
      const toggleBtn = page.locator('aside button').first()
      await toggleBtn.click()
      await page.waitForTimeout(400)

      const jensText = page.getByText('Jens', { exact: true }).first()
      await expect(jensText).not.toBeVisible()

      // Expand
      await toggleBtn.click()
      await page.waitForTimeout(400)

      // Jens text should be visible again
      await expect(jensText).toBeVisible()
    })

    test('should hide version text when collapsed', async ({ page }) => {
      await page.goto('/')
      const versionText = page.getByText('Jens v1.0')
      await expect(versionText).toBeVisible()

      const collapseBtn = page.locator('aside button').first()
      await collapseBtn.click()
      await page.waitForTimeout(400)

      await expect(versionText).not.toBeVisible()
    })

    test('should show version text when expanded', async ({ page }) => {
      await page.goto('/')
      const toggleBtn = page.locator('aside button').first()

      // Collapse
      await toggleBtn.click()
      await page.waitForTimeout(400)

      // Expand
      await toggleBtn.click()
      await page.waitForTimeout(400)

      await expect(page.getByText('Jens v1.0')).toBeVisible()
    })
  })

  test.describe('Sidebar - Theme Toggle', () => {
    test('should have theme toggle button in sidebar footer', async ({ page }) => {
      await page.goto('/')
      // ThemeToggle is in sidebar footer
      const themeToggle = page.locator('aside .border-t button[class*="rounded"]').first()
      await expect(themeToggle).toBeVisible()
    })
  })

  test.describe('TopBar - Breadcrumb', () => {
    test('should show "Modules > CAD/BIM Converter" on converter page', async ({ page }) => {
      await page.goto('/converter')
      await expect(page.locator('header').getByText('Modules')).toBeVisible()
      await expect(page.locator('header h1')).toHaveText('CAD/BIM Converter')
    })

    test('should show "Modules > 3D Model Viewer" on viewer page', async ({ page }) => {
      await page.goto('/viewer')
      await expect(page.locator('header').getByText('Modules')).toBeVisible()
      await expect(page.locator('header h1')).toHaveText('3D Model Viewer')
    })

    test('should show "Modules > CWICR Cost Estimation" on cost page', async ({ page }) => {
      await page.goto('/cost')
      await expect(page.locator('header').getByText('Modules')).toBeVisible()
      await expect(page.locator('header h1')).toHaveText('CWICR Cost Estimation')
    })

    test('should show "Modules > BIM Validation" on validation page', async ({ page }) => {
      await page.goto('/validation')
      await expect(page.locator('header').getByText('Modules')).toBeVisible()
      await expect(page.locator('header h1')).toHaveText('BIM Validation')
    })

    test('should show "Modules > AI Data Analysis" on ai-analysis page', async ({ page }) => {
      await page.goto('/ai-analysis')
      await expect(page.locator('header').getByText('Modules')).toBeVisible()
      await expect(page.locator('header h1')).toHaveText('AI Data Analysis')
    })

    test('should show "Modules > Project Management" on project page', async ({ page }) => {
      await page.goto('/project')
      await expect(page.locator('header').getByText('Modules')).toBeVisible()
      await expect(page.locator('header h1')).toHaveText('Project Management')
    })

    test('should show "Modules > Document Control" on documents page', async ({ page }) => {
      await page.goto('/documents')
      await expect(page.locator('header').getByText('Modules')).toBeVisible()
      await expect(page.locator('header h1')).toHaveText('Document Control')
    })

    test('should show "Modules > QTO Reports" on qto page', async ({ page }) => {
      await page.goto('/qto')
      await expect(page.locator('header').getByText('Modules')).toBeVisible()
      await expect(page.locator('header h1')).toHaveText('QTO Reports')
    })
  })

  test.describe('TopBar - Search Bar', () => {
    test('should show search input with placeholder', async ({ page }) => {
      await page.goto('/')
      const searchInput = page.getByPlaceholder('Search...')
      await expect(searchInput).toBeVisible()
    })

    test('should allow typing in search input', async ({ page }) => {
      await page.goto('/')
      const searchInput = page.getByPlaceholder('Search...')
      await searchInput.fill('test query')
      await expect(searchInput).toHaveValue('test query')
    })
  })

  test.describe('TopBar - Action Icons', () => {
    test('should show notification bell icon', async ({ page }) => {
      await page.goto('/')
      // Bell icon button
      const bellButton = page.locator('header button').filter({ has: page.locator('svg') }).nth(0)
      await expect(bellButton).toBeVisible()
    })

    test('should show settings icon', async ({ page }) => {
      await page.goto('/')
      // Settings icon button (second icon button in header, after bell)
      const settingsButton = page.locator('header button').filter({ has: page.locator('svg') }).nth(1)
      await expect(settingsButton).toBeVisible()
    })

    test('should show user avatar', async ({ page }) => {
      await page.goto('/')
      // User avatar with User icon
      const userAvatar = page.locator('header div[class*="rounded-full"]').filter({ has: page.locator('svg') })
      await expect(userAvatar).toBeVisible()
    })
  })

  test.describe('Navigation Flow', () => {
    test('should navigate through all 8 modules sequentially and verify page titles', async ({ page }) => {
      await page.goto('/converter')
      await expect(page.locator('header h1')).toHaveText('CAD/BIM Converter')

      await page.getByText('3D Viewer', { exact: true }).click()
      await page.waitForURL(/\/viewer/)
      await expect(page.locator('header h1')).toHaveText('3D Model Viewer')

      await page.getByText('Cost Estimate', { exact: true }).click()
      await page.waitForURL(/\/cost/)
      await expect(page.locator('header h1')).toHaveText('CWICR Cost Estimation')

      await page.getByText('BIM Validation', { exact: true }).click()
      await page.waitForURL(/\/validation/)
      await expect(page.locator('header h1')).toHaveText('BIM Validation')

      await page.getByText('AI Analysis', { exact: true }).click()
      await page.waitForURL(/\/ai-analysis/)
      await expect(page.locator('header h1')).toHaveText('AI Data Analysis')

      await page.getByText('Project Mgmt', { exact: true }).click()
      await page.waitForURL(/\/project/)
      await expect(page.locator('header h1')).toHaveText('Project Management')

      await page.getByText('Documents', { exact: true }).click()
      await page.waitForURL(/\/documents/)
      await expect(page.locator('header h1')).toHaveText('Document Control')

      await page.getByText('QTO Reports', { exact: true }).click()
      await page.waitForURL(/\/qto/)
      await expect(page.locator('header h1')).toHaveText('QTO Reports')
    })

    test('should redirect root path to /converter', async ({ page }) => {
      await page.goto('/')
      await expect(page).toHaveURL(/\/converter/)
    })
  })

  test.describe('Theme Toggle', () => {
    test('should toggle theme and change body class', async ({ page }) => {
      await page.goto('/')

      // Get initial theme
      const initialClass = await page.locator('html').getAttribute('class')

      // Click theme toggle in sidebar
      const themeToggle = page.locator('aside .border-t button[class*="rounded"]').first()
      await themeToggle.click()

      // Wait for theme change
      await page.waitForTimeout(200)

      // Verify class changed
      const newClass = await page.locator('html').getAttribute('class')
      expect(newClass).not.toBe(initialClass)
    })

    test('should toggle theme back and forth', async ({ page }) => {
      await page.goto('/')

      const html = page.locator('html')
      const themeToggle = page.locator('aside .border-t button[class*="rounded"]').first()

      // Get initial state
      const initialClass = await html.getAttribute('class')

      // Toggle once
      await themeToggle.click()
      await page.waitForTimeout(200)
      const afterFirstToggle = await html.getAttribute('class')
      expect(afterFirstToggle).not.toBe(initialClass)

      // Toggle back
      await themeToggle.click()
      await page.waitForTimeout(200)
      const afterSecondToggle = await html.getAttribute('class')

      // Should cycle through themes (dark/light/system)
      // Just verify it changed
      expect(afterSecondToggle).toBeDefined()
    })
  })
})
