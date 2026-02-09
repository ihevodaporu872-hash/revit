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
import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'
import { fileURLToPath } from 'url'
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

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
    const cmd = `"${exePath}" "${inputFile}" "${outputDir}"`

    console.log(`[Converter] Running: ${cmd}`)

    try {
      const { stdout, stderr } = await execAsync(cmd, {
        cwd: converter.dir,
        timeout: 300000, // 5 minutes
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
app.post('/api/ai/analyze', upload.single('file'), async (req, res) => {
  try {
    if (!requireGemini(res)) return

    const { prompt } = req.body

    if (!prompt) {
      return res.status(400).json({ error: 'Analysis prompt is required' })
    }

    let dataContext = ''

    if (req.file) {
      const ext = path.extname(req.file.originalname).toLowerCase()

      if (['.xlsx', '.xls'].includes(ext)) {
        try {
          const XLSX = (await import('xlsx')).default
          const workbook = XLSX.readFile(req.file.path)
          const sheetName = workbook.SheetNames[0]
          const sheet = workbook.Sheets[sheetName]
          const rows = XLSX.utils.sheet_to_json(sheet, { defval: '' })

          // Send first 100 rows as context (to fit within token limits)
          const sampleRows = rows.slice(0, 100)
          dataContext = `\n\nExcel Data (${rows.length} total rows, showing first ${sampleRows.length}):\nColumns: ${Object.keys(sampleRows[0] || {}).join(', ')}\n\nData:\n${JSON.stringify(sampleRows, null, 2)}`
        } catch (xlsErr) {
          dataContext = `\n\n[Failed to parse Excel file: ${xlsErr.message}]`
        }
      } else if (['.csv', '.txt', '.json', '.xml'].includes(ext)) {
        const content = await fs.readFile(req.file.path, 'utf-8')
        dataContext = `\n\nFile Content (${ext}):\n${content.substring(0, 50000)}`
      }
    }

    const systemPrompt = `You are Jens AI, an expert construction data analyst. You help construction professionals analyze BIM data, cost estimates, schedules, and project information.

When asked to generate code, produce clean, well-commented JavaScript/Python that can process the provided data. Always explain your analysis approach before showing code.

User request: ${prompt}${dataContext}`

    const result = await geminiModel.generateContent(systemPrompt)
    const responseText = result.response.text()

    res.json({
      analysis: responseText,
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
app.get('/api/health', (_req, res) => {
  const converterStatus = {}
  for (const [key, config] of Object.entries(CONVERTER_PATHS)) {
    const exePath = path.join(config.dir, config.exe)
    converterStatus[key] = {
      label: config.label,
      available: existsSync(exePath),
      path: config.dir,
    }
  }

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

  res.json({
    status: 'ok',
    platform: 'Jens Construction Platform',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: {
      nodeVersion: process.version,
      port: PORT,
      geminiAvailable: !!geminiModel,
    },
    converters: converterStatus,
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
