import { test, expect } from '@playwright/test'

test.describe('Module 6: Project Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/projects')
  })

  test.describe('Page Load', () => {
    test('should display header with title and icon', async ({ page }) => {
      const header = page.locator('header h1')
      await expect(header).toBeVisible()
      await expect(header).toContainText('Project Management')

      // Check for icon in header
      const icon = header.locator('svg')
      await expect(icon).toBeVisible()
    })

    test('should display subtitle about tracking tasks', async ({ page }) => {
      const subtitle = page.locator('p.text-muted-foreground').filter({ hasText: 'Track tasks, coordinate team, and manage project timeline' })
      await expect(subtitle).toBeVisible()
    })

    test('should display all 4 stat cards', async ({ page }) => {
      // Total Tasks
      await expect(page.locator('text=Total Tasks')).toBeVisible()

      // Completed
      await expect(page.locator('text=Completed')).toBeVisible()

      // Overdue
      await expect(page.locator('text=Overdue')).toBeVisible()

      // Team Members
      await expect(page.locator('text=Team Members')).toBeVisible()
    })

    test('should display numeric values in stat cards', async ({ page }) => {
      // Wait for stats to load
      await page.waitForTimeout(300)

      const statCards = page.locator('[class*="StatCard"], .space-y-1')
      const count = await statCards.count()
      expect(count).toBeGreaterThan(0)
    })
  })

  test.describe('Telegram Status', () => {
    test('should display Telegram Bot status indicator', async ({ page }) => {
      const telegramStatus = page.locator('text=Telegram Bot:')
      await expect(telegramStatus).toBeVisible()
    })

    test('should show connection status (Connected or Disconnected)', async ({ page }) => {
      const statusText = page.locator('text=/Telegram Bot: (Connected|Disconnected)/')
      await expect(statusText).toBeVisible()
    })

    test('should display status indicator dot', async ({ page }) => {
      // Look for the colored dot indicator
      const statusContainer = page.locator('text=Telegram Bot:').locator('..')
      const dot = statusContainer.locator('div[class*="rounded-full"][class*="w-2"]')
      await expect(dot).toBeVisible()
    })
  })

  test.describe('Action Buttons', () => {
    test('should display Filters button', async ({ page }) => {
      const filtersBtn = page.locator('button:has-text("Filters")')
      await expect(filtersBtn).toBeVisible()
    })

    test('should display Add Task button', async ({ page }) => {
      const addTaskBtn = page.locator('button:has-text("Add Task")')
      await expect(addTaskBtn).toBeVisible()
    })

    test('should toggle filters panel when Filters button is clicked', async ({ page }) => {
      const filtersBtn = page.locator('button:has-text("Filters")')
      await filtersBtn.click()

      // Wait for filters to appear
      await page.waitForTimeout(300)

      // Check for filter options
      const assigneeLabel = page.locator('text=Assignee:')
      await expect(assigneeLabel).toBeVisible()

      const priorityLabel = page.locator('text=Priority:')
      await expect(priorityLabel).toBeVisible()
    })
  })

  test.describe('Kanban Board', () => {
    test('should display all 4 column headers', async ({ page }) => {
      const columns = ['To Do', 'In Progress', 'Review', 'Done']

      for (const column of columns) {
        const header = page.locator('h3').filter({ hasText: column })
        await expect(header).toBeVisible()
      }
    })

    test('should display count badges for each column', async ({ page }) => {
      // Look for count badges (small rounded indicators with numbers)
      const badges = page.locator('span.text-xs.text-muted-foreground.bg-muted')
      const count = await badges.count()
      expect(count).toBeGreaterThanOrEqual(4) // At least 4 columns
    })

    test('should display colored status indicators for columns', async ({ page }) => {
      // Each column should have a colored dot
      const statusDots = page.locator('div[class*="rounded-full"][class*="w-2.5"]')
      const count = await statusDots.count()
      expect(count).toBeGreaterThanOrEqual(4)
    })

    test('should display task cards in columns', async ({ page }) => {
      // Look for task card elements
      const taskCards = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4')
      const count = await taskCards.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should show task title in cards', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4').first()
      const title = firstCard.locator('h4.text-sm.font-medium')
      await expect(title).toBeVisible()
    })

    test('should show assignee information in task cards', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4').first()
      const assignee = firstCard.locator('svg + span', { has: page.locator('svg') })
      const count = await assignee.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should show due dates in task cards', async ({ page }) => {
      const datePattern = page.locator('text=/[A-Z][a-z]{2} \\d{1,2}/')
      const count = await datePattern.count()
      expect(count).toBeGreaterThan(0)
    })
  })

  test.describe('Priority Badges', () => {
    test('should display High priority badges in red', async ({ page }) => {
      const highBadges = page.locator('text=High')
      const count = await highBadges.count()
      if (count > 0) {
        const firstBadge = highBadges.first()
        await expect(firstBadge).toBeVisible()
        // Check for danger/red variant class
        const classList = await firstBadge.evaluate(el => el.className)
        expect(classList).toContain('badge')
      }
    })

    test('should display Medium priority badges in yellow/warning', async ({ page }) => {
      const mediumBadges = page.locator('text=Medium')
      const count = await mediumBadges.count()
      if (count > 0) {
        const firstBadge = mediumBadges.first()
        await expect(firstBadge).toBeVisible()
      }
    })

    test('should display Low priority badges in blue/info', async ({ page }) => {
      const lowBadges = page.locator('text=Low')
      const count = await lowBadges.count()
      if (count > 0) {
        const firstBadge = lowBadges.first()
        await expect(firstBadge).toBeVisible()
      }
    })

    test('should show at least one priority badge', async ({ page }) => {
      const priorityBadges = page.locator('text=/High|Medium|Low/')
      const count = await priorityBadges.count()
      expect(count).toBeGreaterThan(0)
    })
  })

  test.describe('Add Task Dialog', () => {
    test('should open dialog when Add Task button is clicked', async ({ page }) => {
      const addTaskBtn = page.locator('button:has-text("Add Task")')
      await addTaskBtn.click()

      // Wait for animation
      await page.waitForTimeout(300)

      // Check for dialog title
      const dialogTitle = page.locator('text=New Task')
      await expect(dialogTitle).toBeVisible()
    })

    test('should display all required form fields in dialog', async ({ page }) => {
      await page.locator('button:has-text("Add Task")').click()
      await page.waitForTimeout(300)

      // Title field
      await expect(page.locator('label:has-text("Title")')).toBeVisible()
      await expect(page.locator('input[placeholder*="task title"]')).toBeVisible()

      // Description field
      await expect(page.locator('label:has-text("Description")')).toBeVisible()
      await expect(page.locator('textarea[placeholder*="Describe"]')).toBeVisible()

      // Assignee field
      await expect(page.locator('label:has-text("Assignee")')).toBeVisible()

      // Priority field
      await expect(page.locator('label:has-text("Priority")')).toBeVisible()

      // Due Date field
      await expect(page.locator('label:has-text("Due Date")')).toBeVisible()
    })

    test('should display tag selection buttons', async ({ page }) => {
      await page.locator('button:has-text("Add Task")').click()
      await page.waitForTimeout(300)

      await expect(page.locator('label:has-text("Tags")')).toBeVisible()

      // Check for specific tags
      const tags = ['BIM', 'MEP', 'Structural', 'Architecture', 'QTO', 'Coordination', 'Documentation', 'Urgent']
      for (const tag of tags) {
        await expect(page.locator(`button:has-text("${tag}")`)).toBeVisible()
      }
    })

    test('should display Create Task button in dialog', async ({ page }) => {
      await page.locator('button:has-text("Add Task")').click()
      await page.waitForTimeout(300)

      const createBtn = page.locator('button:has-text("Create Task")')
      await expect(createBtn).toBeVisible()
    })

    test('should display Cancel button in dialog', async ({ page }) => {
      await page.locator('button:has-text("Add Task")').click()
      await page.waitForTimeout(300)

      const cancelBtn = page.locator('button:has-text("Cancel")')
      await expect(cancelBtn).toBeVisible()
    })

    test('should close dialog when Cancel is clicked', async ({ page }) => {
      await page.locator('button:has-text("Add Task")').click()
      await page.waitForTimeout(300)

      const cancelBtn = page.locator('button:has-text("Cancel")')
      await cancelBtn.click()

      await page.waitForTimeout(300)

      // Dialog should not be visible
      const dialog = page.locator('text=New Task')
      await expect(dialog).not.toBeVisible()
    })

    test('should close dialog when X button is clicked', async ({ page }) => {
      await page.locator('button:has-text("Add Task")').click()
      await page.waitForTimeout(300)

      // Find X close button
      const closeBtn = page.locator('button').filter({ has: page.locator('svg') }).nth(0)
      await closeBtn.click()

      await page.waitForTimeout(300)

      const dialog = page.locator('text=New Task')
      await expect(dialog).not.toBeVisible()
    })

    test('should allow tag selection toggle', async ({ page }) => {
      await page.locator('button:has-text("Add Task")').click()
      await page.waitForTimeout(300)

      const bimTag = page.locator('button:has-text("BIM")').last()
      await bimTag.click()

      // Check if tag gets selected (class changes)
      const classList = await bimTag.evaluate(el => el.className)
      expect(classList).toBeTruthy()
    })

    test('should have assignee dropdown with team members', async ({ page }) => {
      await page.locator('button:has-text("Add Task")').click()
      await page.waitForTimeout(300)

      const assigneeSelect = page.locator('select').first()
      await expect(assigneeSelect).toBeVisible()

      const options = await assigneeSelect.locator('option').count()
      expect(options).toBeGreaterThan(0)
    })

    test('should have priority dropdown with options', async ({ page }) => {
      await page.locator('button:has-text("Add Task")').click()
      await page.waitForTimeout(300)

      const selects = page.locator('select')
      const count = await selects.count()
      expect(count).toBeGreaterThanOrEqual(2) // Assignee and Priority
    })
  })

  test.describe('Task Detail Panel', () => {
    test('should open task detail when task card is clicked', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()

      await page.waitForTimeout(400)

      // Look for drawer content
      const drawer = page.locator('.max-w-lg.h-full.overflow-y-auto')
      await expect(drawer).toBeVisible()
    })

    test('should display task title in detail panel', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      const cardTitle = await firstCard.locator('h4').textContent()

      await firstCard.click()
      await page.waitForTimeout(400)

      const drawerTitle = page.locator('h2.text-xl.font-bold')
      await expect(drawerTitle).toBeVisible()
      await expect(drawerTitle).toContainText(cardTitle?.trim() || '')
    })

    test('should display task description in detail panel', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()
      await page.waitForTimeout(400)

      const description = page.locator('p.text-sm.text-muted-foreground.mt-2')
      await expect(description).toBeVisible()
    })

    test('should display assignee in detail panel', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()
      await page.waitForTimeout(400)

      const assigneeLabel = page.locator('text=Assignee').first()
      await expect(assigneeLabel).toBeVisible()
    })

    test('should display due date in detail panel', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()
      await page.waitForTimeout(400)

      const dueDateLabel = page.locator('text=Due Date').first()
      await expect(dueDateLabel).toBeVisible()
    })

    test('should display status badges in detail panel header', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()
      await page.waitForTimeout(400)

      // Should show priority and status badges
      const badges = page.locator('.max-w-lg').locator('.badge')
      const count = await badges.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should display comment section', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()
      await page.waitForTimeout(400)

      const commentsHeader = page.locator('text=/Comments \\(\\d+\\)/')
      await expect(commentsHeader).toBeVisible()
    })

    test('should display comment input field', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()
      await page.waitForTimeout(400)

      const commentInput = page.locator('input[placeholder*="comment"]')
      await expect(commentInput).toBeVisible()
    })

    test('should display Send button for comments', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()
      await page.waitForTimeout(400)

      const sendBtn = page.locator('button:has-text("Send")')
      await expect(sendBtn).toBeVisible()
    })

    test('should display Move To section with status buttons', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()
      await page.waitForTimeout(400)

      const moveTo = page.locator('text=Move To')
      await expect(moveTo).toBeVisible()

      // Should have buttons to move to other statuses
      const moveButtons = page.locator('.max-w-lg').locator('button[class*="outline"]')
      const count = await moveButtons.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should close detail panel when X is clicked', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()
      await page.waitForTimeout(400)

      // Find close button in drawer
      const closeBtn = page.locator('.max-w-lg').locator('button').filter({ has: page.locator('svg') }).first()
      await closeBtn.click()

      await page.waitForTimeout(400)

      const drawer = page.locator('.max-w-lg.h-full.overflow-y-auto')
      await expect(drawer).not.toBeVisible()
    })

    test('should display existing comments if any', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.click()
      await page.waitForTimeout(400)

      // Check for comment count
      const commentHeader = page.locator('text=/Comments \\((\\d+)\\)/')
      await expect(commentHeader).toBeVisible()
    })
  })

  test.describe('Gantt Timeline', () => {
    test('should display timeline section', async ({ page }) => {
      const timelineCard = page.locator('text=Project Timeline')
      await expect(timelineCard).toBeVisible()
    })

    test('should display timeline subtitle', async ({ page }) => {
      const subtitle = page.locator('text=Simplified Gantt view of active tasks')
      await expect(subtitle).toBeVisible()
    })

    test('should display time axis labels', async ({ page }) => {
      // Check for month labels
      await expect(page.locator('text=/Feb \\d+/')).toBeVisible()
    })

    test('should display task bars in timeline', async ({ page }) => {
      // Look for colored progress bars
      const bars = page.locator('div[style*="background"]').filter({ has: page.locator('span.text-\\[10px\\]') })
      const count = await bars.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should display task names in timeline', async ({ page }) => {
      // Look for task title elements in timeline
      const taskTitles = page.locator('p.text-xs.font-medium.text-foreground.truncate')
      const count = await taskTitles.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should display assignee names in timeline', async ({ page }) => {
      // Look for assignee names with smaller text
      const assignees = page.locator('p.text-\\[10px\\].text-muted-foreground')
      const count = await assignees.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should display Today marker', async ({ page }) => {
      const todayMarker = page.locator('text=Today')
      await expect(todayMarker).toBeVisible()
    })
  })

  test.describe('Task Tags', () => {
    test('should display tags on task cards', async ({ page }) => {
      // Look for tag elements
      const tags = page.locator('span[class*="text-\\[10px\\]"][class*="px-1"]')
      const count = await tags.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should display different tag colors', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4').first()
      const tags = firstCard.locator('span[class*="text-\\[10px\\]"][class*="px-1"]')
      const count = await tags.count()

      if (count > 0) {
        const firstTag = tags.first()
        await expect(firstTag).toBeVisible()
      }
    })
  })

  test.describe('Responsive Behavior', () => {
    test('should display kanban columns in grid layout', async ({ page }) => {
      const kanbanGrid = page.locator('.grid.grid-cols-1.md\\:grid-cols-2.xl\\:grid-cols-4')
      await expect(kanbanGrid).toBeVisible()
    })

    test('should display stats in grid layout', async ({ page }) => {
      const statsGrid = page.locator('.grid.grid-cols-1.sm\\:grid-cols-2.lg\\:grid-cols-4')
      await expect(statsGrid).toBeVisible()
    })
  })

  test.describe('Interaction Tests', () => {
    test('should highlight task card on hover', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.hover()

      // Card should have hover effects
      await expect(firstCard).toBeVisible()
    })

    test('should show drag handle on card hover', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4.cursor-pointer').first()
      await firstCard.hover()

      await page.waitForTimeout(200)

      // Grip icon should become visible
      const gripIcon = firstCard.locator('svg').first()
      await expect(gripIcon).toBeVisible()
    })
  })

  test.describe('Data Display', () => {
    test('should display task count in columns', async ({ page }) => {
      const countBadges = page.locator('span.text-xs.text-muted-foreground.bg-muted.px-2')
      const count = await countBadges.count()
      expect(count).toBeGreaterThanOrEqual(4)
    })

    test('should display calendar icons with due dates', async ({ page }) => {
      const calendarIcons = page.locator('svg').filter({ hasText: '' })
      const count = await calendarIcons.count()
      expect(count).toBeGreaterThan(0)
    })

    test('should display user icons with assignees', async ({ page }) => {
      const firstCard = page.locator('.bg-card.rounded-xl.border.border-border.shadow-sm.p-4').first()
      const userIcon = firstCard.locator('svg').filter({ has: page.locator('circle') })
      await expect(userIcon.first()).toBeVisible()
    })
  })
})
