// ============================================================================
// Jens Platform — Revit→IFC Bridge (Open-Source)
// ============================================================================
// Wraps pyRevit CLI or RevitBatchProcessor to convert .rvt → .ifc
// using the Autodesk/revit-ifc open-source plugin.
//
// Backends:
//   pyrevit  — pyRevit CLI (pyrevit run export_ifc.py model.rvt --revit=2023)
//   rbp      — RevitBatchProcessor (BatchRvt.exe)
//   legacy   — fallback to RVT2IFCconverter.exe (handled in index.js)
// ============================================================================

import { spawn } from 'child_process'
import { existsSync } from 'fs'
import fs from 'fs/promises'
import path from 'path'
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

// ---------------------------------------------------------------------------
// Default configuration
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG = {
  backend: 'pyrevit',
  revitVersion: '2023',
  revitPath: '',
  pyrevitPath: '',
  rbpPath: '',
  defaultIfcVersion: 'IFC4',
  exportBaseQuantities: true,
  wallSplitting: false,
  timeout: 300000,
  maxConcurrent: 1,
}

let config = { ...DEFAULT_CONFIG }

// ---------------------------------------------------------------------------
// Load config from server/revit-ifc/config.json
// ---------------------------------------------------------------------------

const CONFIG_PATH = path.join(__dirname, 'revit-ifc', 'config.json')

async function loadConfig() {
  try {
    if (existsSync(CONFIG_PATH)) {
      const raw = await fs.readFile(CONFIG_PATH, 'utf-8')
      const parsed = JSON.parse(raw)
      config = { ...DEFAULT_CONFIG, ...parsed }
      console.log(`[revit-ifc] Config loaded: backend=${config.backend}, revit=${config.revitVersion}`)
    } else {
      console.log('[revit-ifc] No config.json found, using defaults')
    }
  } catch (err) {
    console.warn('[revit-ifc] Failed to load config.json:', err.message)
  }
}

// Load config on module import
loadConfig()

// ---------------------------------------------------------------------------
// Backend availability checks
// ---------------------------------------------------------------------------

