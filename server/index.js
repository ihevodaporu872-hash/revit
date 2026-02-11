// ============================================================================
// Jens Construction Platform - Express Backend Server
// ============================================================================
// Unified API server for CAD/BIM conversion, cost estimation (CWICR),
// validation, AI analysis, project management, document management,
// and QTO report generation.
// ============================================================================

import express from 'express'
import cors from 'cors'
import multer from 'multer'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { exec, spawn } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'
import {
  deriveModelIdentity,
  resolveRevitColumns,
  mapRevitRowsToRecords,
  buildUploadCoverage,
  summarizeMappedColumns,
  getUnmappedColumns,
} from './revit-xlsx.js'
import { buildMatchReport } from './revit-matcher.js'
import { createCWICREngine } from './cwicr-engine.js'
import { createCostEngine } from './cost-engine.js'
import { createCADPipeline } from './cad-pipeline.js'
import { createSheetsSync } from './sheets-sync.js'

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const PROJECT_ROOT = path.resolve(__dirname, '..')

dotenv.config({ path: path.join(PROJECT_ROOT, '.env') })

const app = express()
const PORT = process.env.PORT || 3001
const execAsync = promisify(exec)

// ---------------------------------------------------------------------------
// Supabase Server Client
// ---------------------------------------------------------------------------

let supabaseServer = null
if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
  supabaseServer = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_ANON_KEY)
  console.log('[Jens] Supabase server client initialized')
} else {
  console.warn('[Jens] WARNING: Supabase credentials not set — persistence disabled')
}

// ---------------------------------------------------------------------------
// Gemini AI Initialization
// ---------------------------------------------------------------------------

let genAI = null
let geminiModel = null

if (process.env.GOOGLE_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
  geminiModel = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' })
  console.log('[Jens] Gemini AI initialized (gemini-2.0-flash)')
} else {
  console.warn('[Jens] WARNING: GOOGLE_API_KEY not set - AI features will be unavailable')
}

// ---------------------------------------------------------------------------
// Native Engine Initialization (replaces n8n workflows)
// ---------------------------------------------------------------------------

