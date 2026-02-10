import test, { before, after } from 'node:test'
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs/promises'
import os from 'node:os'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '../..')
const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads')
const PORT = Number(process.env.REVIT_TEST_PORT || (3500 + Math.floor(Math.random() * 2000)))
const BASE_URL = `http://127.0.0.1:${PORT}`

let serverProcess = null
let startupLogs = ''

async function waitForServer(url, timeoutMs = 30000) {
  const started = Date.now()
  while (Date.now() - started < timeoutMs) {
    try {
      const response = await fetch(url)
      if (response.ok) return
    } catch {
      // not ready yet
    }
    await new Promise((r) => setTimeout(r, 250))
  }
  throw new Error(`Server did not start within ${timeoutMs}ms`)
}

async function postFile(endpoint, filePath, fileName, extraFields = {}) {
  const buffer = await fs.readFile(filePath)
  const form = new FormData()
  form.append('file', new Blob([buffer]), fileName)
  for (const [key, value] of Object.entries(extraFields)) {
    form.append(key, String(value))
  }
  return fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    body: form,
  })
}

async function postJson(endpoint, payload) {
  return fetch(`${BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  })
}

async function listMatchingUploads(prefix) {
  await fs.mkdir(UPLOADS_DIR, { recursive: true })
  const files = await fs.readdir(UPLOADS_DIR)
  return files.filter((name) => name.startsWith(prefix))
}

before(async () => {
  startupLogs = ''
  serverProcess = spawn(process.execPath, ['server/index.js'], {
    cwd: PROJECT_ROOT,
    env: {
      ...process.env,
      PORT: String(PORT),
      ENABLE_RVT_CONVERTER: 'false',
      SUPABASE_URL: '',
      SUPABASE_ANON_KEY: '',
      GOOGLE_API_KEY: '',
    },
    stdio: 'pipe',
  })

  serverProcess.stdout?.on('data', (d) => { startupLogs += d.toString() })
  serverProcess.stderr?.on('data', (d) => { startupLogs += d.toString() })

  serverProcess.on('error', (err) => {
    throw err
  })

  try {
    await waitForServer(`${BASE_URL}/api/health`, 30000)
  } catch (err) {
    throw new Error(`${err.message}\nServer logs:\n${startupLogs}`)
  }
})

after(async () => {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill('SIGTERM')
  }
})

test('POST /api/revit/process-model returns structured fallback when converter disabled', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revit-process-'))
  const rvtPath = path.join(tmpDir, 'sample.rvt')
  await fs.writeFile(rvtPath, 'dummy-rvt')

  const response = await postFile('/api/revit/process-model', rvtPath, 'sample.rvt', {
    projectId: 'itest',
    modelVersion: 'v-itest',
  })
  const body = await response.json()

  assert.equal(response.status, 503)
  assert.equal(body.status, 'fallback')
  assert.equal(body.mode, 'manual_ifc_xlsx')
  assert.equal(body.projectId, 'itest')
  assert.equal(body.modelVersion, 'v-itest')
  assert.ok(Array.isArray(body.instructions))
})

test('POST /api/revit/upload-xlsx rejects non-xlsx and cleans temporary upload file', async () => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revit-upload-bad-'))
  const baseName = `cleanup-sentinel-${Date.now()}`
  const txtPath = path.join(tmpDir, `${baseName}.txt`)
  await fs.writeFile(txtPath, 'not an xlsx')

  const response = await postFile('/api/revit/upload-xlsx', txtPath, `${baseName}.txt`)
  const body = await response.json()
  assert.equal(response.status, 400)
  assert.match(String(body.error || ''), /xlsx/i)

  await new Promise((r) => setTimeout(r, 200))
  const leftovers = await listMatchingUploads(baseName)
  assert.equal(leftovers.length, 0)
})

test('POST /api/revit/upload-xlsx stores records in runtime fallback without Supabase config', async () => {
  const XLSX = (await import('xlsx')).default
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'revit-upload-good-'))
  const baseName = `valid-upload-${Date.now()}`
  const xlsxPath = path.join(tmpDir, `${baseName}.xlsx`)
  const projectId = 'runtime-itest'
  const modelVersion = `v-runtime-${Date.now()}`
  const globalId = `RUNTIME-GID-${Date.now()}`

  const wb = XLSX.utils.book_new()
  const sheet = XLSX.utils.json_to_sheet([
    {
      'IfcGUID : String': globalId,
      'ID : Integer': 101,
      'Name : String': 'Wall A',
      'Area : Double': 12.4,
      'Volume : Double': 5.7,
    },
  ])
  XLSX.utils.book_append_sheet(wb, sheet, 'Sheet1')
  XLSX.writeFile(wb, xlsxPath)

  const response = await postFile('/api/revit/upload-xlsx', xlsxPath, `${baseName}.xlsx`, {
    projectId,
    modelVersion,
  })
  const body = await response.json()
  assert.equal(response.status, 200)
  assert.equal(body.status, 'success')
  assert.equal(body.insertedCount, 1)
  assert.equal(body.persistence, 'runtime')
  assert.equal(body.projectId, projectId)
  assert.equal(body.modelVersion, modelVersion)

  const bulkResponse = await postJson('/api/revit/properties/bulk', {
    projectId,
    modelVersion,
    globalIds: [globalId],
    elementIds: [101],
  })
  const bulkBody = await bulkResponse.json()
  assert.equal(bulkResponse.status, 200)
  assert.equal(bulkBody.count, 1)
  assert.equal(bulkBody.source, 'runtime')
  assert.equal(bulkBody.unresolved.globalIds.length, 0)
  assert.equal(bulkBody.unresolved.elementIds.length, 0)
  assert.equal(bulkBody.results[0].global_id, globalId)

  const singleResponse = await fetch(`${BASE_URL}/api/revit/properties/${globalId}?projectId=${projectId}&modelVersion=${modelVersion}`)
  const singleBody = await singleResponse.json()
  assert.equal(singleResponse.status, 200)
  assert.equal(singleBody.global_id, globalId)
  assert.equal(singleBody.source, 'runtime')

  const reportResponse = await postJson('/api/revit/match-report', {
    projectId,
    modelVersion,
    ifcElements: [{
      expressID: 1,
      type: 'IfcWall',
      globalId,
      tag: '101',
      name: 'Wall A',
      properties: [],
    }],
  })
  const reportBody = await reportResponse.json()
  assert.equal(reportResponse.status, 200)
  assert.equal(reportBody.source, 'runtime')
  assert.equal(reportBody.matchRate, 1)
  assert.equal(reportBody.totals.totalMatched, 1)
  assert.equal(reportBody.totals.totalRevitRows, 1)

  await new Promise((r) => setTimeout(r, 200))
  const leftovers = await listMatchingUploads(baseName)
  assert.equal(leftovers.length, 0)
})