function resolvePyRevitPath() {
  if (config.pyrevitPath && existsSync(config.pyrevitPath)) {
    return config.pyrevitPath
  }
  // Common install locations
  const candidates = [
    'pyrevit',  // on PATH
    path.join(process.env.APPDATA || '', 'pyRevit-Master', 'bin', 'pyrevit.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'pyRevit-Master', 'bin', 'pyrevit.exe'),
  ]
  for (const p of candidates) {
    if (p === 'pyrevit') return p  // assume on PATH, will fail at spawn if not
    if (existsSync(p)) return p
  }
  return ''
}

function resolveRbpPath() {
  if (config.rbpPath && existsSync(config.rbpPath)) {
    return config.rbpPath
  }
  const candidate = path.join(
    process.env.LOCALAPPDATA || '',
    'RevitBatchProcessor',
    'BatchRvt.exe'
  )
  if (existsSync(candidate)) return candidate
  return ''
}

function checkBackendAvailable() {
  if (config.backend === 'pyrevit') {
    const pyrevit = resolvePyRevitPath()
    return !!pyrevit
  }
  if (config.backend === 'rbp') {
    const rbp = resolveRbpPath()
    return !!rbp
  }
  return false
}

// ---------------------------------------------------------------------------
// Core: convert RVT → IFC
// ---------------------------------------------------------------------------

export async function convertRvtToIfc(inputRvt, outputDir, options = {}) {
  const baseName = path.basename(inputRvt, path.extname(inputRvt))
  const outputIfc = path.join(outputDir, `${baseName}.ifc`)

  // Write params.json next to input file for the Python script to read
  const params = {
    ifcVersion: options.ifcVersion || config.defaultIfcVersion,
    exportBaseQuantities: config.exportBaseQuantities,
    wallSplitting: config.wallSplitting,
    outputDir: outputDir,
    outputName: `${baseName}.ifc`,
  }

  const paramsPath = path.join(path.dirname(inputRvt), 'params.json')
  await fs.writeFile(paramsPath, JSON.stringify(params, null, 2))

  try {
    if (config.backend === 'pyrevit') {
      return await runPyRevit(inputRvt, outputIfc)
    } else if (config.backend === 'rbp') {
      return await runBatchRvt(inputRvt, outputIfc)
    }
    throw new Error(`Unknown revit-ifc backend: ${config.backend}`)
  } finally {
    fs.unlink(paramsPath).catch(() => {})
  }
}

// ---------------------------------------------------------------------------
// pyRevit CLI runner
// ---------------------------------------------------------------------------

function runPyRevit(inputRvt, expectedOutput) {
  return new Promise((resolve, reject) => {
    const scriptPath = path.join(__dirname, 'revit-ifc', 'export_ifc.py')
    const pyrevitExe = resolvePyRevitPath()

    if (!pyrevitExe) {
      return reject(new Error('pyRevit CLI not found. Install pyRevit or set pyrevitPath in config.json'))
    }

    const args = ['run', scriptPath, inputRvt, `--revit=${config.revitVersion}`]

    console.log(`[revit-ifc] Running: ${pyrevitExe} ${args.join(' ')}`)

    const proc = spawn(pyrevitExe, args, {
      timeout: config.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })

    proc.on('close', (code) => {
      console.log(`[revit-ifc] pyRevit exited with code ${code}`)
      if (stdout) console.log(`[revit-ifc] stdout: ${stdout.slice(0, 500)}`)
      if (stderr) console.log(`[revit-ifc] stderr: ${stderr.slice(0, 500)}`)

      if (code === 0 && existsSync(expectedOutput)) {
        resolve({
          success: true,
          outputPath: expectedOutput,
          backend: 'pyrevit',
          stdout,
          stderr,
        })
      } else if (stdout.includes('EXPORT_RESULT:SUCCESS') && existsSync(expectedOutput)) {
        resolve({
          success: true,
          outputPath: expectedOutput,
          backend: 'pyrevit',
          stdout,
          stderr,
        })
      } else {
        reject(new Error(
          `pyRevit exit code ${code}. ` +
          `stdout: ${stdout.slice(0, 500)}. ` +
          `stderr: ${stderr.slice(0, 500)}`
        ))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn pyRevit: ${err.message}`))
    })
  })
}

// ---------------------------------------------------------------------------
// RevitBatchProcessor runner
// ---------------------------------------------------------------------------

function runBatchRvt(inputRvt, expectedOutput) {
  return new Promise((resolve, reject) => {
    const rbpExe = resolveRbpPath()

    if (!rbpExe) {
      return reject(new Error('RevitBatchProcessor not found. Install RBP or set rbpPath in config.json'))
    }

    // RBP expects a settings file; create a temporary one
    const scriptPath = path.join(__dirname, 'revit-ifc', 'rbp_export_ifc.py')
    const args = [
      '--revit_version', config.revitVersion,
      '--task_script', scriptPath,
      '--file_list', inputRvt,
    ]

    console.log(`[revit-ifc] Running: ${rbpExe} ${args.join(' ')}`)

    const proc = spawn(rbpExe, args, {
      timeout: config.timeout,
      stdio: ['pipe', 'pipe', 'pipe'],
    })

    let stdout = ''
    let stderr = ''

    proc.stdout.on('data', (d) => { stdout += d.toString() })
    proc.stderr.on('data', (d) => { stderr += d.toString() })

    proc.on('close', (code) => {
      console.log(`[revit-ifc] BatchRvt exited with code ${code}`)

      if (code === 0 && existsSync(expectedOutput)) {
        resolve({
          success: true,
          outputPath: expectedOutput,
          backend: 'rbp',
          stdout,
          stderr,
        })
      } else if (stdout.includes('EXPORT_RESULT:SUCCESS') && existsSync(expectedOutput)) {
        resolve({
          success: true,
          outputPath: expectedOutput,
          backend: 'rbp',
          stdout,
          stderr,
        })
      } else {
        reject(new Error(
          `BatchRvt exit code ${code}. ` +
          `stdout: ${stdout.slice(0, 500)}. ` +
          `stderr: ${stderr.slice(0, 500)}`
        ))
      }
    })

    proc.on('error', (err) => {
      reject(new Error(`Failed to spawn BatchRvt: ${err.message}`))
    })
  })
}

// ---------------------------------------------------------------------------
// Status / info
// ---------------------------------------------------------------------------

export function getRevitIfcStatus() {
  return {
    backend: config.backend,
    available: checkBackendAvailable(),
    revitVersion: config.revitVersion,
    ifcVersion: config.defaultIfcVersion,
    label: 'Revit\u2192IFC (Open Source)',
  }
}

export async function reloadConfig() {
  await loadConfig()
  return config
}
