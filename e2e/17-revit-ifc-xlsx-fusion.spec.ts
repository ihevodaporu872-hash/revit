import { test, expect } from '@playwright/test'
import path from 'path'
import fs from 'fs/promises'
import { spawn, ChildProcess } from 'child_process'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const ROOT = path.resolve(__dirname, '..')
const TEST_DATA_DIR = path.join(ROOT, 'test_ifc_excel')
const SCREEN_DIR = path.join(ROOT, 'test-results', 'revit-ifc-xlsx')

let backendProcess: ChildProcess | null = null

async function waitForBackend(url: string, timeoutMs = 20000): Promise<boolean> {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return true
    } catch {
      // keep waiting
    }
    await new Promise((r) => setTimeout(r, 300))
  }
  return false
}

async function ensureBackend() {
  const healthUrl = 'http://127.0.0.1:3001/api/health'
  if (await waitForBackend(healthUrl, 2000)) return

  backendProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: ROOT,
    env: {
      ...process.env,
      PORT: '3001',
    },
    stdio: 'pipe',
  })

  const ready = await waitForBackend(healthUrl, 20000)
  if (!ready) {
    throw new Error('Backend did not start on :3001 for fusion E2E test')
  }
}

async function discoverDataFiles() {
  const entries = await fs.readdir(TEST_DATA_DIR)
  const ifc = entries.find((f) => f.toLowerCase().endsWith('.ifc'))
  const xlsx = entries.find((f) => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'))
  if (!ifc || !xlsx) {
    throw new Error('Expected both IFC and XLSX files in test_ifc_excel/')
  }
  return {
    ifcPath: path.join(TEST_DATA_DIR, ifc),
    xlsxPath: path.join(TEST_DATA_DIR, xlsx),
    ifcName: ifc,
  }
}

async function capture(page: import('@playwright/test').Page, fileName: string) {
  await fs.mkdir(SCREEN_DIR, { recursive: true })
  await page.screenshot({
    path: path.join(SCREEN_DIR, fileName),
    fullPage: true,
  })
}

test.beforeAll(async () => {
  await ensureBackend()
})

test.afterAll(async () => {
  if (backendProcess && !backendProcess.killed) {
    backendProcess.kill('SIGTERM')
  }
})

test('revit-ifc-xlsx fusion visual/e2e flow', async ({ page }) => {
  test.setTimeout(240000)
  const { ifcPath, xlsxPath, ifcName } = await discoverDataFiles()

  await page.goto('/viewer')
  await expect(page.getByTestId('upload-ifc-btn')).toBeVisible()
  await expect(page.getByTestId('upload-revit-xlsx-btn')).toBeVisible()

  // 1) Upload IFC and capture
  const [ifcChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('upload-ifc-btn').click(),
  ])
  await ifcChooser.setFiles(ifcPath)
  await expect(page.getByText(ifcName)).toBeVisible({ timeout: 120000 })
  await capture(page, '01-ifc-loaded.png')

  // 2) Upload Revit XLSX and capture
  const [xlsxChooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    page.getByTestId('upload-revit-xlsx-btn').click(),
  ])
  await xlsxChooser.setFiles(xlsxPath)
  await page.waitForTimeout(6000)
  await capture(page, '02-revit-xlsx-imported.png')

  // 3) Match coverage (if badge exists)
  if (await page.getByTestId('match-badge').count()) {
    await page.getByTestId('match-badge').click()
    await expect(page.getByTestId('match-report-dialog')).toBeVisible()
  }
  await capture(page, '03-match-coverage.png')

  // 4) Try selecting one element and capture properties panel
  const canvas = page.locator('canvas[data-engine]')
  await canvas.click({ position: { x: 220, y: 220 } })
  await page.waitForTimeout(1200)
  await capture(page, '04-element-revit-props.png')

  // 5) Try transparent focus using Sets panel (best-effort but deterministic)
  const showPanelBtn = page.locator('button[title="Show Panel"]')
  const hidePanelBtn = page.locator('button[title="Hide Panel"]')
  if (await showPanelBtn.count()) {
    await showPanelBtn.click()
  } else if (await hidePanelBtn.count()) {
    // already shown
  }
  if (await page.getByRole('button', { name: 'Sets' }).count()) {
    await page.getByRole('button', { name: 'Sets' }).click()
    if (await page.getByRole('button', { name: /Save Selection/i }).count()) {
      await page.getByRole('button', { name: /Save Selection/i }).click()
      await page.locator('input[placeholder*="Exterior Walls"]').fill('Focus Set')
      await page.locator('button').filter({ hasText: /^Create Set$/ }).last().click()
      const transparentBtn = page.locator('button[title="Transparent"]').first()
      if (await transparentBtn.count()) {
        await transparentBtn.click()
      }
    }
  }
  await capture(page, '05-transparent-focus.png')

  // 6) Global wireframe mode
  await expect(page.getByTestId('global-wireframe-toggle')).toBeVisible()
  await page.getByTestId('global-wireframe-toggle').click()
  await capture(page, '06-wireframe-mode.png')

  // 7) Unmatched report snapshot
  if (await page.getByTestId('match-badge').count()) {
    await page.getByTestId('match-badge').click()
    if (await page.getByText(/IFC-only elements|Revit-only elements|Ambiguous matches/i).count()) {
      const expandable = page.getByText(/IFC-only elements|Revit-only elements|Ambiguous matches/i).first()
      await expandable.click()
    }
  }
  await capture(page, '07-unmatched-report.png')
})