let cwicr = null, costEngine = null, cadPipeline = null, sheetsSync = null
if (supabaseServer && genAI) {
  cwicr = createCWICREngine({ supabase: supabaseServer, genAI, geminiModel })
  costEngine = createCostEngine({ supabase: supabaseServer, geminiModel, cwicr })
  cadPipeline = createCADPipeline({ geminiModel, uploadsDir: UPLOADS_DIR, converterPaths: CONVERTER_PATHS })
  sheetsSync = createSheetsSync({ supabase: supabaseServer })
  console.log('[Jens] Native engines initialized (CWICR, Cost, CAD, Sheets)')
} else {
  console.warn('[Jens] WARNING: Engines require Supabase + Gemini — native pipelines disabled')
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// Request logger
app.use((req, _res, next) => {
  const timestamp = new Date().toISOString()
  console.log(`[${timestamp}] ${req.method} ${req.path}`)
  next()
})

// ---------------------------------------------------------------------------
// File Upload Configuration (multer)
// ---------------------------------------------------------------------------

const UPLOADS_DIR = path.join(PROJECT_ROOT, 'uploads')

async function ensureUploadsDir() {
  try {
    await fs.mkdir(UPLOADS_DIR, { recursive: true })
  } catch { /* already exists */ }
}
ensureUploadsDir()

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, UPLOADS_DIR),
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`
    const ext = path.extname(file.originalname)
    const base = path.basename(file.originalname, ext)
    cb(null, `${base}-${uniqueSuffix}${ext}`)
  },
})

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 }, // 500 MB
  fileFilter: (_req, file, cb) => {
    const allowedExtensions = [
      '.rvt', '.ifc', '.dwg', '.dgn', '.dxf',
      '.xlsx', '.xls', '.csv',
      '.pdf', '.json', '.xml', '.txt',
    ]
    const ext = path.extname(file.originalname).toLowerCase()
    if (allowedExtensions.includes(ext)) {
      cb(null, true)
    } else {
      cb(new Error(`Unsupported file type: ${ext}`))
    }
  },
})

// ---------------------------------------------------------------------------
// Converter Paths
// ---------------------------------------------------------------------------

const PIPELINE_ROOT = path.join(
  PROJECT_ROOT,
  'cad2data-Revit-IFC-DWG-DGN-pipeline-with-conversion-validation-qto'
)

const CONVERTER_PATHS = {
  rvt: {
    dir: path.join(PIPELINE_ROOT, 'DDC_CONVERTER_REVIT'),
    exe: 'RvtExporter.exe',
    label: 'Revit',
  },
  ifc: {
    dir: path.join(PIPELINE_ROOT, 'DDC_CONVERTER_IFC'),
    exe: 'IfcExporter.exe',
    label: 'IFC',
  },
  dwg: {
    dir: path.join(PIPELINE_ROOT, 'DDC_CONVERTER_DWG'),
    exe: 'DwgExporter.exe',
    label: 'DWG',
  },
  dgn: {
    dir: path.join(PIPELINE_ROOT, 'DDC_CONVERTER_DGN'),
    exe: 'DgnExporter.exe',
    label: 'DGN',
  },
  rvt2ifc: {
    dir: path.join(PIPELINE_ROOT, 'DDC_CONVERTER_Revit2IFC', 'DDC_REVIT2IFC_CONVERTER'),
    exe: 'RVT2IFCconverter.exe',
    label: 'Revit→IFC',
  },
}

const ENABLE_RVT_CONVERTER = ['1', 'true', 'yes', 'on']
  .includes(String(process.env.ENABLE_RVT_CONVERTER || '').trim().toLowerCase())

const REQUIRED_SUPABASE_TABLES = ['ifc_element_properties']
const OPTIONAL_SUPABASE_TABLES = ['model_runs', 'match_reports', 'match_overrides']

// ---------------------------------------------------------------------------
// RVT Async Job Store (in-memory)
// ---------------------------------------------------------------------------

const rvtJobs = new Map()
const MAX_CONCURRENT_RVT = 3
let activeRvtCount = 0

function purgeOldJobs() {
  const TTL = 30 * 60 * 1000
  const now = Date.now()
  for (const [id, job] of rvtJobs.entries()) {
    if (now - job.startTime > TTL && (job.status === 'complete' || job.status === 'error')) {
      rvtJobs.delete(id)
    }
  }
}
setInterval(purgeOldJobs, 5 * 60 * 1000)

function broadcastSSE(job, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const client of job.sseClients) {
    try {
      client.write(payload)
    } catch { /* client disconnected */ }
  }
}

// ---------------------------------------------------------------------------
// CWICR Data (Cost Work Items, Costs, Resources)
// ---------------------------------------------------------------------------

const CWICR_ROOT = path.join(PROJECT_ROOT, 'OpenConstructionEstimate-DDC-CWICR')

const CWICR_LANGUAGE_MAP = {
  en: { dir: 'EN___DDC_CWICR', file: 'ENG_TORONTO_workitems_costs_resources_DDC_CWICR_SIMPLE.xlsx', city: 'Toronto' },
  de: { dir: 'DE___DDC_CWICR', file: 'DE_BERLIN_workitems_costs_resources_DDC_CWICR_SIMPLE.xlsx', city: 'Berlin' },
  ru: { dir: 'RU___DDC_CWICR', file: 'RU_STPETERSBURG_workitems_costs_resources_DDC_CWICR_SIMPLE.xlsx', city: 'St. Petersburg' },
  fr: { dir: 'FR___DDC_CWICR', file: 'FR_PARIS_workitems_costs_resources_DDC_CWICR_SIMPLE.xlsx', city: 'Paris' },
  es: { dir: 'ES___DDC_CWICR', file: null, city: 'Madrid' },
  ar: { dir: 'AR___DDC_CWICR', file: null, city: 'Dubai' },
  zh: { dir: 'ZH___DDC_CWICR', file: null, city: 'Beijing' },
  hi: { dir: 'HI___DDC_CWICR', file: null, city: 'Delhi' },
  pt: { dir: 'PT___DDC_CWICR', file: null, city: 'Sao Paulo' },
}

// In-memory CWICR cache: { lang: [ { ...row } ] }
const cwicrCache = {}

/**
 * Load CWICR data from Excel for a given language.
 * Returns an array of row objects or empty array on failure.
 */
async function loadCWICRData(lang = 'en') {
  if (cwicrCache[lang]) return cwicrCache[lang]

  const langConfig = CWICR_LANGUAGE_MAP[lang]
  if (!langConfig) {
    console.warn(`[CWICR] Unsupported language: ${lang}`)
    return []
  }

  // Try to find the SIMPLE xlsx file
  const langDir = path.join(CWICR_ROOT, langConfig.dir)
  let xlsxPath = langConfig.file
    ? path.join(langDir, langConfig.file)
    : null

  // If no configured file, try to find any SIMPLE xlsx
  if (!xlsxPath || !existsSync(xlsxPath)) {
    try {
      const files = await fs.readdir(langDir)
      const simpleFile = files.find(f => f.includes('SIMPLE') && f.endsWith('.xlsx'))
      if (simpleFile) {
        xlsxPath = path.join(langDir, simpleFile)
      } else {
        const anyXlsx = files.find(f => f.endsWith('.xlsx'))
        if (anyXlsx) xlsxPath = path.join(langDir, anyXlsx)
      }
    } catch {
      console.warn(`[CWICR] Cannot read directory for lang=${lang}: ${langDir}`)
      return []
    }
  }

  if (!xlsxPath || !existsSync(xlsxPath)) {
    console.warn(`[CWICR] No Excel file found for lang=${lang}`)
    return []
  }

  try {
    // Dynamic import to avoid hard crash if xlsx is not installed
    const XLSX = (await import('xlsx')).default
    const workbook = XLSX.readFile(xlsxPath)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
    cwicrCache[lang] = rows
    console.log(`[CWICR] Loaded ${rows.length} rows for lang=${lang} from ${path.basename(xlsxPath)}`)
    return rows
  } catch (err) {
    console.error(`[CWICR] Failed to load Excel for lang=${lang}:`, err.message)
    return []
  }
}

// ---------------------------------------------------------------------------
// In-Memory Data Stores
// ---------------------------------------------------------------------------

/** Conversion history */
const conversionHistory = []

/** Tasks */
let taskIdCounter = 4
const tasks = [
  {
    id: '1',
    title: 'Review structural IFC model',
    description: 'Check structural model for clash detection readiness',
    status: 'in-progress',
    priority: 'high',
    assignee: 'Alex M.',
    dueDate: '2026-02-15',
    module: 'viewer',
    createdAt: '2026-01-20T10:00:00Z',
    updatedAt: '2026-02-01T14:30:00Z',
  },
  {
    id: '2',
    title: 'Convert DWG floor plans to IFC',
    description: 'Batch convert all architectural DWG files to IFC 2x3',
    status: 'todo',
    priority: 'medium',
    assignee: 'Sarah K.',
    dueDate: '2026-02-20',
    module: 'converter',
    createdAt: '2026-01-25T09:00:00Z',
    updatedAt: '2026-01-25T09:00:00Z',
  },
  {
    id: '3',
    title: 'Generate cost estimate for Phase 2',
    description: 'Use CWICR database to estimate Phase 2 construction costs',
    status: 'todo',
    priority: 'high',
    assignee: 'Michael R.',
    dueDate: '2026-02-25',
    module: 'cost',
    createdAt: '2026-02-01T11:00:00Z',
    updatedAt: '2026-02-01T11:00:00Z',
  },
]

/** Documents */
const documents = [
  {
    id: '1',
    name: 'Structural Design Report v2.1',
    type: 'report',
    category: 'structural',
    uploadedBy: 'Alex M.',
    uploadedAt: '2026-01-15T08:00:00Z',
    size: 2450000,
    format: 'pdf',
    version: '2.1',
  },
  {
    id: '2',
    name: 'Architectural Floor Plans - Level 1-5',
    type: 'drawing',
    category: 'architectural',
    uploadedBy: 'Sarah K.',
    uploadedAt: '2026-01-20T14:00:00Z',
    size: 18500000,
    format: 'dwg',
    version: '1.0',
  },
  {
    id: '3',
    name: 'MEP Coordination Meeting Notes - Jan 2026',
    type: 'meeting-minutes',
    category: 'coordination',
    uploadedBy: 'Michael R.',
    uploadedAt: '2026-01-28T16:30:00Z',
    size: 125000,
    format: 'docx',
    version: '1.0',
  },
  {
    id: '4',
    name: 'Site Survey Data - Phase 1',
    type: 'survey',
    category: 'site',
    uploadedBy: 'David L.',
    uploadedAt: '2026-02-01T10:00:00Z',
    size: 5600000,
    format: 'xlsx',
    version: '1.0',
  },
]

/** RFIs */
const rfis = [
  {
    id: 'RFI-001',
    subject: 'Foundation depth clarification at Grid C-7',
    status: 'open',
    priority: 'high',
    submittedBy: 'Alex M.',
    assignedTo: 'Structural Engineer',
    createdAt: '2026-01-25T09:15:00Z',
    dueDate: '2026-02-10',
    description: 'Drawing S-201 shows 1.5m foundation depth but geotechnical report recommends 2.0m at Grid C-7. Please clarify.',
    responses: [],
  },
  {
    id: 'RFI-002',
    subject: 'HVAC duct routing conflict at Level 3',
    status: 'answered',
    priority: 'medium',
    submittedBy: 'Michael R.',
    assignedTo: 'MEP Coordinator',
    createdAt: '2026-01-20T11:00:00Z',
    dueDate: '2026-02-05',
    description: 'HVAC main duct on Level 3 conflicts with structural beam at Grid B-4. Need revised routing.',
    responses: [
      {
        respondedBy: 'MEP Coordinator',
        respondedAt: '2026-01-28T15:00:00Z',
        text: 'Duct to be rerouted below beam soffit. Revised drawing M-301 Rev B attached.',
      },
    ],
  },
  {
    id: 'RFI-003',
    subject: 'Exterior cladding material specification',
    status: 'open',
    priority: 'low',
    submittedBy: 'Sarah K.',
    assignedTo: 'Architect',
    createdAt: '2026-02-03T14:00:00Z',
    dueDate: '2026-02-17',
    description: 'Specification section 07 42 13 references two different cladding systems. Please confirm which system applies to the east elevation.',
    responses: [],
  },
]

/** Submittals */
const submittals = [
  {
    id: 'SUB-001',
    title: 'Concrete Mix Design - Grade C40',
    status: 'approved',
    submittedBy: 'Contractor A',
    reviewedBy: 'Structural Engineer',
    category: 'materials',
    submittedAt: '2026-01-10T08:00:00Z',
    reviewedAt: '2026-01-18T16:00:00Z',
    specSection: '03 30 00',
    description: 'Concrete mix design for all structural elements per specification section 03 30 00.',
  },
  {
    id: 'SUB-002',
    title: 'Structural Steel Shop Drawings - Phase 1',
    status: 'under-review',
    submittedBy: 'Steel Fabricator',
    reviewedBy: null,
    category: 'shop-drawings',
    submittedAt: '2026-01-28T10:00:00Z',
    reviewedAt: null,
    specSection: '05 12 00',
    description: 'Shop drawings for structural steel framing at Levels 1-3, including connection details.',
  },
  {
    id: 'SUB-003',
    title: 'Fire Alarm System - Product Data',
    status: 'submitted',
    submittedBy: 'Electrical Subcontractor',
    reviewedBy: null,
    category: 'product-data',
    submittedAt: '2026-02-05T09:00:00Z',
    reviewedAt: null,
    specSection: '28 31 00',
    description: 'Product data sheets for addressable fire alarm control panel and devices.',
  },
]

// ---------------------------------------------------------------------------
// Helper: Ensure Gemini is available
// ---------------------------------------------------------------------------

function requireGemini(res) {
  if (!geminiModel) {
    res.status(503).json({
      error: 'AI features unavailable',
      message: 'GOOGLE_API_KEY is not configured. Set it in the .env file.',
    })
    return false
  }
  return true
}

function errorPayload(code, message, details = {}) {
  return {
    error: message,
    code,
    ...details,
  }
}

function tableMissingError(err) {
  const msg = String(err?.message || '').toLowerCase()
  return msg.includes('relation') && msg.includes('does not exist')
    || msg.includes('could not find the table')
    || msg.includes('schema cache')
}

function infrastructureDbError(err) {
  if (!err) return false
  if (tableMissingError(err)) return true
  const msg = String(err?.message || err?.reason || '').toLowerCase()
  return msg.includes('failed to fetch')
    || msg.includes('network')
    || msg.includes('timeout')
    || msg.includes('connection')
    || msg.includes('permission denied')
}

async function safeUnlink(filePath) {
  if (!filePath) return
  try {
    await fs.unlink(filePath)
  } catch {
    // ignore cleanup errors
  }
}

async function safeRmDir(dirPath) {
  if (!dirPath) return
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
  } catch {
    // ignore cleanup errors
  }
}

function normalizeStringArray(values, max = 1000) {
  if (!Array.isArray(values)) return []
  return [...new Set(
    values
      .map((v) => String(v || '').trim())
      .filter(Boolean),
  )].slice(0, max)
}

function normalizeNumberArray(values, max = 1000) {
  if (!Array.isArray(values)) return []
  return [...new Set(
    values
      .map((v) => Number.parseInt(String(v), 10))
      .filter((v) => Number.isFinite(v)),
  )].slice(0, max)
}

function resolveScope(input = {}, defaults = {}) {
  const projectIdRaw = input?.projectId !== undefined && input?.projectId !== null
    ? String(input.projectId).trim()
    : ''
  const modelVersionRaw = input?.modelVersion !== undefined && input?.modelVersion !== null
    ? String(input.modelVersion).trim()
    : ''

  return {
    projectId: projectIdRaw || defaults.projectId || 'default',
    modelVersion: modelVersionRaw || defaults.modelVersion || null,
  }
}

function converterAvailability() {
  const result = {}
  for (const [key, config] of Object.entries(CONVERTER_PATHS)) {
    const exePath = path.join(config.dir, config.exe)
    result[key] = {
      label: config.label,
      available: existsSync(exePath),
      enabled: key === 'rvt' ? ENABLE_RVT_CONVERTER : true,
      path: config.dir,
      exe: config.exe,
    }
  }
  return result
}

async function checkSupabaseTable(table) {
  if (!supabaseServer) {
    return { table, available: false, required: REQUIRED_SUPABASE_TABLES.includes(table), reason: 'supabase_not_configured' }
  }
  const { error } = await supabaseServer.from(table).select('id', { head: true, count: 'exact' }).limit(1)
  if (error) {
    return {
      table,
      available: false,
      required: REQUIRED_SUPABASE_TABLES.includes(table),
      reason: tableMissingError(error) ? 'missing_table' : 'query_error',
      message: error.message,
    }
  }
  return { table, available: true, required: REQUIRED_SUPABASE_TABLES.includes(table) }
}

async function dbPreflight() {
  const tables = [...REQUIRED_SUPABASE_TABLES, ...OPTIONAL_SUPABASE_TABLES]
  const checks = await Promise.all(tables.map((t) => checkSupabaseTable(t)))
  return {
    available: checks.every((c) => !c.required || c.available),
    tables: checks,
    requiredMissing: checks.filter((c) => c.required && !c.available).map((c) => c.table),
  }
}

function normalizeModelScope(body = {}, file = null) {
  const identity = deriveModelIdentity(
    file || { originalname: body.sourceFile || 'model', size: body.fileSize || 0 },
    body.projectId,
    body.modelVersion,
  )
  return {
    projectId: identity.projectId,
    modelVersion: identity.modelVersion,
    sourceFile: body.sourceFile || identity.sourceFile,
  }
}

const RUNTIME_REVISIONS_LIMIT = 40
const runtimeRevitStore = new Map()

function runtimeModelKey(projectId, modelVersion) {
  return `${projectId}::${modelVersion || 'latest'}`
}

function rowIdentityKey(row) {
  return `${row.global_id || ''}|${row.revit_element_id ?? ''}|${row.revit_unique_id || ''}`
}

function dedupeRows(rows) {
  const map = new Map()
  for (const row of rows || []) {
    map.set(rowIdentityKey(row), row)
  }
  return Array.from(map.values())
}

function buildRuntimeIndexes(rows) {
  const byGlobalId = new Map()
  const byElementId = new Map()

  for (const row of rows) {
    if (row.global_id) {
      const bucket = byGlobalId.get(row.global_id) || []
      bucket.push(row)
      byGlobalId.set(row.global_id, bucket)
    }
    if (Number.isFinite(row.revit_element_id)) {
      const bucket = byElementId.get(row.revit_element_id) || []
      bucket.push(row)
      byElementId.set(row.revit_element_id, bucket)
    }
  }
  return { byGlobalId, byElementId }
}

function touchRuntimeRecord(projectId, modelVersion, rows, meta = {}) {
  const key = runtimeModelKey(projectId, modelVersion)
  const current = runtimeRevitStore.get(key)
  const merged = dedupeRows([
    ...(current?.rows || []),
    ...rows,
  ])

  const sourceFiles = new Set(current?.sourceFiles || [])
  if (meta?.sourceFile) sourceFiles.add(meta.sourceFile)
  if (Array.isArray(meta?.sourceFiles)) {
    for (const fileName of meta.sourceFiles) {
      if (fileName) sourceFiles.add(fileName)
    }
  }

  const sourceModes = new Set(current?.sourceModes || [])
  if (meta?.sourceMode) sourceModes.add(meta.sourceMode)

  runtimeRevitStore.set(key, {
    key,
    projectId,
    modelVersion,
    rows: merged,
    ...buildRuntimeIndexes(merged),
    sourceFiles: Array.from(sourceFiles),
    sourceModes: Array.from(sourceModes),
    updatedAt: Date.now(),
  })

  if (runtimeRevitStore.size > RUNTIME_REVISIONS_LIMIT) {
    const entries = Array.from(runtimeRevitStore.entries())
      .sort((a, b) => (a[1].updatedAt || 0) - (b[1].updatedAt || 0))
    while (entries.length > RUNTIME_REVISIONS_LIMIT) {
      const [oldestKey] = entries.shift()
      runtimeRevitStore.delete(oldestKey)
    }
  }

  return runtimeRevitStore.get(key)
}

function pickRuntimeRevision(projectId, modelVersion) {
  if (modelVersion) {
    return runtimeRevitStore.get(runtimeModelKey(projectId, modelVersion)) || null
  }

  const candidates = Array.from(runtimeRevitStore.values())
    .filter((entry) => entry.projectId === projectId)
    .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))
  return candidates[0] || null
}

function queryRuntimeRows({ projectId, modelVersion, globalIds = [], elementIds = [], limit = 1000 }) {
  const revision = pickRuntimeRevision(projectId, modelVersion)
  const unresolved = {
    globalIds: [...globalIds],
    elementIds: [...elementIds],
  }
  if (!revision) return { rows: [], unresolved, source: 'none', revision: null }

  const collected = []
  if (globalIds.length > 0) {
    for (const gid of globalIds) {
      const rows = revision.byGlobalId.get(gid) || []
      if (rows.length > 0) unresolved.globalIds = unresolved.globalIds.filter((x) => x !== gid)
      collected.push(...rows)
    }
  }
  if (elementIds.length > 0) {
    for (const eid of elementIds) {
      const rows = revision.byElementId.get(eid) || []
      if (rows.length > 0) unresolved.elementIds = unresolved.elementIds.filter((x) => x !== eid)
      collected.push(...rows)
    }
  }
  if (globalIds.length === 0 && elementIds.length === 0) {
    collected.push(...revision.rows)
  }

  return {
    rows: dedupeRows(collected).slice(0, limit),
    unresolved,
    source: 'runtime',
    revision: {
      projectId: revision.projectId,
      modelVersion: revision.modelVersion,
      updatedAt: revision.updatedAt,
      sourceFiles: revision.sourceFiles || [],
      sourceModes: revision.sourceModes || [],
      totalRows: revision.rows.length,
    },
  }
}

async function fetchSupabaseRows({ projectId, modelVersion, globalIds = [], elementIds = [], limit = 1000 }) {
  if (!supabaseServer) {
    return {
      rows: [],
      unresolved: { globalIds: [...globalIds], elementIds: [...elementIds] },
      source: 'none',
      error: null,
    }
  }

  const unresolved = {
    globalIds: [...globalIds],
    elementIds: [...elementIds],
  }
  const rows = []
  let errorPayloadValue = null

  if (globalIds.length > 0) {
    let query = supabaseServer
      .from('ifc_element_properties')
      .select('*')
      .eq('project_id', projectId)
      .in('global_id', globalIds.slice(0, limit))
    if (modelVersion) query = query.eq('model_version', modelVersion)

    const { data, error } = await query
    if (error) {
      errorPayloadValue = error
    } else if (data?.length) {
      rows.push(...data)
      const found = new Set(data.map((row) => row.global_id))
      unresolved.globalIds = unresolved.globalIds.filter((id) => !found.has(id))
    }
  }

  if (elementIds.length > 0) {
    let query = supabaseServer
      .from('ifc_element_properties')
      .select('*')
      .eq('project_id', projectId)
      .in('revit_element_id', elementIds.slice(0, limit))
    if (modelVersion) query = query.eq('model_version', modelVersion)

    const { data, error } = await query
    if (error) {
      errorPayloadValue = errorPayloadValue || error
    } else if (data?.length) {
      rows.push(...data)
      const found = new Set(data.map((row) => row.revit_element_id))
      unresolved.elementIds = unresolved.elementIds.filter((id) => !found.has(id))
    }
  }

  if (globalIds.length === 0 && elementIds.length === 0) {
    let query = supabaseServer
      .from('ifc_element_properties')
      .select('*')
      .eq('project_id', projectId)
      .limit(limit)
    if (modelVersion) query = query.eq('model_version', modelVersion)

    const { data, error } = await query
    if (error) {
      errorPayloadValue = errorPayloadValue || error
    } else if (data?.length) {
      rows.push(...data)
    }
  }

  return {
    rows: dedupeRows(rows).slice(0, limit),
    unresolved,
    source: rows.length > 0 ? 'supabase' : 'none',
    error: errorPayloadValue,
  }
}

async function fetchMergedRevitRows({
  projectId,
  modelVersion,
  globalIds = [],
  elementIds = [],
  limit = 1000,
}) {
  const supabaseResult = await fetchSupabaseRows({
    projectId,
    modelVersion,
    globalIds,
    elementIds,
    limit,
  })

  const filteredLookup = globalIds.length > 0 || elementIds.length > 0
  const runtimeResult = queryRuntimeRows({
    projectId,
    modelVersion,
    globalIds: filteredLookup ? supabaseResult.unresolved.globalIds : [],
    elementIds: filteredLookup ? supabaseResult.unresolved.elementIds : [],
    limit,
  })

  const rows = dedupeRows([
    ...(runtimeResult.rows || []),
    ...(supabaseResult.rows || []),
  ]).slice(0, limit)

  const unresolved = filteredLookup
    ? runtimeResult.unresolved
    : { globalIds: [], elementIds: [] }

  let source = 'none'
  if (supabaseResult.rows.length > 0 && runtimeResult.rows.length > 0) source = 'hybrid'
  else if (supabaseResult.rows.length > 0) source = 'supabase'
  else if (runtimeResult.rows.length > 0) source = 'runtime'

  return {
    rows,
    unresolved,
    source,
    runtimeRevision: runtimeResult.revision || null,
    supabaseError: supabaseResult.error
      ? {
        message: supabaseResult.error.message,
      }
      : null,
  }
}

async function upsertRevitRecords(records, scope, meta = {}) {
  const runtimeRevision = touchRuntimeRecord(scope.projectId, scope.modelVersion, records, meta)

  let onConflict = 'project_id,model_version,global_id'
  const errors = []
  let insertedCount = records.length
  let dbInsertedCount = 0
  const batchSize = 500

  if (supabaseServer && meta?.allowSupabase !== false) {
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize)
      let { error } = await supabaseServer
        .from('ifc_element_properties')
        .upsert(batch, { onConflict })

      if (error && /no unique|constraint matching the on conflict specification|there is no unique/i.test(String(error.message || '')) && onConflict === 'project_id,model_version,global_id') {
        onConflict = 'project_id,global_id'
        const retry = await supabaseServer
          .from('ifc_element_properties')
          .upsert(batch, { onConflict })
        error = retry.error
      }

      if (error) {
        errors.push({
          batch: Math.floor(i / batchSize) + 1,
          reason: error.message,
        })
        continue
      }
      dbInsertedCount += batch.length
    }
  }

  const persistence = dbInsertedCount > 0 ? 'hybrid' : 'runtime'
  return {
    insertedCount,
    dbInsertedCount,
    runtimeStoredCount: runtimeRevision?.rows?.length || 0,
    errors,
    onConflict: dbInsertedCount > 0 ? onConflict : null,
    persistence,
    runtimeRevision: runtimeRevision
      ? {
        projectId: runtimeRevision.projectId,
        modelVersion: runtimeRevision.modelVersion,
        updatedAt: runtimeRevision.updatedAt,
        sourceFiles: runtimeRevision.sourceFiles || [],
        sourceModes: runtimeRevision.sourceModes || [],
      }
      : null,
  }
}

async function insertModelRun(entry) {
  if (!supabaseServer) return
  const { error } = await supabaseServer.from('model_runs').insert(entry)
  if (error && !tableMissingError(error)) {
    console.warn('[Revit] model_runs insert failed:', error.message)
  }
}

async function saveMatchReport(entry) {
  if (!supabaseServer) return
  const { error } = await supabaseServer.from('match_reports').insert(entry)
  if (error && !tableMissingError(error)) {
    console.warn('[Revit] match_reports insert failed:', error.message)
  }
}

function manualRvtFallback(projectId, modelVersion) {
  return {
    status: 'fallback',
    mode: 'manual_ifc_xlsx',
    projectId,
    modelVersion,
    instructions: [
      'Upload IFC model in Viewer',
      'Upload Revit XLSX via /api/revit/upload-xlsx with same projectId/modelVersion',
      'Request /api/revit/match-report to validate matching coverage',
    ],
  }
}

// ============================================================================
// ROUTES
// ============================================================================

// ---------------------------------------------------------------------------
// 1. POST /api/converter/convert
// ---------------------------------------------------------------------------
app.post('/api/converter/convert', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const { outputFormat } = req.body
    const inputFile = req.file.path
    const inputExt = path.extname(req.file.originalname).toLowerCase().replace('.', '')

    // Determine which converter to use
    const converterKey = inputExt // rvt, ifc, dwg, dgn
    const converter = CONVERTER_PATHS[converterKey]

    if (!converter) {
      return res.status(400).json({
        error: `No converter available for .${inputExt} files`,
        supported: Object.keys(CONVERTER_PATHS).map(k => `.${k}`),
      })
    }

    const exePath = path.join(converter.dir, converter.exe)

    if (!existsSync(exePath)) {
      // Return a meaningful response even if the converter binary is not present
      const record = {
        id: `conv-${Date.now()}`,
        inputFile: req.file.originalname,
        inputFormat: inputExt,
        outputFormat: outputFormat || 'xlsx',
        status: 'error',
        message: `Converter executable not found: ${converter.exe}. Ensure the DDC converter package is installed.`,
        startedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        duration: 0,
      }
      conversionHistory.unshift(record)
      return res.status(500).json(record)
    }

    const outputDir = path.join(UPLOADS_DIR, `output-${Date.now()}`)
    await fs.mkdir(outputDir, { recursive: true })

    const startTime = Date.now()

    // Build correct arguments depending on converter type
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname))
    let converterArgs
    let actualExePath = exePath
    let converterCwd = converter.dir

    if (converterKey === 'rvt' && outputFormat === 'ifc') {
      // RVT→IFC: use RVT2IFCconverter.exe
      const rvt2ifcConfig = CONVERTER_PATHS.rvt2ifc
      const rvt2ifcExe = path.join(rvt2ifcConfig.dir, rvt2ifcConfig.exe)
      if (!existsSync(rvt2ifcExe)) {
        const record = {
          id: `conv-${Date.now()}`,
          inputFile: req.file.originalname,
          inputFormat: inputExt,
          outputFormat: 'ifc',
          status: 'error',
          message: `RVT2IFC converter not found: ${rvt2ifcConfig.exe}. Ensure the DDC Revit2IFC converter package is installed.`,
          startedAt: new Date().toISOString(),
          completedAt: new Date().toISOString(),
          duration: 0,
        }
        conversionHistory.unshift(record)
        return res.status(500).json(record)
      }
      const outIfc = path.join(outputDir, `${baseName}.ifc`)
      converterArgs = [inputFile, outIfc]
      actualExePath = rvt2ifcExe
      converterCwd = rvt2ifcConfig.dir
    } else if (converterKey === 'rvt') {
      // RvtExporter: <input.rvt> [<output.dae>] [<output.xlsx>] [<export mode>]
      const outDae = path.join(outputDir, `${baseName}.dae`)
      const outXlsx = path.join(outputDir, `${baseName}.xlsx`)
      converterArgs = [inputFile, outDae, outXlsx, outputFormat === 'excel' ? 'complete' : 'standard']
    } else {
      converterArgs = [inputFile, outputDir]
    }
    const cmd = `"${actualExePath}" ${converterArgs.map(a => `"${a}"`).join(' ')}`

    console.log(`[Converter] Running: ${cmd}`)

    try {
      // Use spawn to handle "Press Enter to continue..." for RvtExporter / RVT2IFC
      const { stdout, stderr } = await new Promise((resolve, reject) => {
        const proc = spawn(actualExePath, converterArgs, {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 300000,
          cwd: converterCwd,
        })
        let stdoutStr = ''
        let stderrStr = ''
        proc.stdout.on('data', (chunk) => {
          stdoutStr += chunk.toString()
          if (stdoutStr.includes('Press Enter')) proc.stdin.write('\n')
        })
        proc.stderr.on('data', (chunk) => { stderrStr += chunk.toString() })
        proc.on('close', (code) => {
          if (code === 0) resolve({ stdout: stdoutStr, stderr: stderrStr })
          else reject(new Error(`Converter exit code ${code}: ${stderrStr.slice(0, 500)}`))
        })
        proc.on('error', reject)
      })

      const duration = Date.now() - startTime

      // List output files
      const outputFiles = await fs.readdir(outputDir)

      const record = {
        id: `conv-${Date.now()}`,
        inputFile: req.file.originalname,
        inputFormat: inputExt,
        outputFormat: outputFormat || 'xlsx',
        status: 'completed',
        outputFiles,
        outputDir,
        stdout: stdout?.substring(0, 2000) || '',
        stderr: stderr?.substring(0, 500) || '',
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        duration,
      }

      conversionHistory.unshift(record)

      // Persist to Supabase
      if (supabaseServer) {
        supabaseServer.from('conversion_history').insert({
          file_name: req.file.originalname,
          input_format: inputExt,
          output_format: outputFormat || 'xlsx',
          status: 'completed',
          file_size: `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
          duration: `${Math.floor(duration / 60000)}m ${Math.floor((duration % 60000) / 1000)}s`,
        }).then(() => console.log('[Supabase] Conversion record saved'))
          .catch(e => console.error('[Supabase] Conversion save error:', e.message))
      }

      res.json(record)
    } catch (execErr) {
      const duration = Date.now() - startTime
      const record = {
        id: `conv-${Date.now()}`,
        inputFile: req.file.originalname,
        inputFormat: inputExt,
        outputFormat: outputFormat || 'xlsx',
        status: 'error',
        message: execErr.message,
        stderr: execErr.stderr?.substring(0, 1000) || '',
        startedAt: new Date(startTime).toISOString(),
        completedAt: new Date().toISOString(),
        duration,
      }
      conversionHistory.unshift(record)

      // Persist failed conversion to Supabase
      if (supabaseServer) {
        supabaseServer.from('conversion_history').insert({
          file_name: req.file.originalname,
          input_format: inputExt,
          output_format: outputFormat || 'xlsx',
          status: 'failed',
          file_size: `${(req.file.size / (1024 * 1024)).toFixed(1)} MB`,
          duration: '—',
        }).catch(e => console.error('[Supabase] Conversion save error:', e.message))
      }

      res.status(500).json(record)
    }
  } catch (err) {
    console.error('[Converter] Error:', err)
    res.status(500).json({ error: 'Conversion failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 2. GET /api/converter/history
// ---------------------------------------------------------------------------
app.get('/api/converter/history', (_req, res) => {
  try {
    res.json({
      total: conversionHistory.length,
      history: conversionHistory.slice(0, 100), // Last 100 entries
    })
  } catch (err) {
    console.error('[Converter] History error:', err)
    res.status(500).json({ error: 'Failed to retrieve history', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 3. POST /api/cost/search
// ---------------------------------------------------------------------------
app.post('/api/cost/search', async (req, res) => {
  try {
    const { query, language = 'en', limit = 50 } = req.body

    if (!query || typeof query !== 'string' || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' })
    }

    const data = await loadCWICRData(language)

    if (data.length === 0) {
      return res.json({
        results: [],
        total: 0,
        language,
        message: `No CWICR data available for language: ${language}`,
      })
    }

    // Basic text matching across all columns
    const searchTerms = query.toLowerCase().split(/\s+/).filter(Boolean)

    const scored = data
      .map((row, index) => {
        const rowText = Object.values(row)
          .map(v => String(v).toLowerCase())
          .join(' ')

        let score = 0
        for (const term of searchTerms) {
          if (rowText.includes(term)) {
            score += 1
            // Bonus for exact word match
            if (rowText.split(/\s+/).some(w => w === term)) {
              score += 0.5
            }
          }
        }

        return { ...row, _score: score, _index: index }
      })
      .filter(r => r._score > 0)
      .sort((a, b) => b._score - a._score)
      .slice(0, Math.min(limit, 200))

    // Remove internal fields
    const results = scored.map(({ _score, _index, ...rest }) => rest)

    res.json({
      results,
      total: scored.length,
      language,
      city: CWICR_LANGUAGE_MAP[language]?.city || 'Unknown',
      query,
    })
  } catch (err) {
    console.error('[Cost Search] Error:', err)
    res.status(500).json({ error: 'Search failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 4. POST /api/cost/classify
// ---------------------------------------------------------------------------
app.post('/api/cost/classify', async (req, res) => {
  try {
    if (!requireGemini(res)) return

    const { elements, language = 'en' } = req.body

    if (!elements || !Array.isArray(elements) || elements.length === 0) {
      return res.status(400).json({ error: 'Elements array is required' })
    }

    const langConfig = CWICR_LANGUAGE_MAP[language]
    const cityContext = langConfig ? langConfig.city : 'Toronto'

    const prompt = `You are a construction cost classification expert using the DDC CWICR (Construction Work Items, Costs and Resources) database.

Classify the following BIM/CAD elements into standard construction work item categories suitable for cost estimation. For each element, provide:
1. A CWICR category code (e.g., "03 30 00" for concrete, "05 12 00" for structural steel)
2. A work item description
3. The unit of measurement (m2, m3, kg, each, m, etc.)
4. An estimated unit cost range for ${cityContext}

Elements to classify:
${JSON.stringify(elements, null, 2)}

Respond in JSON format as an array of objects with fields: elementName, cwicrCode, workItemDescription, unit, unitCostMin, unitCostMax, currency, confidence (0-1).`

    const result = await geminiModel.generateContent(prompt)
    const responseText = result.response.text()

    // Try to parse JSON from the response
    let classifications
    try {
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      classifications = jsonMatch ? JSON.parse(jsonMatch[0]) : []
    } catch {
      classifications = []
    }

    res.json({
      classifications,
      rawResponse: responseText,
      elementsCount: elements.length,
      language,
      city: cityContext,
    })
  } catch (err) {
    console.error('[Cost Classify] Error:', err)
    res.status(500).json({ error: 'Classification failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 4b. POST /api/cost/classify-vor  — VOR (Bill of Quantities) Excel upload
// ---------------------------------------------------------------------------
app.post('/api/cost/classify-vor', upload.single('file'), async (req, res) => {
  try {
    if (!requireGemini(res)) return

    if (!req.file) {
      return res.status(400).json({ error: 'Excel file is required' })
    }

    const language = (req.body.language || 'en').toLowerCase()
    const langConfig = CWICR_LANGUAGE_MAP[language]
    const cityContext = langConfig ? langConfig.city : 'Toronto'

    // 1. Parse uploaded Excel
    const XLSX = (await import('xlsx')).default
    const workbook = XLSX.readFile(req.file.path)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rawRows.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty or has no data rows' })
    }

    // 2. Auto-detect columns from headers
    const headers = Object.keys(rawRows[0])
    const findCol = (patterns) => headers.find(h => {
      const lower = h.toLowerCase()
      return patterns.some(p => lower.includes(p))
    })

    const nameCol = findCol(['наименование', 'name', 'описание', 'description', 'работа', 'item', 'позиция', 'material'])
    const unitCol = findCol(['ед', 'unit', 'единица', 'изм'])
    const qtyCol = findCol(['кол', 'объём', 'объем', 'qty', 'quantity', 'volume', 'amount', 'количество'])
    const codeCol = findCol(['код', 'code', 'номер', 'number', 'шифр', '#', 'п/п', 'no'])

    if (!nameCol) {
      return res.status(400).json({
        error: 'Cannot detect name column in Excel. Expected header containing: наименование, name, описание, description',
        detectedHeaders: headers,
      })
    }

    // 3. Map rows
    const vorRows = rawRows
      .map(row => ({
        originalName: String(row[nameCol] || '').trim(),
        unit: unitCol ? String(row[unitCol] || '').trim() : '',
        quantity: qtyCol ? (parseFloat(row[qtyCol]) || 0) : 0,
        code: codeCol ? String(row[codeCol] || '').trim() : '',
      }))
      .filter(r => r.originalName.length > 0)

    if (vorRows.length === 0) {
      return res.status(400).json({ error: 'No valid rows found after parsing (all name fields empty)' })
    }

    console.log(`[VOR Classify] Parsed ${vorRows.length} rows from ${req.file.originalname}, nameCol="${nameCol}", unitCol="${unitCol}", qtyCol="${qtyCol}"`)

    // 4. Send to Gemini in batches
    const BATCH_SIZE = 25
    const allClassifications = []

    for (let i = 0; i < vorRows.length; i += BATCH_SIZE) {
      const batch = vorRows.slice(i, i + BATCH_SIZE)
      const batchItems = batch.map((r, idx) => ({
        index: i + idx,
        name: r.originalName,
        unit: r.unit,
        quantity: r.quantity,
        code: r.code,
      }))

      const prompt = `You are a construction cost classification expert using the DDC CWICR (Construction Work Items, Costs and Resources) database.

Classify the following construction work items from a Bill of Quantities (ВОР / BOQ) into CWICR categories.
For each item provide a JSON object with fields:
- originalName: the original item name (as given)
- cwicrCode: the best matching CWICR code (e.g. "03 30 00", "09 29 10")
- matchedDescription: a standard CWICR work item description in the same language as the input
- unit: the unit of measurement (m2, m3, kg, m, each, etc.)
- unitCostMin: minimum estimated unit cost in local currency for ${cityContext}
- unitCostMax: maximum estimated unit cost in local currency for ${cityContext}
- confidence: your confidence in the match from 0 to 1

Items to classify:
${JSON.stringify(batchItems, null, 2)}

Respond ONLY with a JSON array of objects, no markdown formatting, no explanation.`

      try {
        const result = await geminiModel.generateContent(prompt)
        const responseText = result.response.text()
        const jsonMatch = responseText.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0])
          // Merge quantity from original rows
          const merged = parsed.map((item, idx) => ({
            ...item,
            quantity: batch[idx]?.quantity || item.quantity || 0,
          }))
          allClassifications.push(...merged)
        }
      } catch (batchErr) {
        console.error(`[VOR Classify] Batch ${i}-${i + BATCH_SIZE} failed:`, batchErr.message)
      }
    }

    // 5. Cleanup uploaded file
    try { await fs.unlink(req.file.path) } catch { /* ignore */ }

    res.json({
      rows: vorRows,
      classifications: allClassifications,
      summary: {
        totalRows: vorRows.length,
        classifiedRows: allClassifications.length,
      },
    })
  } catch (err) {
    console.error('[VOR Classify] Error:', err)
    res.status(500).json({ error: 'VOR classification failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 5. POST /api/cost/calculate
// ---------------------------------------------------------------------------
app.post('/api/cost/calculate', (req, res) => {
  try {
    const { items } = req.body

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'Items array is required' })
    }

    let totalCost = 0
    let totalLabor = 0
    let totalMaterial = 0
    let totalEquipment = 0

    const calculated = items.map((item, index) => {
      const quantity = parseFloat(item.quantity) || 0
      const unitCost = parseFloat(item.unitCost) || 0
      const laborPct = parseFloat(item.laborPercent) || 40
      const materialPct = parseFloat(item.materialPercent) || 45
      const equipmentPct = parseFloat(item.equipmentPercent) || 15

      const lineTotal = quantity * unitCost
      const labor = lineTotal * (laborPct / 100)
      const material = lineTotal * (materialPct / 100)
      const equipment = lineTotal * (equipmentPct / 100)

      totalCost += lineTotal
      totalLabor += labor
      totalMaterial += material
      totalEquipment += equipment

      return {
        lineNumber: index + 1,
        description: item.description || `Item ${index + 1}`,
        cwicrCode: item.cwicrCode || '',
        unit: item.unit || 'each',
        quantity,
        unitCost,
        lineTotal: Math.round(lineTotal * 100) / 100,
        labor: Math.round(labor * 100) / 100,
        material: Math.round(material * 100) / 100,
        equipment: Math.round(equipment * 100) / 100,
      }
    })

    // Apply markups
    const overhead = totalCost * 0.10
    const profit = totalCost * 0.08
    const contingency = totalCost * 0.05
    const grandTotal = totalCost + overhead + profit + contingency

    res.json({
      lineItems: calculated,
      summary: {
        subtotal: Math.round(totalCost * 100) / 100,
        laborTotal: Math.round(totalLabor * 100) / 100,
        materialTotal: Math.round(totalMaterial * 100) / 100,
        equipmentTotal: Math.round(totalEquipment * 100) / 100,
        overhead: Math.round(overhead * 100) / 100,
        profit: Math.round(profit * 100) / 100,
        contingency: Math.round(contingency * 100) / 100,
        grandTotal: Math.round(grandTotal * 100) / 100,
        currency: 'USD',
        markups: {
          overheadPercent: 10,
          profitPercent: 8,
          contingencyPercent: 5,
        },
      },
      itemCount: calculated.length,
      generatedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Cost Calculate] Error:', err)
    res.status(500).json({ error: 'Calculation failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 6. POST /api/validation/run
// ---------------------------------------------------------------------------
app.post('/api/validation/run', async (req, res) => {
  try {
    const { data, rules, strict = false } = req.body

    if (!data || typeof data !== 'object') {
      return res.status(400).json({ error: 'Validation data object is required' })
    }

    // Default validation rules if none provided
    const validationRules = rules || [
      { id: 'R001', name: 'Element Name Present', field: 'name', check: 'not_empty', severity: 'error' },
      { id: 'R002', name: 'Category Assigned', field: 'category', check: 'not_empty', severity: 'error' },
      { id: 'R003', name: 'Material Specified', field: 'material', check: 'not_empty', severity: 'warning' },
      { id: 'R004', name: 'Volume Greater Than Zero', field: 'volume', check: 'positive_number', severity: 'error' },
      { id: 'R005', name: 'Level Assignment', field: 'level', check: 'not_empty', severity: 'warning' },
      { id: 'R006', name: 'Classification Code', field: 'classificationCode', check: 'not_empty', severity: 'info' },
      { id: 'R007', name: 'Fire Rating Present', field: 'fireRating', check: 'not_empty', severity: 'warning' },
      { id: 'R008', name: 'Phase Defined', field: 'phase', check: 'not_empty', severity: 'info' },
    ]

    const elements = Array.isArray(data) ? data : (data.elements || [data])
    const results = []
    let passCount = 0
    let warnCount = 0
    let failCount = 0
    let infoCount = 0

    for (const element of elements) {
      const elementResults = []

      for (const rule of validationRules) {
        const value = element[rule.field]
        let passed = false

        switch (rule.check) {
          case 'not_empty':
            passed = value !== undefined && value !== null && String(value).trim() !== ''
            break
          case 'positive_number':
            passed = typeof value === 'number' && value > 0
            break
          case 'matches_pattern':
            passed = rule.pattern ? new RegExp(rule.pattern).test(String(value || '')) : true
            break
          case 'in_list':
            passed = Array.isArray(rule.allowedValues) && rule.allowedValues.includes(value)
            break
          default:
            passed = value !== undefined && value !== null
        }

        if (passed) {
          passCount++
        } else if (rule.severity === 'error') {
          failCount++
        } else if (rule.severity === 'warning') {
          warnCount++
        } else {
          infoCount++
        }

        elementResults.push({
          ruleId: rule.id,
          ruleName: rule.name,
          field: rule.field,
          severity: rule.severity,
          passed,
          value: value ?? null,
          message: passed
            ? `${rule.name}: OK`
            : `${rule.name}: ${rule.severity.toUpperCase()} - field "${rule.field}" ${rule.check === 'not_empty' ? 'is empty' : 'failed validation'}`,
        })
      }

      results.push({
        element: element.name || element.id || 'Unknown',
        checks: elementResults,
      })
    }

    const totalChecks = passCount + failCount + warnCount + infoCount
    const score = totalChecks > 0
      ? Math.round((passCount / totalChecks) * 100)
      : 0

    const overallStatus = strict
      ? (failCount === 0 && warnCount === 0 ? 'pass' : 'fail')
      : (failCount === 0 ? 'pass' : 'fail')

    const validationResponse = {
      status: overallStatus,
      score,
      summary: {
        totalElements: elements.length,
        totalChecks,
        passed: passCount,
        failed: failCount,
        warnings: warnCount,
        info: infoCount,
      },
      results,
      rulesApplied: validationRules.length,
      validatedAt: new Date().toISOString(),
    }

    // Persist to Supabase
    if (supabaseServer) {
      supabaseServer.from('validation_results').insert({
        file_name: req.body.fileName || 'uploaded_file',
        overall_score: score,
        summary: validationResponse.summary,
        rule_results: results,
        issues: results.flatMap(r => r.checks.filter(c => !c.passed)),
      }).then(() => console.log('[Supabase] Validation result saved'))
        .catch(e => console.error('[Supabase] Validation save error:', e.message))
    }

    res.json(validationResponse)
  } catch (err) {
    console.error('[Validation] Error:', err)
    res.status(500).json({ error: 'Validation failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 7. POST /api/ai/analyze
// ---------------------------------------------------------------------------

// -- Helpers: parse and validate structured Gemini response --

function parseStructuredResponse(text, fileName) {
  // Level 1: direct JSON parse
  try {
    const parsed = JSON.parse(text)
    if (parsed && typeof parsed === 'object') return validateAnalysisResponse(parsed, fileName)
  } catch { /* not raw JSON */ }

  // Level 2: extract JSON from ```json ... ``` code block
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)```/)
  if (jsonBlockMatch) {
    try {
      const parsed = JSON.parse(jsonBlockMatch[1].trim())
      if (parsed && typeof parsed === 'object') return validateAnalysisResponse(parsed, fileName)
    } catch { /* malformed JSON in block */ }
  }

  // Level 3: fallback — build structured response from plain text
  return buildFallbackResponse(text, fileName)
}

function validateAnalysisResponse(parsed, fileName) {
  const explanation = parsed.explanation || parsed.analysis || parsed.summary || 'Анализ завершён.'
  const code = parsed.code || null

  let results = null
  if (parsed.results && typeof parsed.results === 'object') {
    results = {
      type: parsed.results.type || 'mixed',
      tableData: parsed.results.tableData || null,
      stats: Array.isArray(parsed.results.stats) ? parsed.results.stats : null,
      chartBars: Array.isArray(parsed.results.chartBars) ? parsed.results.chartBars : null,
      summary: parsed.results.summary || null,
    }
    // Ensure tableData has proper structure
    if (results.tableData) {
      if (!Array.isArray(results.tableData.headers)) results.tableData = null
      else if (!Array.isArray(results.tableData.rows)) results.tableData.rows = []
    }
    // Ensure chartBars have color
    if (results.chartBars) {
      const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#ef4444', '#06b6d4']
      results.chartBars = results.chartBars.map((bar, i) => ({
        label: String(bar.label || `Item ${i + 1}`),
        value: Number(bar.value) || 0,
        color: bar.color || colors[i % colors.length],
      }))
    }
    // Ensure stats have label/value strings
    if (results.stats) {
      results.stats = results.stats.map(s => ({
        label: String(s.label || ''),
        value: String(s.value || ''),
        ...(s.change !== undefined ? { change: Number(s.change) } : {}),
      }))
    }
  }

  return { explanation, code, results }
}

function buildFallbackResponse(text, fileName) {
  // Extract code block from plain text
  let code = null
  const codeMatch = text.match(/```(?:python|javascript|js|py)?\s*\n?([\s\S]*?)```/)
  if (codeMatch) {
    code = codeMatch[1].trim()
  }

  // Remove code blocks from explanation
  let explanation = text.replace(/```[\s\S]*?```/g, '').trim()
  if (!explanation) explanation = 'Анализ завершён.'

  return { explanation, code, results: null }
}

app.post('/api/ai/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!requireGemini(res)) return

    const { prompt } = req.body

    if (!prompt) {
      return res.status(400).json({ error: 'Analysis prompt is required' })
    }

    // Parse conversation history from formData
    let chatHistory = []
    if (req.body.history) {
      try {
        const parsed = JSON.parse(req.body.history)
        if (Array.isArray(parsed)) {
          chatHistory = parsed.map(msg => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content }],
          }))
        }
      } catch { /* ignore invalid history */ }
    }

    let dataContext = ''
    const fileName = req.file?.originalname || 'data'

    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase()

      if (['.xlsx', '.xls'].includes(ext)) {
        try {
          const XLSX = (await import('xlsx')).default
          const workbook = XLSX.readFile(req.file.path)
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

          const sampleRows = rows.slice(0, 100)
          dataContext = `\n\nExcel Data from "${fileName}" (${rows.length} total rows, showing first ${sampleRows.length}):\nColumns: ${Object.keys(sampleRows[0] || {}).join(', ')}\n\nData:\n${JSON.stringify(sampleRows, null, 2)}`
        } catch (xlsErr) {
          dataContext = `\n\n[Failed to parse Excel file: ${xlsErr.message}]`
        }
      } else if (['.csv', '.txt', '.json', '.xml'].includes(ext)) {
        const content = await fs.readFile(req.file.path, 'utf-8')
        dataContext = `\n\nFile Content (${ext}):\n${content.substring(0, 50000)}`
      }
    }

    const systemPrompt = `You are Jens AI, an expert construction data analyst. You help construction professionals analyze BIM data, cost estimates, schedules, and project information.

IMPORTANT: You MUST respond with valid JSON only. No text before or after the JSON. Use this exact structure:
{
  "explanation": "Your analysis explanation in Russian (2-4 sentences)",
  "code": "Python code that performs the analysis (as a string, use \\n for newlines)",
  "results": {
    "type": "mixed",
    "tableData": { "headers": ["Col1", "Col2"], "rows": [["val1", "val2"]] },
    "stats": [{ "label": "Metric name", "value": "Metric value" }],
    "chartBars": [{ "label": "Category", "value": 123, "color": "#3b82f6" }],
    "summary": "Brief summary of findings in Russian"
  }
}

Rules:
- "explanation" is required, in Russian
- "code" should be Python (pandas) that analyzes the data
- "results.tableData" — include if the analysis produces tabular output
- "results.stats" — include 3-6 key metrics
- "results.chartBars" — include if data can be visualized as bars (max 8 bars)
- "results.summary" — 1-2 sentence summary in Russian
- All text output should be in Russian`

    const chat = geminiModel.startChat({
      history: [
        { role: 'user', parts: [{ text: systemPrompt }] },
        { role: 'model', parts: [{ text: '{"explanation":"Понял. Я Jens AI, готов анализировать данные и возвращать структурированные результаты в формате JSON.","code":null,"results":null}' }] },
        ...chatHistory,
      ],
    })

    const userMessage = `${prompt}${dataContext}`
    const result = await chat.sendMessage(userMessage)
    const responseText = result.response.text()

    const structured = parseStructuredResponse(responseText, fileName)

    res.json({
      explanation: structured.explanation,
      code: structured.code,
      results: structured.results,
      hasFileContext: !!req.file,
      fileName: req.file?.originalname || null,
      analyzedAt: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[AI Analysis] Error:', err)
    res.status(500).json({ error: 'Analysis failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 8. GET /api/tasks
// ---------------------------------------------------------------------------
app.get('/api/tasks', (req, res) => {
  try {
    const { status, priority, module } = req.query
    let filtered = [...tasks]

    if (status) filtered = filtered.filter(t => t.status === status)
    if (priority) filtered = filtered.filter(t => t.priority === priority)
    if (module) filtered = filtered.filter(t => t.module === module)

    res.json({
      tasks: filtered,
      total: filtered.length,
    })
  } catch (err) {
    console.error('[Tasks] Error:', err)
    res.status(500).json({ error: 'Failed to retrieve tasks', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 9. POST /api/tasks
// ---------------------------------------------------------------------------
app.post('/api/tasks', (req, res) => {
  try {
    const { title, description, status, priority, assignee, dueDate, module } = req.body

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({ error: 'Task title is required' })
    }

    const now = new Date().toISOString()
    const newTask = {
      id: String(++taskIdCounter),
      title: title.trim(),
      description: description || '',
      status: status || 'todo',
      priority: priority || 'medium',
      assignee: assignee || 'Unassigned',
      dueDate: dueDate || null,
      module: module || 'general',
      createdAt: now,
      updatedAt: now,
    }

    tasks.push(newTask)
    res.status(201).json(newTask)
  } catch (err) {
    console.error('[Tasks] Create error:', err)
    res.status(500).json({ error: 'Failed to create task', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 10. PUT /api/tasks/:id
// ---------------------------------------------------------------------------
app.put('/api/tasks/:id', (req, res) => {
  try {
    const { id } = req.params
    const taskIndex = tasks.findIndex(t => t.id === id)

    if (taskIndex === -1) {
      return res.status(404).json({ error: `Task with id "${id}" not found` })
    }

    const allowedFields = ['title', 'description', 'status', 'priority', 'assignee', 'dueDate', 'module']
    const updates = {}

    for (const field of allowedFields) {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field]
      }
    }

    tasks[taskIndex] = {
      ...tasks[taskIndex],
      ...updates,
      updatedAt: new Date().toISOString(),
    }

    res.json(tasks[taskIndex])
  } catch (err) {
    console.error('[Tasks] Update error:', err)
    res.status(500).json({ error: 'Failed to update task', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 11. GET /api/documents
// ---------------------------------------------------------------------------
app.get('/api/documents', (req, res) => {
  try {
    const { type, category } = req.query
    let filtered = [...documents]

    if (type) filtered = filtered.filter(d => d.type === type)
    if (category) filtered = filtered.filter(d => d.category === category)

    res.json({
      documents: filtered,
      total: filtered.length,
    })
  } catch (err) {
    console.error('[Documents] Error:', err)
    res.status(500).json({ error: 'Failed to retrieve documents', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 12. GET /api/rfis
// ---------------------------------------------------------------------------
app.get('/api/rfis', (req, res) => {
  try {
    const { status } = req.query
    let filtered = [...rfis]

    if (status) filtered = filtered.filter(r => r.status === status)

    res.json({
      rfis: filtered,
      total: filtered.length,
    })
  } catch (err) {
    console.error('[RFIs] Error:', err)
    res.status(500).json({ error: 'Failed to retrieve RFIs', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 13. GET /api/submittals
// ---------------------------------------------------------------------------
app.get('/api/submittals', (req, res) => {
  try {
    const { status, category } = req.query
    let filtered = [...submittals]

    if (status) filtered = filtered.filter(s => s.status === status)
    if (category) filtered = filtered.filter(s => s.category === category)

    res.json({
      submittals: filtered,
      total: filtered.length,
    })
  } catch (err) {
    console.error('[Submittals] Error:', err)
    res.status(500).json({ error: 'Failed to retrieve submittals', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 14. POST /api/documents/meeting-minutes
// ---------------------------------------------------------------------------
app.post('/api/documents/meeting-minutes', async (req, res) => {
  try {
    if (!requireGemini(res)) return

    const { attendees, agenda, notes, projectName, date } = req.body

    if (!notes || typeof notes !== 'string' || notes.trim().length === 0) {
      return res.status(400).json({ error: 'Meeting notes are required' })
    }

    const meetingDate = date || new Date().toISOString().split('T')[0]

    const prompt = `You are Jens AI, a professional construction project assistant. Generate formal meeting minutes from the following information.

Project: ${projectName || 'Jens Construction Project'}
Date: ${meetingDate}
Attendees: ${attendees ? (Array.isArray(attendees) ? attendees.join(', ') : attendees) : 'Not specified'}
Agenda: ${agenda || 'General project coordination'}

Raw Notes:
${notes}

Generate professional meeting minutes with these sections:
1. Meeting Information (project, date, attendees, location)
2. Agenda Items Discussed
3. Key Decisions Made
4. Action Items (with assignee, deadline, priority)
5. Open Issues / Items for Follow-up
6. Next Meeting Date/Time

Format the output as clean, professional text. Use clear headers and bullet points.`

    const result = await geminiModel.generateContent(prompt)
    const minutesText = result.response.text()

    res.json({
      meetingMinutes: minutesText,
      metadata: {
        projectName: projectName || 'Jens Construction Project',
        date: meetingDate,
        attendees: attendees || [],
        generatedAt: new Date().toISOString(),
        generatedBy: 'Jens AI',
      },
    })
  } catch (err) {
    console.error('[Meeting Minutes] Error:', err)
    res.status(500).json({ error: 'Failed to generate meeting minutes', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 15. POST /api/qto/generate
// ---------------------------------------------------------------------------
app.post('/api/qto/generate', upload.single('file'), async (req, res) => {
  try {
    const { format = 'json', groupBy = 'category' } = req.body

    if (!req.file) {
      return res.status(400).json({ error: 'File upload is required for QTO generation' })
    }

    const ext = path.extname(req.file.originalname).toLowerCase()
    let elements = []

    // Parse input file
    if (['.xlsx', '.xls'].includes(ext)) {
      try {
        const XLSX = (await import('xlsx')).default
        const workbook = XLSX.readFile(req.file.path)
        const sheetName = workbook.SheetNames[0]
        const sheet = workbook.Sheets[sheetName]
        elements = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      } catch (xlsErr) {
        return res.status(400).json({ error: 'Failed to parse Excel file', message: xlsErr.message })
      }
    } else if (ext === '.json') {
      try {
        const content = await fs.readFile(req.file.path, 'utf-8')
        const parsed = JSON.parse(content)
        elements = Array.isArray(parsed) ? parsed : (parsed.elements || parsed.data || [parsed])
      } catch (jsonErr) {
        return res.status(400).json({ error: 'Failed to parse JSON file', message: jsonErr.message })
      }
    } else if (ext === '.csv') {
      try {
        const XLSX = (await import('xlsx')).default
        const workbook = XLSX.readFile(req.file.path)
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        elements = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      } catch (csvErr) {
        return res.status(400).json({ error: 'Failed to parse CSV file', message: csvErr.message })
      }
    } else {
      return res.status(400).json({
        error: `QTO generation does not support .${ext.replace('.', '')} files directly. Upload an Excel, CSV, or JSON export.`,
      })
    }

    if (elements.length === 0) {
      return res.status(400).json({ error: 'No elements found in the uploaded file' })
    }

    // Generate QTO summary grouped by the specified field
    const groups = {}
    for (const el of elements) {
      const key = el[groupBy] || el.Category || el.category || el.Type || el.type || 'Uncategorized'
      if (!groups[key]) {
        groups[key] = {
          category: key,
          count: 0,
          elements: [],
          totalVolume: 0,
          totalArea: 0,
          totalLength: 0,
          totalWeight: 0,
        }
      }
      groups[key].count++
      groups[key].elements.push(el)

      // Accumulate quantities from common field names
      const vol = parseFloat(el.Volume || el.volume || el.vol || 0)
      const area = parseFloat(el.Area || el.area || 0)
      const len = parseFloat(el.Length || el.length || el.len || 0)
      const weight = parseFloat(el.Weight || el.weight || el.mass || el.Mass || 0)

      if (!isNaN(vol)) groups[key].totalVolume += vol
      if (!isNaN(area)) groups[key].totalArea += area
      if (!isNaN(len)) groups[key].totalLength += len
      if (!isNaN(weight)) groups[key].totalWeight += weight
    }

    // Build summary without embedding all element details
    const summary = Object.values(groups).map(g => ({
      category: g.category,
      elementCount: g.count,
      totalVolume: Math.round(g.totalVolume * 1000) / 1000,
      totalArea: Math.round(g.totalArea * 1000) / 1000,
      totalLength: Math.round(g.totalLength * 1000) / 1000,
      totalWeight: Math.round(g.totalWeight * 1000) / 1000,
    }))

    // If AI is available, generate an HTML report
    let htmlReport = null
    if (geminiModel && format === 'html') {
      try {
        const aiPrompt = `Generate a clean, professional HTML Quantity Take-Off report for the following construction data.
Use a modern design with a summary table and category breakdown. Brand it as "Jens QTO Report".

Data Summary:
${JSON.stringify(summary, null, 2)}

Total Elements: ${elements.length}
Source File: ${req.file.originalname}
Generated: ${new Date().toISOString()}

Create a complete, self-contained HTML page with inline CSS styling. Include a header, summary section, detailed table, and footer.`

        const aiResult = await geminiModel.generateContent(aiPrompt)
        htmlReport = aiResult.response.text()

        // Extract HTML from markdown code block if present
        const htmlMatch = htmlReport.match(/```html\s*([\s\S]*?)```/)
        if (htmlMatch) htmlReport = htmlMatch[1].trim()
      } catch {
        // HTML report generation is optional
        htmlReport = null
      }
    }

    const qtoResponse = {
      report: {
        title: `QTO Report - ${req.file.originalname}`,
        generatedAt: new Date().toISOString(),
        sourceFile: req.file.originalname,
        totalElements: elements.length,
        totalCategories: summary.length,
        groupedBy: groupBy,
      },
      summary,
      htmlReport,
    }

    // Persist to Supabase
    if (supabaseServer) {
      supabaseServer.from('qto_reports').insert({
        file_name: req.file.originalname,
        group_by: groupBy,
        categories: summary,
        summary: {
          totalElements: elements.length,
          totalCategories: summary.length,
          estimatedCost: 0,
          currency: 'USD',
        },
        total_elements: elements.length,
      }).then(() => console.log('[Supabase] QTO report saved'))
        .catch(e => console.error('[Supabase] QTO save error:', e.message))
    }

    res.json(qtoResponse)
  } catch (err) {
    console.error('[QTO] Error:', err)
    res.status(500).json({ error: 'QTO generation failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 16. POST /api/ai/chat
// ---------------------------------------------------------------------------
app.post('/api/ai/chat', async (req, res) => {
  try {
    if (!requireGemini(res)) return

    const { message, context, history = [] } = req.body

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message is required' })
    }

    const systemContext = `You are Jens AI, an intelligent assistant for the Jens Construction Platform. You specialize in:

- CAD/BIM file conversion (Revit, IFC, DWG, DGN)
- Construction cost estimation using CWICR databases
- BIM data validation and quality checks
- Quantity Take-Off (QTO) analysis
- Construction project management
- Document management (RFIs, submittals, meeting minutes)

Be professional, concise, and technical when appropriate. Always provide actionable advice.
${context ? `\nAdditional context: ${context}` : ''}`

    // Build conversation history
    const chatHistory = history.map(msg => ({
      role: msg.role === 'user' ? 'user' : 'model',
      parts: [{ text: msg.content }],
    }))

    const chat = geminiModel.startChat({
      history: [
        { role: 'user', parts: [{ text: systemContext }] },
        { role: 'model', parts: [{ text: 'Understood. I am Jens AI, ready to assist with your construction project needs. How can I help you?' }] },
        ...chatHistory,
      ],
    })

    const result = await chat.sendMessage(message)
    const responseText = result.response.text()

    res.json({
      reply: responseText,
      model: 'gemini-2.0-flash',
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[AI Chat] Error:', err)
    res.status(500).json({ error: 'Chat failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 17. GET /api/health
// ---------------------------------------------------------------------------
app.get('/api/health', async (_req, res) => {
  const converterStatus = converterAvailability()
  const dbStatus = await dbPreflight()

  const cwicrStatus = {}
  for (const [lang, config] of Object.entries(CWICR_LANGUAGE_MAP)) {
    const dirExists = existsSync(path.join(CWICR_ROOT, config.dir))
    cwicrStatus[lang] = {
      city: config.city,
      available: dirExists,
      cached: !!cwicrCache[lang],
      cachedRows: cwicrCache[lang]?.length || 0,
    }
  }

  const rvtConverter = converterStatus.rvt
  const status = (dbStatus.available || !supabaseServer) ? 'ok' : 'degraded'

  res.json({
    status,
    platform: 'Jens Construction Platform',
    version: '1.1.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      nodeVersion: process.version,
      port: PORT,
      geminiAvailable: !!geminiModel,
      rvtConverterFeatureFlag: ENABLE_RVT_CONVERTER,
    },
    converters: converterStatus,
    preflight: {
      database: dbStatus,
      runtimeRevitStore: {
        enabled: true,
        revisions: runtimeRevitStore.size,
      },
      rvtConverter: {
        enabled: rvtConverter?.enabled,
        available: rvtConverter?.available,
        executable: path.join(CONVERTER_PATHS.rvt.dir, CONVERTER_PATHS.rvt.exe),
      },
    },
    cwicr: cwicrStatus,
    stores: {
      conversionHistory: conversionHistory.length,
      tasks: tasks.length,
      documents: documents.length,
      rfis: rfis.length,
      submittals: submittals.length,
    },
  })
})

// ---------------------------------------------------------------------------
// 18. POST /api/revit/upload-xlsx — Parse Revit XLSX and upsert to Supabase
// ---------------------------------------------------------------------------
app.post('/api/revit/upload-xlsx', upload.single('file'), async (req, res) => {
  const cleanupPath = req.file?.path
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' })
    }

    const ext = path.extname(req.file.originalname).toLowerCase()
    if (!['.xlsx', '.xls'].includes(ext)) {
      return res.status(400).json({ error: 'Only .xlsx/.xls files are accepted' })
    }
    const preflight = supabaseServer ? await dbPreflight() : null
    const allowSupabase = !!supabaseServer && !!preflight?.available

    const XLSX = (await import('xlsx')).default
    const workbook = XLSX.readFile(req.file.path)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rows.length === 0) {
      return res.status(422).json({
        status: 'empty_payload',
        insertedCount: 0,
        parsedRows: 0,
        validRows: 0,
        errorCount: 1,
        coverage: {
          parsedRows: 0,
          validRows: 0,
          validRatio: 0,
          withGlobalId: 0,
          withElementId: 0,
          withTypeIfcGuid: 0,
        },
        mappedColumns: [],
        unmappedColumns: [],
        errors: [{ row: 1, reason: 'No data rows found in the spreadsheet' }],
      })
    }

    const availableColumns = Object.keys(rows[0] || {})
    const { resolvedMap, mappedColumns } = resolveRevitColumns(availableColumns)

    if (!resolvedMap.globalId && !resolvedMap.revitElementId) {
      return res.status(422).json({
        status: 'unmapped_identity_columns',
        insertedCount: 0,
        parsedRows: rows.length,
        validRows: 0,
        errorCount: 1,
        coverage: {
          parsedRows: rows.length,
          validRows: 0,
          validRatio: 0,
          withGlobalId: 0,
          withElementId: 0,
          withTypeIfcGuid: 0,
        },
        mappedColumns: summarizeMappedColumns(resolvedMap),
        unmappedColumns: getUnmappedColumns(availableColumns, mappedColumns),
        errors: [{
          row: 1,
          reason: 'No GlobalId (IfcGUID) or ElementId (ID) column found',
          availableColumns,
        }],
      })
    }

    const modelScope = normalizeModelScope(req.body, req.file)
    const { records, errors: rowErrors } = mapRevitRowsToRecords(
      rows,
      availableColumns,
      resolvedMap,
      mappedColumns,
      modelScope,
    )

    if (records.length === 0) {
      return res.status(422).json({
        status: 'no_valid_rows',
        insertedCount: 0,
        parsedRows: rows.length,
        validRows: 0,
        errorCount: rowErrors.length,
        coverage: buildUploadCoverage(records, rows.length),
        mappedColumns: summarizeMappedColumns(resolvedMap),
        unmappedColumns: getUnmappedColumns(availableColumns, mappedColumns),
        errors: rowErrors,
        projectId: modelScope.projectId,
        modelVersion: modelScope.modelVersion,
      })
    }

    const upsertResult = await upsertRevitRecords(records, modelScope, {
      sourceFile: modelScope.sourceFile,
      sourceMode: 'manual_ifc_xlsx',
      allowSupabase,
    })
    const dbErrors = upsertResult.errors || []
    const allErrors = [...rowErrors, ...dbErrors]

    await insertModelRun({
      project_id: modelScope.projectId,
      model_version: modelScope.modelVersion,
      source_mode: 'manual_ifc_xlsx',
      source_files: {
        xlsx: modelScope.sourceFile,
      },
    })

    // Optionally forward to n8n for extra processing
    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL
    if (n8nWebhookUrl) {
      try {
        const response = await fetch(n8nWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: modelScope.projectId,
            modelVersion: modelScope.modelVersion,
            recordCount: upsertResult.insertedCount,
            fileName: req.file.originalname,
          }),
        })
        console.log(`[Revit XLSX] n8n webhook responded: ${response.status}`)
      } catch (n8nErr) {
        console.warn('[Revit XLSX] n8n webhook failed (non-blocking):', n8nErr.message)
      }
    }

    const statusCode = allErrors.length > 0 ? 207 : 200
    const status = allErrors.length > 0 ? 'partial_success' : 'success'

    console.log(`[Revit XLSX] ${status.toUpperCase()} ${upsertResult.insertedCount}/${rows.length} rows from ${req.file.originalname}`)

    return res.status(statusCode).json({
      status,
      insertedCount: upsertResult.insertedCount,
      parsedRows: rows.length,
      validRows: records.length,
      errorCount: allErrors.length,
      coverage: buildUploadCoverage(records, rows.length),
      mappedColumns: summarizeMappedColumns(resolvedMap),
      unmappedColumns: getUnmappedColumns(availableColumns, mappedColumns),
      errors: allErrors,
      projectId: modelScope.projectId,
      modelVersion: modelScope.modelVersion,
      onConflict: upsertResult.onConflict,
      persistence: upsertResult.persistence,
      dbInsertedCount: upsertResult.dbInsertedCount,
      runtimeStoredCount: upsertResult.runtimeStoredCount,
      runtimeRevision: upsertResult.runtimeRevision,
      supabaseEnabled: !!supabaseServer,
      supabaseHealthy: !!allowSupabase,
      preflight: preflight || undefined,
    })
  } catch (err) {
    console.error('[Revit XLSX] Error:', err)
    return res.status(500).json(errorPayload(
      'UPLOAD_XLSX_FAILED',
      'Failed to process Revit XLSX',
      { message: err.message },
    ))
  } finally {
    await safeUnlink(cleanupPath)
  }
})

// ---------------------------------------------------------------------------
// 19. GET /api/revit/properties/:globalId — Fetch single element properties
// ---------------------------------------------------------------------------
app.get('/api/revit/properties/:globalId', async (req, res) => {
  try {
    const { globalId } = req.params
    const { projectId, modelVersion } = resolveScope(req.query, { projectId: 'default' })

    const merged = await fetchMergedRevitRows({
      projectId,
      modelVersion,
      globalIds: [globalId],
      limit: 25,
    })

    const hit = merged.rows.find((row) => row.global_id === globalId) || merged.rows[0]

    if (!hit) {
      return res.status(404).json({ error: 'Element not found', globalId })
    }

    res.json({
      ...hit,
      source: merged.source,
      runtimeRevision: merged.runtimeRevision,
    })
  } catch (err) {
    console.error('[Revit Props] Error:', err)
    res.status(500).json({ error: 'Failed to fetch properties', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 20. POST /api/revit/properties/bulk — Batch fetch element properties
// ---------------------------------------------------------------------------
app.post('/api/revit/properties/bulk', async (req, res) => {
  try {
    const { projectId, modelVersion } = resolveScope(req.body, { projectId: 'default' })
    const requestedLimit = Number.parseInt(String(req.body?.limit || 1000), 10)
    const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 5000) : 1000
    const globalIds = normalizeStringArray(req.body?.globalIds, limit)
    const elementIds = normalizeNumberArray(req.body?.elementIds, limit)

    if (globalIds.length === 0 && elementIds.length === 0) {
      return res.status(400).json({ error: 'globalIds or elementIds array is required' })
    }

    const merged = await fetchMergedRevitRows({
      projectId,
      modelVersion,
      globalIds,
      elementIds,
      limit,
    })

    res.json({
      results: merged.rows,
      count: merged.rows.length,
      requested: {
        globalIds: globalIds.length,
        elementIds: elementIds.length,
      },
      unresolved: merged.unresolved,
      projectId,
      modelVersion,
      limit,
      source: merged.source,
      runtimeRevision: merged.runtimeRevision,
      warnings: merged.supabaseError ? [merged.supabaseError.message] : [],
    })
  } catch (err) {
    console.error('[Revit Props Bulk] Error:', err)
    res.status(500).json({ error: 'Failed to fetch properties', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 21. POST /api/revit/match-report — Multi-key match report (IFC + Revit rows)
// ---------------------------------------------------------------------------
app.post('/api/revit/match-report', async (req, res) => {
  try {
    const ifcElements = Array.isArray(req.body?.ifcElements) ? req.body.ifcElements : []
    if (ifcElements.length === 0) {
      return res.status(400).json(errorPayload(
        'INVALID_PAYLOAD',
        'ifcElements[] is required and must be non-empty',
      ))
    }

    const { projectId, modelVersion } = resolveScope(req.body, { projectId: 'default' })
    const merged = await fetchMergedRevitRows({
      projectId,
      modelVersion,
      limit: 100000,
    })

    const report = buildMatchReport({
      ifcElements,
      revitRows: merged.rows,
      matchThreshold: 0.85,
      ambiguousThreshold: 0.65,
    })

    await saveMatchReport({
      project_id: projectId,
      model_version: modelVersion,
      summary_json: {
        totalIfcElements: report.totalIfcElements,
        totalRevitRows: report.totalRevitRows,
        totalMatched: report.totalMatched,
        matchRate: report.matchRate,
        matchedByKey: report.matchedByKey,
        ambiguous: report.ambiguous.length,
        missingInIfc: report.missingInIfc.length,
        missingInRevit: report.missingInRevit.length,
      },
    })

    return res.json({
      projectId,
      modelVersion,
      source: merged.source,
      matchRate: report.matchRate,
      matchedByKey: report.matchedByKey,
      ambiguous: report.ambiguous,
      missingInIfc: report.missingInIfc,
      missingInRevit: report.missingInRevit,
      byCategory: report.byCategory,
      diagnostics: report.diagnostics,
      runtimeRevision: merged.runtimeRevision,
      warnings: merged.supabaseError ? [merged.supabaseError.message] : [],
      totals: {
        totalIfcElements: report.totalIfcElements,
        totalRevitRows: report.totalRevitRows,
        totalMatched: report.totalMatched,
      },
    })
  } catch (err) {
    console.error('[Revit Match Report] Error:', err)
    return res.status(500).json(errorPayload(
      'MATCH_REPORT_FAILED',
      'Failed to generate match report',
      { message: err.message },
    ))
  }
})

// ---------------------------------------------------------------------------
// 22. POST /api/revit/process-model — Unified .rvt upload (auto-convert + import)
// ---------------------------------------------------------------------------
app.post('/api/revit/process-model', upload.single('file'), async (req, res) => {
  const cleanupPath = req.file?.path
  let outputDir = null

  try {
    if (!req.file) {
      return res.status(400).json(errorPayload('NO_FILE', 'No file uploaded'))
    }

    const ext = path.extname(req.file.originalname).toLowerCase()
    if (ext !== '.rvt') {
      return res.status(400).json(errorPayload('INVALID_FILE_TYPE', 'Only .rvt files are accepted'))
    }

    const modelScope = normalizeModelScope(req.body, req.file)
    const converter = CONVERTER_PATHS.rvt
    const converterExe = path.join(converter.dir, converter.exe)
    const converterAvailable = ENABLE_RVT_CONVERTER && existsSync(converterExe)
    const requestedExportMode = String(req.body.exportMode || process.env.RVT_EXPORT_MODE || 'complete').trim().toLowerCase()

    if (!converterAvailable) {
      return res.status(503).json({
        ...manualRvtFallback(modelScope.projectId, modelScope.modelVersion),
        reason: !ENABLE_RVT_CONVERTER ? 'feature_flag_disabled' : 'converter_not_found',
        converterPath: converterExe,
      })
    }

    outputDir = path.join(UPLOADS_DIR, `rvt-${Date.now()}`)
    await fs.mkdir(outputDir, { recursive: true })

    // RvtExporter expects: <input.rvt> [<output.dae>] [<output.xlsx>] [<export mode>] [bbox] [room] [schedule]
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname))
    const outDae = path.join(outputDir, `${baseName}.dae`)
    const outXlsx = path.join(outputDir, `${baseName}.xlsx`)
    const cmd = `"${converterExe}" "${req.file.path}" "${outDae}" "${outXlsx}" ${requestedExportMode} bbox room`

    console.log(`[Revit Process] Running: ${cmd}`)

    try {
      // Use spawn instead of execSync to handle "Press Enter to continue..." prompt
      await new Promise((resolve, reject) => {
        const proc = spawn(converterExe, [req.file.path, outDae, outXlsx, requestedExportMode, 'bbox', 'room'], {
          stdio: ['pipe', 'pipe', 'pipe'],
          timeout: 300000,
          cwd: converter.dir,
        })
        let stdout = ''
        let stderr = ''
        proc.stdout.on('data', (chunk) => {
          stdout += chunk.toString()
          // Send Enter when process asks for it ("Press Enter to continue...")
          if (stdout.includes('Press Enter')) {
            proc.stdin.write('\n')
          }
        })
        proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })
        proc.on('close', (code) => {
          console.log(`[Revit Process] Exit code: ${code}`)
          if (stdout) console.log(`[Revit Process] stdout: ${stdout.slice(0, 1000)}`)
          if (stderr) console.warn(`[Revit Process] stderr: ${stderr.slice(0, 500)}`)
          if (code === 0) resolve(undefined)
          else reject(new Error(`RvtExporter exit code ${code}: ${stderr.slice(0, 500)}`))
        })
        proc.on('error', reject)
      })
    } catch (execErr) {
      throw execErr
    }

    const outputFiles = await fs.readdir(outputDir)
    const xlsxFile = outputFiles.find((f) => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'))
    const daeFile = outputFiles.find((f) => f.toLowerCase().endsWith('.dae'))

    const response = {
      status: 'success',
      projectId: modelScope.projectId,
      modelVersion: modelScope.modelVersion,
      mode: 'auto_rvt_converter',
      outputs: {
        daePath: daeFile ? `/uploads/${path.basename(outputDir)}/${daeFile}` : null,
        xlsxPath: xlsxFile ? `/uploads/${path.basename(outputDir)}/${xlsxFile}` : null,
        files: outputFiles,
      },
      xlsxImport: null,
      matchSummary: null,
      converter: {
        exportMode: requestedExportMode,
      },
    }

    const preflight = supabaseServer ? await dbPreflight() : null
    const allowSupabase = !!supabaseServer && !!preflight?.available

    if (xlsxFile) {
      const xlsxPath = path.join(outputDir, xlsxFile)
      const XLSX = (await import('xlsx')).default
      const workbook = XLSX.readFile(xlsxPath)
      const sheetName = workbook.SheetNames[0]
      const sheet = workbook.Sheets[sheetName]
      const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      const availableColumns = Object.keys(rows[0] || {})
      const { resolvedMap, mappedColumns } = resolveRevitColumns(availableColumns)

      const { records, errors: rowErrors } = mapRevitRowsToRecords(
        rows,
        availableColumns,
        resolvedMap,
        mappedColumns,
        {
          projectId: modelScope.projectId,
          modelVersion: modelScope.modelVersion,
          sourceFile: xlsxFile,
        },
      )

      const upsertResult = records.length > 0 ? await upsertRevitRecords(records, {
        projectId: modelScope.projectId,
        modelVersion: modelScope.modelVersion,
        sourceFile: xlsxFile,
      }, {
        sourceFile: xlsxFile,
        sourceMode: 'auto_rvt',
        allowSupabase,
      }) : {
        insertedCount: 0,
        errors: [{ reason: 'No valid rows in generated XLSX' }],
        onConflict: null,
        persistence: 'runtime',
        dbInsertedCount: 0,
        runtimeStoredCount: 0,
        runtimeRevision: null,
      }

      const allErrors = [...rowErrors, ...(upsertResult.errors || [])]
      response.xlsxImport = {
        insertedCount: upsertResult.insertedCount,
        parsedRows: rows.length,
        validRows: records.length,
        errorCount: allErrors.length,
        coverage: buildUploadCoverage(records, rows.length),
        mappedColumns: summarizeMappedColumns(resolvedMap),
        unmappedColumns: getUnmappedColumns(availableColumns, mappedColumns),
        errors: allErrors,
        persistence: upsertResult.persistence,
        dbInsertedCount: upsertResult.dbInsertedCount,
        runtimeStoredCount: upsertResult.runtimeStoredCount,
        runtimeRevision: upsertResult.runtimeRevision,
        supabaseEnabled: !!supabaseServer,
        supabaseHealthy: !!allowSupabase,
        preflight: preflight || undefined,
      }

      await insertModelRun({
        project_id: modelScope.projectId,
        model_version: modelScope.modelVersion,
        source_mode: 'auto_rvt',
        source_files: {
          rvt: req.file.originalname,
          xlsx: xlsxFile || null,
          dae: daeFile || null,
        },
      })
    }

    return res.json(response)
  } catch (err) {
    console.error('[Revit Process] Error:', err)
    return res.status(500).json(errorPayload(
      'PROCESS_MODEL_FAILED',
      'Failed to process Revit model',
      { message: err.message },
    ))
  } finally {
    await safeUnlink(cleanupPath)
    // Keep output directory for downloadable artifacts in success flow.
    if (!res.headersSent || res.statusCode >= 400) {
      await safeRmDir(outputDir)
    }
  }
})

// ---------------------------------------------------------------------------
// 22a. POST /api/revit/process-model-async — Async RVT conversion with SSE
// ---------------------------------------------------------------------------
app.post('/api/revit/process-model-async', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json(errorPayload('NO_FILE', 'No file uploaded'))
    }

    const ext = path.extname(req.file.originalname).toLowerCase()
    if (ext !== '.rvt') {
      await safeUnlink(req.file.path)
      return res.status(400).json(errorPayload('INVALID_FILE_TYPE', 'Only .rvt files are accepted'))
    }

    if (activeRvtCount >= MAX_CONCURRENT_RVT) {
      await safeUnlink(req.file.path)
      return res.status(429).json(errorPayload('TOO_MANY_JOBS', `Max ${MAX_CONCURRENT_RVT} concurrent conversions`))
    }

    const modelScope = normalizeModelScope(req.body, req.file)
    const converter = CONVERTER_PATHS.rvt
    const converterExe = path.join(converter.dir, converter.exe)
    const converterAvailable = ENABLE_RVT_CONVERTER && existsSync(converterExe)

    if (!converterAvailable) {
      await safeUnlink(req.file.path)
      return res.status(503).json({
        ...manualRvtFallback(modelScope.projectId, modelScope.modelVersion),
        reason: !ENABLE_RVT_CONVERTER ? 'feature_flag_disabled' : 'converter_not_found',
        converterPath: converterExe,
      })
    }

    const jobId = `rvt-${Date.now()}`
    const outputDir = path.join(UPLOADS_DIR, jobId)
    await fs.mkdir(outputDir, { recursive: true })

    const requestedExportMode = String(req.body.exportMode || process.env.RVT_EXPORT_MODE || 'complete').trim().toLowerCase()

    // RvtExporter expects: <input.rvt> [<output.dae>] [<output.xlsx>] [<export mode>] [bbox] [room] [schedule]
    const baseName = path.basename(req.file.originalname, path.extname(req.file.originalname))
    const outDae = path.join(outputDir, `${baseName}.dae`)
    const outXlsx = path.join(outputDir, `${baseName}.xlsx`)

    const job = {
      status: 'converting',
      outputDir,
      result: null,
      error: null,
      startTime: Date.now(),
      sseClients: [],
      xlsxReady: false,
      daeReady: false,
      modelScope,
      requestedExportMode,
      filePath: req.file.path,
      originalName: req.file.originalname,
    }
    rvtJobs.set(jobId, job)
    activeRvtCount++

    // Return immediately with 202
    res.status(202).json({ jobId, outputDir: path.basename(outputDir) })

    // File watcher interval
    const watcher = setInterval(() => {
      try {
        const files = require('fs').readdirSync(outputDir)
        const newXlsx = files.some((f) => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'))
        const newDae = files.some((f) => f.toLowerCase().endsWith('.dae'))

        if (newXlsx !== job.xlsxReady || newDae !== job.daeReady) {
          job.xlsxReady = newXlsx
          job.daeReady = newDae
          broadcastSSE(job, 'progress', {
            dae: job.daeReady,
            xlsx: job.xlsxReady,
            elapsedMs: Date.now() - job.startTime,
          })
        }
      } catch { /* outputDir not ready yet */ }
    }, 500)

    // Run conversion
    async function runConversion() {
      try {
        await new Promise((resolve, reject) => {
          const args = [req.file.path, outDae, outXlsx, requestedExportMode, 'bbox', 'room']
          console.log(`[Revit Async] Running: "${converterExe}" ${args.join(' ')}`)
          const proc = spawn(converterExe, args, {
            stdio: ['pipe', 'pipe', 'pipe'],
            timeout: 300000,
            cwd: CONVERTER_PATHS.rvt.dir,
          })
          let stdout = ''
          let stderr = ''
          proc.stdout.on('data', (chunk) => {
            stdout += chunk.toString()
            // Handle "Press Enter to continue..." prompt
            if (stdout.includes('Press Enter')) {
              proc.stdin.write('\n')
            }
          })
          proc.stderr.on('data', (chunk) => { stderr += chunk.toString() })
          proc.on('close', (code) => {
            console.log(`[Revit Async] Exit code: ${code}`)
            if (stdout) console.log(`[Revit Async] stdout: ${stdout.slice(0, 1000)}`)
            if (stderr) console.warn(`[Revit Async] stderr: ${stderr.slice(0, 500)}`)
            if (code === 0) resolve(undefined)
            else reject(new Error(`RvtExporter exit code ${code}: ${stderr.slice(0, 500)}`))
          })
          proc.on('error', reject)
        })
      } catch (convErr) {
        clearInterval(watcher)
        job.status = 'error'
        job.error = convErr?.message || 'RvtExporter failed'
        activeRvtCount--
        broadcastSSE(job, 'error', { code: 'CONVERTER_FAILED', message: job.error })
        await safeUnlink(req.file.path)
        return
      }

      clearInterval(watcher)

      // Final file check
      const outputFiles = await fs.readdir(outputDir)
      const xlsxFile = outputFiles.find((f) => f.toLowerCase().endsWith('.xlsx') || f.toLowerCase().endsWith('.xls'))
      const daeFile = outputFiles.find((f) => f.toLowerCase().endsWith('.dae'))

      job.xlsxReady = !!xlsxFile
      job.daeReady = !!daeFile

      broadcastSSE(job, 'progress', {
        dae: job.daeReady,
        xlsx: job.xlsxReady,
        elapsedMs: Date.now() - job.startTime,
      })

      const response = {
        status: 'success',
        projectId: modelScope.projectId,
        modelVersion: modelScope.modelVersion,
        mode: 'auto_rvt_converter',
        outputs: {
          daePath: daeFile ? `/uploads/${jobId}/${daeFile}` : null,
          xlsxPath: xlsxFile ? `/uploads/${jobId}/${xlsxFile}` : null,
          files: outputFiles,
        },
        xlsxImport: null,
        matchSummary: null,
        converter: {
          exportMode: requestedExportMode,
        },
      }

      // Process XLSX if available
      const preflight = supabaseServer ? await dbPreflight() : null
      const allowSupabase = !!supabaseServer && !!preflight?.available

      if (xlsxFile) {
        try {
          const xlsxPath = path.join(outputDir, xlsxFile)
          const XLSX = (await import('xlsx')).default
          const workbook = XLSX.readFile(xlsxPath)
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
          const availableColumns = Object.keys(rows[0] || {})
          const { resolvedMap, mappedColumns } = resolveRevitColumns(availableColumns)

          const { records, errors: rowErrors } = mapRevitRowsToRecords(
            rows, availableColumns, resolvedMap, mappedColumns,
            { projectId: modelScope.projectId, modelVersion: modelScope.modelVersion, sourceFile: xlsxFile },
          )

          const upsertResult = records.length > 0 ? await upsertRevitRecords(records, {
            projectId: modelScope.projectId,
            modelVersion: modelScope.modelVersion,
            sourceFile: xlsxFile,
          }, { sourceFile: xlsxFile, sourceMode: 'auto_rvt', allowSupabase }) : {
            insertedCount: 0, errors: [{ reason: 'No valid rows in generated XLSX' }],
            onConflict: null, persistence: 'runtime', dbInsertedCount: 0, runtimeStoredCount: 0, runtimeRevision: null,
          }

          const allErrors = [...rowErrors, ...(upsertResult.errors || [])]
          response.xlsxImport = {
            insertedCount: upsertResult.insertedCount,
            parsedRows: rows.length,
            validRows: records.length,
            errorCount: allErrors.length,
            coverage: buildUploadCoverage(records, rows.length),
          }

          broadcastSSE(job, 'xlsx_import', {
            insertedCount: upsertResult.insertedCount,
            parsedRows: rows.length,
            validRows: records.length,
            coverage: buildUploadCoverage(records, rows.length),
          })

          await insertModelRun({
            project_id: modelScope.projectId,
            model_version: modelScope.modelVersion,
            source_mode: 'auto_rvt_async',
            source_files: { rvt: job.originalName, xlsx: xlsxFile || null, dae: daeFile || null },
          })
        } catch (xlsxErr) {
          console.error('[Revit Async] XLSX processing error:', xlsxErr)
        }
      }

      job.status = 'complete'
      job.result = response
      activeRvtCount--
      broadcastSSE(job, 'complete', response)
      await safeUnlink(req.file.path)
    }

    runConversion().catch((err) => {
      clearInterval(watcher)
      job.status = 'error'
      job.error = err.message
      activeRvtCount--
      broadcastSSE(job, 'error', { code: 'UNEXPECTED', message: err.message })
      safeUnlink(req.file.path).catch(() => {})
    })
  } catch (err) {
    console.error('[Revit Async] Error:', err)
    return res.status(500).json(errorPayload('ASYNC_PROCESS_FAILED', 'Failed to start async processing', { message: err.message }))
  }
})

// ---------------------------------------------------------------------------
// 22b. GET /api/revit/process-status-stream/:jobId — SSE progress stream
// ---------------------------------------------------------------------------
app.get('/api/revit/process-status-stream/:jobId', (req, res) => {
  const { jobId } = req.params
  const job = rvtJobs.get(jobId)

  if (!job) {
    return res.status(404).json(errorPayload('JOB_NOT_FOUND', `Job ${jobId} not found`))
  }

  // SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no',
  })

  // Send current state immediately
  res.write(`event: progress\ndata: ${JSON.stringify({
    dae: job.daeReady || false,
    xlsx: job.xlsxReady || false,
    elapsedMs: Date.now() - job.startTime,
  })}\n\n`)

  if (job.status === 'complete' && job.result) {
    res.write(`event: complete\ndata: ${JSON.stringify(job.result)}\n\n`)
    res.end()
    return
  }

  if (job.status === 'error') {
    res.write(`event: error\ndata: ${JSON.stringify({ code: 'JOB_FAILED', message: job.error })}\n\n`)
    res.end()
    return
  }

  // Register as SSE client
  job.sseClients.push(res)

  // Keep-alive
  const keepAlive = setInterval(() => {
    try { res.write(': keepalive\n\n') } catch { clearInterval(keepAlive) }
  }, 15000)

  req.on('close', () => {
    clearInterval(keepAlive)
    const idx = job.sseClients.indexOf(res)
    if (idx !== -1) job.sseClients.splice(idx, 1)
  })
})

// ---------------------------------------------------------------------------
// 21. n8n Integration Endpoints
// ---------------------------------------------------------------------------

import n8nBridge from './n8n-bridge.js'

function sendN8nError(res, err, fallbackMessage) {
  const status = Number(err?.status)
  const httpStatus = Number.isInteger(status) && status >= 400 && status <= 599 ? status : 502
  const payload = {
    error: fallbackMessage,
    code: err?.code || 'N8N_ERROR',
    message: err?.message || fallbackMessage,
  }
  if (err?.url) payload.url = err.url
  res.status(httpStatus).json(payload)
}

// GET /api/n8n/health — Check if n8n is reachable
app.get('/api/n8n/health', async (_req, res) => {
  try {
    const health = await n8nBridge.checkHealth()
    res.json(health)
  } catch (err) {
    res.json({ online: false, url: process.env.N8N_URL || 'http://localhost:5678', error: err.message })
  }
})

// GET /api/n8n/workflows — List all n8n workflows
app.get('/api/n8n/workflows', async (_req, res) => {
  try {
    const workflows = await n8nBridge.listWorkflows()
    res.json(workflows)
  } catch (err) {
    console.error('[n8n] Failed to list workflows:', err.message)
    sendN8nError(res, err, 'Cannot list n8n workflows')
  }
})

// GET /api/n8n/workflow-triggers — Trigger map for each workflow
app.get('/api/n8n/workflow-triggers', async (_req, res) => {
  try {
    const triggerMap = await n8nBridge.listWorkflowTriggers()
    res.json(triggerMap)
  } catch (err) {
    console.error('[n8n] Failed to list workflow triggers:', err.message)
    sendN8nError(res, err, 'Cannot list n8n workflow triggers')
  }
})

// GET /api/n8n/executions — Recent executions
app.get('/api/n8n/executions', async (req, res) => {
  try {
    const { workflowId, limit } = req.query
    const executions = await n8nBridge.getExecutions(workflowId, limit ? parseInt(limit, 10) : 20)
    res.json(executions)
  } catch (err) {
    console.error('[n8n] Failed to get executions:', err.message)
    sendN8nError(res, err, 'Cannot list n8n executions')
  }
})

// GET /api/n8n/status/:executionId — Get execution status
app.get('/api/n8n/status/:executionId', async (req, res) => {
  try {
    const execution = await n8nBridge.getWorkflowStatus(req.params.executionId)
    res.json(execution)
  } catch (err) {
    console.error('[n8n] Failed to get execution status:', err.message)
    sendN8nError(res, err, 'Cannot get n8n execution status')
  }
})

const triggerN8nWorkflowHandler = async (req, res) => {
  try {
    const rawPath = req.params?.webhookPath || req.params?.[0] || req.body?.webhookPath
    if (!rawPath || typeof rawPath !== 'string') {
      return res.status(400).json({
        error: 'Invalid n8n trigger request',
        code: 'INVALID_WEBHOOK_PATH',
        message: 'webhookPath is required in URL or request body',
      })
    }

    let webhookPath = rawPath
    try {
      webhookPath = decodeURIComponent(rawPath)
    } catch {
      // keep raw value if decoding fails
    }

    const payload = { ...(req.body || {}) }
    delete payload.webhookPath

    const result = await n8nBridge.triggerWorkflow(webhookPath, payload)

    if (typeof result.data === 'string') {
      return res.status(result.status).send(result.data)
    }
    if (result.data == null) {
      return res.status(result.status).end()
    }
    return res.status(result.status).json(result.data)
  } catch (err) {
    console.error('[n8n] Failed to trigger workflow:', err.message)
    return sendN8nError(res, err, 'Cannot trigger n8n workflow')
  }
}

// POST /api/n8n/trigger/:webhookPath — Trigger a workflow via webhook
app.post('/api/n8n/trigger/:webhookPath', triggerN8nWorkflowHandler)
// Supports encoded/full paths that may include slashes
app.post(/^\/api\/n8n\/trigger\/(.+)$/, triggerN8nWorkflowHandler)
// Optional JSON contract: { webhookPath, ...payload }
app.post('/api/n8n/trigger', triggerN8nWorkflowHandler)

// ---------------------------------------------------------------------------
// n8n Callback Receivers — n8n posts results here after execution
// ---------------------------------------------------------------------------

// POST /api/n8n/callback — Universal workflow result receiver
app.post('/api/n8n/callback', express.json(), async (req, res) => {
  try {
    if (!supabaseServer) return res.status(503).json({ error: 'Supabase not configured' })
    const { executionId, workflowId, workflowName, module, status, inputData, outputData, errorMessage, startedAt, finishedAt } = req.body
    const { data, error } = await supabaseServer
      .from('n8n_results')
      .insert({
        execution_id: executionId || null,
        workflow_id: workflowId || null,
        workflow_name: workflowName || null,
        module: module || 'general',
        status: status || 'completed',
        input_data: inputData || {},
        output_data: outputData || {},
        error_message: errorMessage || null,
        started_at: startedAt || null,
        finished_at: finishedAt || new Date().toISOString(),
      })
      .select()
      .single()
    if (error) {
      console.error('[n8n callback] Insert failed:', error.message)
      return res.status(500).json({ error: error.message })
    }
    console.log(`[n8n callback] Saved result for ${module} (exec: ${executionId})`)
    res.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[n8n callback] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/n8n/callback/cost-estimate — Cost estimation result from Telegram/n8n
app.post('/api/n8n/callback/cost-estimate', express.json(), async (req, res) => {
  try {
    if (!supabaseServer) return res.status(503).json({ error: 'Supabase not configured' })
    const { source, queryText, photoUrl, language, items, totalCost, currency, region, confidence, rawResponse } = req.body
    const { data, error } = await supabaseServer
      .from('n8n_cost_estimates')
      .insert({
        source: source || 'telegram',
        query_text: queryText || null,
        photo_url: photoUrl || null,
        language: language || 'EN',
        items: items || [],
        total_cost: totalCost || 0,
        currency: currency || 'EUR',
        region: region || null,
        confidence: confidence || null,
        raw_response: rawResponse || {},
      })
      .select()
      .single()
    if (error) {
      console.error('[n8n callback/cost] Insert failed:', error.message)
      return res.status(500).json({ error: error.message })
    }
    console.log(`[n8n callback/cost] Saved estimate from ${source}: ${totalCost} ${currency}`)
    res.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[n8n callback/cost] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/n8n/callback/field-report — Field photo report from site
app.post('/api/n8n/callback/field-report', express.json(), async (req, res) => {
  try {
    if (!supabaseServer) return res.status(503).json({ error: 'Supabase not configured' })
    const { taskId, reporter, description, photoUrls, gpsLat, gpsLon, address, reportType, metadata } = req.body
    const { data, error } = await supabaseServer
      .from('field_reports')
      .insert({
        task_id: taskId || null,
        reporter: reporter || 'Unknown',
        description: description || null,
        photo_urls: photoUrls || [],
        gps_lat: gpsLat || null,
        gps_lon: gpsLon || null,
        address: address || null,
        report_type: reportType || 'progress',
        metadata: metadata || {},
      })
      .select()
      .single()
    if (error) {
      console.error('[n8n callback/field-report] Insert failed:', error.message)
      return res.status(500).json({ error: error.message })
    }
    console.log(`[n8n callback/field-report] Saved report from ${reporter}`)
    res.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[n8n callback/field-report] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/n8n/callback/worker-location — GPS update (upsert latest)
app.post('/api/n8n/callback/worker-location', express.json(), async (req, res) => {
  try {
    if (!supabaseServer) return res.status(503).json({ error: 'Supabase not configured' })
    const { workerName, lat, lon, accuracy, metadata } = req.body
    if (!workerName || lat == null || lon == null) {
      return res.status(400).json({ error: 'workerName, lat, lon are required' })
    }
    const { data, error } = await supabaseServer
      .from('worker_locations')
      .insert({
        worker_name: workerName,
        lat,
        lon,
        accuracy: accuracy || null,
        recorded_at: new Date().toISOString(),
        metadata: metadata || {},
      })
      .select()
      .single()
    if (error) {
      console.error('[n8n callback/worker-location] Insert failed:', error.message)
      return res.status(500).json({ error: error.message })
    }
    console.log(`[n8n callback/worker-location] Updated ${workerName}: ${lat},${lon}`)
    res.json({ ok: true, id: data.id })
  } catch (err) {
    console.error('[n8n callback/worker-location] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// GET /api/n8n/cost-estimates — Read cost estimates from Supabase
app.get('/api/n8n/cost-estimates', async (req, res) => {
  try {
    if (!supabaseServer) return res.status(503).json({ error: 'Supabase not configured' })
    const { source, limit, language } = req.query
    let query = supabaseServer.from('n8n_cost_estimates').select('*').order('created_at', { ascending: false })
    if (source) query = query.eq('source', source)
    if (language) query = query.eq('language', language)
    query = query.limit(Number(limit) || 20)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/field-reports — Read field reports
app.get('/api/field-reports', async (req, res) => {
  try {
    if (!supabaseServer) return res.status(503).json({ error: 'Supabase not configured' })
    const { taskId, limit } = req.query
    let query = supabaseServer.from('field_reports').select('*').order('created_at', { ascending: false })
    if (taskId) query = query.eq('task_id', taskId)
    query = query.limit(Number(limit) || 50)
    const { data, error } = await query
    if (error) return res.status(500).json({ error: error.message })
    res.json(data || [])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// GET /api/worker-locations — Latest location per worker
app.get('/api/worker-locations', async (_req, res) => {
  try {
    if (!supabaseServer) return res.status(503).json({ error: 'Supabase not configured' })
    // Get latest location for each worker using distinct on
    const { data, error } = await supabaseServer
      .from('worker_locations')
      .select('*')
      .order('worker_name', { ascending: true })
      .order('recorded_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    // Deduplicate: keep only latest per worker
    const latest = new Map()
    for (const row of (data || [])) {
      if (!latest.has(row.worker_name)) latest.set(row.worker_name, row)
    }
    res.json([...latest.values()])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/tasks/:id/notify — Trigger n8n Telegram notification for a task
app.post('/api/tasks/:id/notify', express.json(), async (req, res) => {
  try {
    if (!supabaseServer) return res.status(503).json({ error: 'Supabase not configured' })
    const { id } = req.params
    const { data: task, error } = await supabaseServer.from('tasks').select('*').eq('id', id).single()
    if (error || !task) return res.status(404).json({ error: 'Task not found' })
    // Trigger n8n workflow for Telegram notification
    const result = await n8nBridge.triggerWorkflow('/webhook/task-notification', {
      taskId: task.id,
      title: task.title,
      description: task.description,
      assignee: task.assignee,
      priority: task.priority,
      status: task.status,
    })
    res.json({ ok: true, n8nResult: result })
  } catch (err) {
    console.error('[task notify] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// POST /api/converter/pipeline — Post-processing pipeline after conversion
app.post('/api/converter/pipeline', express.json(), async (req, res) => {
  try {
    const { fileName, outputFormat, pipelines } = req.body
    if (!pipelines || !Array.isArray(pipelines) || pipelines.length === 0) {
      return res.status(400).json({ error: 'pipelines array is required' })
    }
    const results = []
    for (const pipeline of pipelines) {
      try {
        const result = await n8nBridge.triggerWorkflow(pipeline.webhook, {
          fileName,
          outputFormat,
          ...pipeline.data,
        })
        results.push({ pipeline: pipeline.name, status: 'triggered', result: result.data })
      } catch (err) {
        results.push({ pipeline: pipeline.name, status: 'failed', error: err.message })
      }
    }
    res.json({ ok: true, results })
  } catch (err) {
    console.error('[converter/pipeline] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
})

// ---------------------------------------------------------------------------
// 23. POST /api/cost/validate-vor — AI validation of VOR Excel file
// ---------------------------------------------------------------------------
app.post('/api/cost/validate-vor', upload.single('file'), async (req, res) => {
  try {
    if (!requireGemini(res)) return

    if (!req.file) {
      return res.status(400).json({ error: 'Excel file is required' })
    }

    const language = (req.body.language || 'en').toLowerCase()

    // 1. Parse uploaded Excel
    const XLSX = (await import('xlsx')).default
    const workbook = XLSX.readFile(req.file.path)
    const sheetName = workbook.SheetNames[0]
    const sheet = workbook.Sheets[sheetName]
    const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

    if (rawRows.length === 0) {
      return res.status(400).json({ error: 'Excel file is empty or has no data rows' })
    }

    // 2. Auto-detect columns
    const headers = Object.keys(rawRows[0])
    const findCol = (patterns) => headers.find(h => {
      const lower = h.toLowerCase()
      return patterns.some(p => lower.includes(p))
    })

    const nameCol = findCol(['наименование', 'name', 'описание', 'description', 'работа', 'item', 'позиция', 'material'])
    const unitCol = findCol(['ед', 'unit', 'единица', 'изм'])
    const qtyCol = findCol(['кол', 'объём', 'объем', 'qty', 'quantity', 'volume', 'amount', 'количество'])

    if (!nameCol) {
      return res.status(400).json({
        error: 'Cannot detect name column in Excel',
        detectedHeaders: headers,
      })
    }

    // 3. Map rows
    const vorRows = rawRows
      .map((row, idx) => ({
        index: idx,
        name: String(row[nameCol] || '').trim(),
        unit: unitCol ? String(row[unitCol] || '').trim() : '',
        quantity: qtyCol ? (parseFloat(row[qtyCol]) || 0) : 0,
      }))
      .filter(r => r.name.length > 0)

    console.log(`[VOR Validate] Parsed ${vorRows.length} rows from ${req.file.originalname}`)

    // 4. Send to Gemini for validation
    const rowsToValidate = vorRows.slice(0, 100)
    const truncated = vorRows.length > 100
    const langLabel = language === 'ru' ? 'Russian' : language === 'de' ? 'German' : 'English'
    const prompt = `You are a construction cost estimating QA expert. Analyze this Bill of Quantities (ВОР / BOQ) for issues.

Check for these problems:
1. DUPLICATE entries (same or very similar work item names)
2. UNIT MISMATCHES (wrong unit for work type, e.g. m² for concrete volume)
3. ZERO or NEGATIVE quantities
4. SUSPICIOUS values (unrealistically high or low quantities)
5. MISSING related work (e.g. concrete without reinforcement, painting without primer)
6. INCONSISTENT naming conventions
7. EMPTY or unclear descriptions

For each issue, provide a JSON object:
- type: "error" | "warning" | "info"
- message: clear description of the issue (in ${langLabel})
- rowIndex: row number (0-based) if applicable
- itemName: the item name if applicable
- details: additional context

Items to validate (${rowsToValidate.length} rows${truncated ? `, showing first 100 of ${vorRows.length}` : ''}):
${JSON.stringify(rowsToValidate, null, 2)}

Respond ONLY with a JSON array of issue objects, no markdown, no explanation. If no issues found, return [].`

    const result = await geminiModel.generateContent(prompt)
    const responseText = result.response.text()
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    let issues = []
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0])
        // Validate each issue has required fields
        issues = parsed
          .filter(i => i && typeof i.message === 'string' && ['error', 'warning', 'info'].includes(i.type))
          .map(i => ({
            type: i.type,
            message: i.message,
            rowIndex: typeof i.rowIndex === 'number' ? i.rowIndex : undefined,
            itemName: typeof i.itemName === 'string' ? i.itemName : undefined,
            details: typeof i.details === 'string' ? i.details : undefined,
          }))
      } catch (parseErr) {
        console.error('[VOR Validate] Failed to parse Gemini response:', parseErr.message)
      }
    }

    // Add info issue if rows were truncated
    if (truncated) {
      issues.unshift({
        type: 'info',
        message: `Проверено ${rowsToValidate.length} из ${vorRows.length} строк. Загрузите файл с меньшим числом строк для полной проверки.`,
        rowIndex: undefined,
        itemName: undefined,
        details: undefined,
      })
    }

    // Cleanup
    try { await fs.unlink(req.file.path) } catch { /* ignore */ }

    const summary = {
      errors: issues.filter(i => i.type === 'error').length,
      warnings: issues.filter(i => i.type === 'warning').length,
      info: issues.filter(i => i.type === 'info').length,
    }

    console.log(`[VOR Validate] Found ${issues.length} issues (${summary.errors}E/${summary.warnings}W/${summary.info}I)`)
    res.json({ issues, summary })
  } catch (err) {
    console.error('[VOR Validate] Error:', err)
    res.status(500).json({ error: 'VOR validation failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 24. POST /api/cost/compare-vor — Compare two VOR Excel files
// ---------------------------------------------------------------------------
app.post('/api/cost/compare-vor', upload.array('files', 2), async (req, res) => {
  try {
    if (!req.files || req.files.length < 2) {
      return res.status(400).json({ error: 'Two Excel files are required for comparison' })
    }

    const XLSX = (await import('xlsx')).default

    // Parse both files
    const parseFile = (filePath) => {
      const workbook = XLSX.readFile(filePath)
      const sheet = workbook.Sheets[workbook.SheetNames[0]]
      const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
      if (rawRows.length === 0) return []

      const headers = Object.keys(rawRows[0])
      const findCol = (patterns) => headers.find(h => {
        const lower = h.toLowerCase()
        return patterns.some(p => lower.includes(p))
      })

      const nameCol = findCol(['наименование', 'name', 'описание', 'description', 'работа', 'item', 'позиция', 'material'])
      const unitCol = findCol(['ед', 'unit', 'единица', 'изм'])
      const qtyCol = findCol(['кол', 'объём', 'объем', 'qty', 'quantity', 'volume', 'amount', 'количество'])

      if (!nameCol) return []

      return rawRows
        .map(row => ({
          name: String(row[nameCol] || '').trim(),
          unit: unitCol ? String(row[unitCol] || '').trim() : '',
          quantity: qtyCol ? (parseFloat(row[qtyCol]) || 0) : 0,
        }))
        .filter(r => r.name.length > 0)
    }

    const rows1 = parseFile(req.files[0].path)
    const rows2 = parseFile(req.files[1].path)

    if (rows1.length === 0 && rows2.length === 0) {
      for (const f of req.files) { try { await fs.unlink(f.path) } catch { /* ignore */ } }
      return res.status(400).json({ error: 'Both files are empty or have unrecognizable columns' })
    }

    console.log(`[VOR Compare] File1: ${rows1.length} rows, File2: ${rows2.length} rows`)

    // Build maps by normalized name
    const normalize = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()
    const map1 = new Map()
    rows1.forEach(r => map1.set(normalize(r.name), r))
    const map2 = new Map()
    rows2.forEach(r => map2.set(normalize(r.name), r))

    const added = []
    const removed = []
    const changed = []
    let unchangedCount = 0

    // Items in file2 but not in file1 = added
    for (const [key, row] of map2) {
      if (!map1.has(key)) {
        added.push({ name: row.name, unit: row.unit, quantity: row.quantity })
      }
    }

    // Items in file1 but not in file2 = removed
    for (const [key, row] of map1) {
      if (!map2.has(key)) {
        removed.push({ name: row.name, unit: row.unit, quantity: row.quantity })
      }
    }

    // Items in both = check for changes
    for (const [key, row1] of map1) {
      if (map2.has(key)) {
        const row2 = map2.get(key)
        if (row1.quantity !== row2.quantity) {
          const diff = row2.quantity - row1.quantity
          const pct = row1.quantity !== 0 ? (diff / row1.quantity) * 100 : 100
          changed.push({
            name: row1.name,
            unit: row2.unit || row1.unit,
            oldQuantity: row1.quantity,
            newQuantity: row2.quantity,
            quantityDiff: Math.round(diff * 100) / 100,
            percentChange: Math.round(pct * 10) / 10,
          })
        } else {
          unchangedCount++
        }
      }
    }

    // Cleanup
    for (const f of req.files) {
      try { await fs.unlink(f.path) } catch { /* ignore */ }
    }

    const summary = {
      totalFile1: rows1.length,
      totalFile2: rows2.length,
      addedCount: added.length,
      removedCount: removed.length,
      changedCount: changed.length,
      unchangedCount,
    }

    console.log(`[VOR Compare] +${added.length} -${removed.length} ~${changed.length} =${unchangedCount}`)
    res.json({ added, removed, changed, summary })
  } catch (err) {
    console.error('[VOR Compare] Error:', err)
    res.status(500).json({ error: 'VOR comparison failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 22. Native CWICR Search Endpoints
// ---------------------------------------------------------------------------

app.post('/api/cwicr/search', async (req, res) => {
  if (!cwicr) return res.status(503).json({ error: 'CWICR engine not initialized' })
  try {
    const { query, language = 'EN', topK = 10 } = req.body
    if (!query) return res.status(400).json({ error: 'query is required' })
    const results = await cwicr.fullSearch(query, language, topK)
    res.json(results)
  } catch (err) {
    console.error('[CWICR] search error:', err.message)
    res.status(500).json({ error: 'Search failed', message: err.message })
  }
})

app.post('/api/cwicr/estimate', async (req, res) => {
  if (!cwicr) return res.status(503).json({ error: 'CWICR engine not initialized' })
  try {
    const { works, language = 'EN' } = req.body
    if (!works || !Array.isArray(works)) return res.status(400).json({ error: 'works array is required' })
    const results = await cwicr.calculateCosts(works, language)
    res.json(results)
  } catch (err) {
    console.error('[CWICR] estimate error:', err.message)
    res.status(500).json({ error: 'Estimate failed', message: err.message })
  }
})

app.post('/api/cwicr/parse-text', async (req, res) => {
  if (!costEngine) return res.status(503).json({ error: 'Cost engine not initialized' })
  try {
    const { text, language = 'EN' } = req.body
    if (!text) return res.status(400).json({ error: 'text is required' })
    const works = await costEngine.parseTextToWorks(text, language)
    res.json({ works })
  } catch (err) {
    console.error('[CWICR] parse-text error:', err.message)
    res.status(500).json({ error: 'Parse failed', message: err.message })
  }
})

app.post('/api/cwicr/parse-photo', upload.single('photo'), async (req, res) => {
  if (!costEngine) return res.status(503).json({ error: 'Cost engine not initialized' })
  try {
    if (!req.file) return res.status(400).json({ error: 'photo file is required' })
    const imageBuffer = await fs.readFile(req.file.path)
    const imageBase64 = imageBuffer.toString('base64')
    const language = req.body.language || 'EN'
    const works = await costEngine.parsePhotoToWorks(imageBase64, language)
    res.json({ works })
  } catch (err) {
    console.error('[CWICR] parse-photo error:', err.message)
    res.status(500).json({ error: 'Photo parse failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 23. Native Cost Estimation Endpoints
// ---------------------------------------------------------------------------

app.post('/api/cost/estimate-text', async (req, res) => {
  if (!costEngine) return res.status(503).json({ error: 'Cost engine not initialized' })
  try {
    const { text, language = 'EN' } = req.body
    if (!text) return res.status(400).json({ error: 'text is required' })
    const result = await costEngine.estimateFromText(text, language)
    res.json(result)
  } catch (err) {
    console.error('[Cost] estimate-text error:', err.message)
    res.status(500).json({ error: 'Text estimation failed', message: err.message })
  }
})

app.post('/api/cost/estimate-photo', upload.single('photo'), async (req, res) => {
  if (!costEngine) return res.status(503).json({ error: 'Cost engine not initialized' })
  try {
    if (!req.file) return res.status(400).json({ error: 'photo file is required' })
    const imageBuffer = await fs.readFile(req.file.path)
    const imageBase64 = imageBuffer.toString('base64')
    const language = req.body.language || 'EN'
    const result = await costEngine.estimateFromPhoto(imageBase64, language)
    res.json(result)
  } catch (err) {
    console.error('[Cost] estimate-photo error:', err.message)
    res.status(500).json({ error: 'Photo estimation failed', message: err.message })
  }
})

app.post('/api/cost/estimate-works', async (req, res) => {
  if (!costEngine) return res.status(503).json({ error: 'Cost engine not initialized' })
  try {
    const { works, language = 'EN' } = req.body
    if (!works || !Array.isArray(works)) return res.status(400).json({ error: 'works array is required' })
    const items = await costEngine.estimateWorks(works, language)
    const summary = costEngine.aggregateResults(items)
    res.json({ items, summary })
  } catch (err) {
    console.error('[Cost] estimate-works error:', err.message)
    res.status(500).json({ error: 'Works estimation failed', message: err.message })
  }
})

app.get('/api/cost/estimate/:id', async (req, res) => {
  if (!supabaseServer) return res.status(503).json({ error: 'Database not available' })
  try {
    const { data, error } = await supabaseServer
      .from('cost_estimates')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (error) throw error
    res.json(data)
  } catch (err) {
    console.error('[Cost] get estimate error:', err.message)
    res.status(500).json({ error: 'Failed to fetch estimate', message: err.message })
  }
})

app.post('/api/cost/export/:id', async (req, res) => {
  if (!costEngine) return res.status(503).json({ error: 'Cost engine not initialized' })
  try {
    const { format = 'csv' } = req.body
    const { data, error } = await supabaseServer
      .from('cost_estimates')
      .select('*')
      .eq('id', req.params.id)
      .single()
    if (error) throw error
    if (format === 'html') {
      const html = costEngine.exportHTML(data.items || [], data)
      res.setHeader('Content-Type', 'text/html')
      res.send(html)
    } else {
      const csv = costEngine.exportCSV(data.items || [])
      res.setHeader('Content-Type', 'text/csv')
      res.setHeader('Content-Disposition', `attachment; filename="estimate-${req.params.id}.csv"`)
      res.send(csv)
    }
  } catch (err) {
    console.error('[Cost] export error:', err.message)
    res.status(500).json({ error: 'Export failed', message: err.message })
  }
})

app.get('/api/cost/estimates', async (_req, res) => {
  if (!supabaseServer) return res.status(503).json({ error: 'Database not available' })
  try {
    const { data, error } = await supabaseServer
      .from('cost_estimates')
      .select('id, source, query_text, language, total_cost, currency, region, confidence, created_at')
      .order('created_at', { ascending: false })
      .limit(50)
    if (error) throw error
    res.json(data || [])
  } catch (err) {
    console.error('[Cost] list estimates error:', err.message)
    res.status(500).json({ error: 'Failed to list estimates', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 23b. GET /api/engines/status — Native engines dashboard
// ---------------------------------------------------------------------------

app.get('/api/engines/status', (_req, res) => {
  const converterStatus = converterAvailability()
  const converterCount = Object.values(converterStatus).filter(c => c.available).length

  let cwicrLanguageCount = 0
  let cwicrCachedRows = 0
  for (const [lang, config] of Object.entries(CWICR_LANGUAGE_MAP)) {
    cwicrLanguageCount++
    cwicrCachedRows += cwicrCache[lang]?.length || 0
  }

  const sheetsConfigured = !!(process.env.GOOGLE_SHEETS_ID)

  res.json({
    platform: 'Jens Construction Platform',
    status: 'ok',
    engines: {
      cwicr: {
        name: 'CWICR Vector Search',
        status: cwicrLanguageCount > 0 ? 'online' : 'offline',
        details: { languageCount: cwicrLanguageCount, cachedRows: cwicrCachedRows },
      },
      costEstimation: {
        name: 'Cost Estimation',
        status: geminiModel ? 'online' : 'degraded',
        details: { geminiAvailable: !!geminiModel },
      },
      cadPipeline: {
        name: 'CAD/BIM Pipeline',
        status: converterCount > 0 ? 'online' : 'degraded',
        details: { converterCount, converters: converterStatus },
      },
      sheetsSync: {
        name: 'Google Sheets Sync',
        status: sheetsConfigured && sheetsSync ? 'online' : 'offline',
        details: { configured: sheetsConfigured },
      },
    },
    telegram: {
      configured: !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID),
      botUsername: '@jenssssssssss_bot',
    },
    gemini: {
      available: !!geminiModel,
    },
  })
})

// ---------------------------------------------------------------------------
// 24. Telegram Webhook Endpoint (native, replaces n8n bot)
// ---------------------------------------------------------------------------

app.post('/api/telegram/webhook', async (req, res) => {
  try {
    const { type, ...payload } = req.body
    if (!type) return res.status(400).json({ error: 'type is required' })

    const botToken = process.env.TELEGRAM_BOT_TOKEN
    const chatId = process.env.TELEGRAM_CHAT_ID
    if (!botToken || !chatId) {
      return res.status(503).json({ error: 'Telegram bot not configured (set TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID)' })
    }

    let message = ''
    if (type === 'task_notification') {
      message = `📋 *Новая задача*\n\n*${payload.title || 'Без названия'}*\n${payload.description || ''}\n\n👤 Ответственный: ${payload.assignee || '—'}\n⚡ Приоритет: ${payload.priority || 'medium'}`
    } else if (type === 'cost_estimate') {
      message = `💰 *Новая смета*\n\nОбъект: ${payload.projectName || '—'}\nСумма: ${payload.totalCost || '—'}\nЯзык: ${payload.language || 'EN'}`
    } else if (type === 'field_report') {
      message = `📸 *Полевой отчёт*\n\n${payload.description || ''}\n📍 ${payload.location || '—'}`
    } else if (type === 'test') {
      message = `🧪 *Тестовое сообщение*\n\n${payload.message || 'Проверка связи с Jens Platform'}`
    } else {
      message = `🔔 *Уведомление*\n\n${JSON.stringify(payload, null, 2)}`
    }

    const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`
    const telegramRes = await fetch(telegramUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'Markdown' }),
    })
    const result = await telegramRes.json()
    res.json({ ok: result.ok, messageId: result.result?.message_id })
  } catch (err) {
    console.error('[Telegram] webhook error:', err.message)
    res.status(500).json({ error: 'Telegram send failed', message: err.message })
  }
})

app.get('/api/telegram/status', (_req, res) => {
  const configured = !!(process.env.TELEGRAM_BOT_TOKEN && process.env.TELEGRAM_CHAT_ID)
  res.json({ configured, botToken: configured ? '***configured***' : null })
})

app.get('/api/telegram/setup', async (_req, res) => {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return res.status(503).json({ error: 'TELEGRAM_BOT_TOKEN not set' })
  try {
    const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL
    if (webhookUrl) {
      const setRes = await fetch(`https://api.telegram.org/bot${botToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: webhookUrl }),
      })
      const result = await setRes.json()
      return res.json({ ok: result.ok, description: result.description })
    }
    const infoRes = await fetch(`https://api.telegram.org/bot${botToken}/getWebhookInfo`)
    const info = await infoRes.json()
    res.json(info.result || info)
  } catch (err) {
    console.error('[Telegram] setup error:', err.message)
    res.status(500).json({ error: 'Telegram setup failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// 25. Native CAD Pipeline Endpoints
// ---------------------------------------------------------------------------

app.post('/api/cad/batch-convert', async (req, res) => {
  if (!cadPipeline) return res.status(503).json({ error: 'CAD pipeline not initialized' })
  try {
    const { folder, extension = 'rvt', outputFormat = 'xlsx' } = req.body
    const results = await cadPipeline.batchConvert(folder || UPLOADS_DIR, extension, { outputFormat })
    res.json(results)
  } catch (err) {
    console.error('[CAD] batch-convert error:', err.message)
    res.status(500).json({ error: 'Batch conversion failed', message: err.message })
  }
})

app.post('/api/cad/validate', async (req, res) => {
  if (!cadPipeline) return res.status(503).json({ error: 'CAD pipeline not initialized' })
  try {
    const { elements, rules } = req.body
    if (!elements || !Array.isArray(elements)) return res.status(400).json({ error: 'elements array is required' })
    const results = await cadPipeline.validateBIM(elements, rules)
    res.json(results)
  } catch (err) {
    console.error('[CAD] validate error:', err.message)
    res.status(500).json({ error: 'BIM validation failed', message: err.message })
  }
})

app.post('/api/cad/classify', async (req, res) => {
  if (!cadPipeline) return res.status(503).json({ error: 'CAD pipeline not initialized' })
  try {
    const { elements, system = 'omniclass', language = 'EN' } = req.body
    if (!elements || !Array.isArray(elements)) return res.status(400).json({ error: 'elements array is required' })
    const results = await cadPipeline.classifyElements(elements, system, language)
    res.json(results)
  } catch (err) {
    console.error('[CAD] classify error:', err.message)
    res.status(500).json({ error: 'Classification failed', message: err.message })
  }
})

app.post('/api/cad/qto-report', async (req, res) => {
  if (!cadPipeline) return res.status(503).json({ error: 'CAD pipeline not initialized' })
  try {
    const { elements, projectName, language = 'EN' } = req.body
    if (!elements || !Array.isArray(elements)) return res.status(400).json({ error: 'elements array is required' })
    const report = await cadPipeline.generateQTOReport(elements, projectName, language)
    res.json(report)
  } catch (err) {
    console.error('[CAD] qto-report error:', err.message)
    res.status(500).json({ error: 'QTO report failed', message: err.message })
  }
})

// ---------------------------------------------------------------------------
// Static file serving for uploaded outputs
// ---------------------------------------------------------------------------
app.use('/uploads', express.static(UPLOADS_DIR))

// ---------------------------------------------------------------------------
// 404 Handler
// ---------------------------------------------------------------------------
app.use((_req, res) => {
  res.status(404).json({
    error: 'Not Found',
    message: 'The requested API endpoint does not exist.',
    availableEndpoints: [
      'POST   /api/converter/convert',
      'GET    /api/converter/history',
      'POST   /api/cost/search',
      'POST   /api/cost/classify',
      'POST   /api/cost/calculate',
      'POST   /api/cost/validate-vor',
      'POST   /api/cost/compare-vor',
      'POST   /api/validation/run',
      'POST   /api/ai/analyze',
      'GET    /api/tasks',
      'POST   /api/tasks',
      'PUT    /api/tasks/:id',
      'GET    /api/documents',
      'GET    /api/rfis',
      'GET    /api/submittals',
      'POST   /api/documents/meeting-minutes',
      'POST   /api/qto/generate',
      'POST   /api/ai/chat',
      'GET    /api/health',
      'POST   /api/revit/upload-xlsx',
      'POST   /api/revit/process-model',
      'POST   /api/revit/match-report',
      'GET    /api/revit/properties/:globalId',
      'POST   /api/revit/properties/bulk',
      'POST   /api/cwicr/search',
      'POST   /api/cwicr/estimate',
      'POST   /api/cwicr/parse-text',
      'POST   /api/cwicr/parse-photo',
      'POST   /api/cost/estimate-text',
      'POST   /api/cost/estimate-photo',
      'POST   /api/cost/estimate-works',
      'GET    /api/cost/estimate/:id',
      'POST   /api/cost/export/:id',
      'GET    /api/cost/estimates',
      'POST   /api/telegram/webhook',
      'GET    /api/telegram/status',
      'GET    /api/telegram/setup',
      'POST   /api/cad/batch-convert',
      'POST   /api/cad/validate',
      'POST   /api/cad/classify',
      'POST   /api/cad/qto-report',
      'GET    /api/n8n/health',
      'GET    /api/n8n/workflows',
      'GET    /api/n8n/workflow-triggers',
      'GET    /api/n8n/executions',
      'GET    /api/n8n/status/:executionId',
      'POST   /api/n8n/trigger/:webhookPath',
      'POST   /api/n8n/trigger',
    ],
  })
})

// ---------------------------------------------------------------------------
// Global Error Handler
// ---------------------------------------------------------------------------
app.use((err, _req, res, _next) => {
  console.error('[Jens] Unhandled error:', err)

  // Handle multer errors specifically
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        error: 'File too large',
        message: 'Maximum file size is 500 MB.',
      })
    }
    return res.status(400).json({
      error: 'Upload error',
      message: err.message,
    })
  }

  // Handle file filter errors
  if (err.message && err.message.startsWith('Unsupported file type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: err.message,
    })
  }

  res.status(500).json({
    error: 'Internal Server Error',
    message: process.env.NODE_ENV === 'production'
      ? 'An unexpected error occurred.'
      : err.message,
  })
})

// ---------------------------------------------------------------------------
// Start Server
// ---------------------------------------------------------------------------
app.listen(PORT, () => {
  console.log('='.repeat(60))
  console.log('  Jens Construction Platform - API Server')
  console.log(`  Running on http://localhost:${PORT}`)
  console.log(`  Gemini AI: ${geminiModel ? 'Enabled' : 'Disabled (no API key)'}`)
  console.log(`  Uploads:   ${UPLOADS_DIR}`)
  console.log(`  Converters: ${Object.keys(CONVERTER_PATHS).join(', ')}`)
  console.log('='.repeat(60))
})

export default app
