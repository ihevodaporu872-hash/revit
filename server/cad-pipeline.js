// ============================================================================
// CAD/BIM Pipeline — Jens Platform
// ============================================================================
// Native replacement for n8n workflows #3,#4,#5,#6,#9:
// - Batch conversion (RVT → IFC/XLSX/DAE)
// - BIM validation against rules
// - AI classification (Omniclass/Uniclass/MasterFormat)
// - QTO report generation
// ============================================================================

import { exec } from 'child_process'
import { promisify } from 'util'
import path from 'path'
import fs from 'fs/promises'
import { existsSync } from 'fs'

const execAsync = promisify(exec)

/**
 * Initialize CAD Pipeline.
 * @param {object} deps — { geminiModel, uploadsDir, converterPaths }
 * @returns {object} pipeline API
 */
export function createCADPipeline({ geminiModel, uploadsDir, converterPaths }) {

  /**
   * Batch convert all files in a folder matching an extension.
   * Uses existing RvtExporter.exe via child_process.
   * @param {string} folder — input folder path
   * @param {string} extension — e.g. 'rvt', 'ifc'
   * @param {{ outputFormat: string, outputDir?: string }} options
   * @returns {Promise<Array<{file: string, status: string, output?: string, error?: string}>>}
   */
  async function batchConvert(folder, extension = 'rvt', options = {}) {
    const { outputFormat = 'xlsx', outputDir } = options
    const results = []

    // Find all matching files recursively
    const files = await findFiles(folder, `.${extension}`)
    console.log(`[CAD] Found ${files.length} .${extension} files in ${folder}`)

    const outDir = outputDir || path.join(uploadsDir, `batch-${Date.now()}`)
    await fs.mkdir(outDir, { recursive: true })

    for (const filePath of files) {
      const fileName = path.basename(filePath)
      console.log(`[CAD] Converting: ${fileName}`)

      try {
        const outputPath = path.join(outDir, fileName.replace(`.${extension}`, `.${outputFormat}`))

        if (extension === 'rvt' && converterPaths?.RvtExporter) {
          const cmd = `"${converterPaths.RvtExporter}" "${filePath}" "${outputPath}" ${outputFormat}`
          const { stdout, stderr } = await execAsync(cmd, { timeout: 300000 })
          results.push({
            file: fileName,
            status: 'completed',
            output: outputPath,
            stdout: stdout?.slice(0, 200),
          })
        } else {
          results.push({
            file: fileName,
            status: 'skipped',
            error: `No converter available for .${extension}`,
          })
        }
      } catch (err) {
        results.push({
          file: fileName,
          status: 'failed',
          error: err.message?.slice(0, 200),
        })
      }
    }

    return { outputDir: outDir, results, total: files.length, completed: results.filter(r => r.status === 'completed').length }
  }

  /**
   * Recursively find files by extension.
   */
  async function findFiles(dir, ext) {
    const entries = await fs.readdir(dir, { withFileTypes: true })
    const files = []
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        files.push(...await findFiles(fullPath, ext))
      } else if (entry.name.toLowerCase().endsWith(ext.toLowerCase())) {
        files.push(fullPath)
      }
    }
    return files
  }

  /**
   * Validate BIM data from Excel export against rules.
   * Replaces n8n workflow #4.
   * @param {Array<object>} elements — parsed Excel rows
   * @param {Array<object>} rules — validation rules [{field, operator, value, severity, message}]
   * @returns {object} validation report
   */
  function validateBIM(elements, rules = []) {
    const issues = []
    const defaultRules = rules.length > 0 ? rules : getDefaultValidationRules()

    for (const element of elements) {
      for (const rule of defaultRules) {
        const value = element[rule.field]
        let violated = false

        switch (rule.operator) {
          case 'empty':
            violated = !value || String(value).trim() === ''
            break
          case 'not_empty':
            violated = !!value && String(value).trim() !== ''
            break
          case 'equals':
            violated = String(value) === String(rule.value)
            break
          case 'not_equals':
            violated = String(value) !== String(rule.value)
            break
          case 'contains':
            violated = String(value || '').toLowerCase().includes(String(rule.value).toLowerCase())
            break
          case 'gt':
            violated = Number(value) > Number(rule.value)
            break
          case 'lt':
            violated = Number(value) < Number(rule.value)
            break
          case 'between':
            const [min, max] = (rule.value || '').split(',').map(Number)
            violated = Number(value) < min || Number(value) > max
            break
        }

        if (violated) {
          issues.push({
            element_id: element.GlobalId || element.Id || element.id || '',
            element_type: element.Category || element.Type || '',
            element_name: element.Name || element.TypeName || '',
            rule_name: rule.name || rule.field,
            severity: rule.severity || 'warning',
            message: rule.message || `Rule "${rule.name}" violated for field "${rule.field}"`,
            field: rule.field,
            actual_value: value,
            expected: rule.value,
          })
        }
      }
    }

    const errors = issues.filter(i => i.severity === 'error').length
    const warnings = issues.filter(i => i.severity === 'warning').length
    const info = issues.filter(i => i.severity === 'info').length

    return {
      total_elements: elements.length,
      total_issues: issues.length,
      errors,
      warnings,
      info,
      pass_rate: elements.length > 0
        ? Math.round(((elements.length - errors) / elements.length) * 100)
        : 100,
      issues,
    }
  }

  /**
   * Default BIM validation rules.
   */
  function getDefaultValidationRules() {
    return [
      { field: 'Category', operator: 'empty', severity: 'error', name: 'Missing Category', message: 'Element has no category assigned' },
      { field: 'TypeName', operator: 'empty', severity: 'warning', name: 'Missing Type Name', message: 'Element has no type name' },
      { field: 'Level', operator: 'empty', severity: 'warning', name: 'Missing Level', message: 'Element is not assigned to a level' },
      { field: 'Material', operator: 'empty', severity: 'info', name: 'Missing Material', message: 'Element has no material specified' },
      { field: 'Volume', operator: 'lt', value: '0', severity: 'error', name: 'Negative Volume', message: 'Element has negative volume' },
      { field: 'Area', operator: 'lt', value: '0', severity: 'error', name: 'Negative Area', message: 'Element has negative area' },
    ]
  }

  /**
   * Classify BIM elements using Gemini AI.
   * Replaces n8n workflow #5.
   * @param {Array<object>} elements — Excel data rows
   * @param {string} system — 'omniclass' | 'uniclass' | 'masterformat'
   * @param {string} language — EN, DE, RU, etc.
   * @returns {Promise<Array>} classified elements
   */
  async function classifyElements(elements, system = 'omniclass', language = 'EN') {
    if (!geminiModel) throw new Error('Gemini AI not initialized')

    // Group by Category + TypeName to reduce API calls
    const groups = {}
    for (const el of elements) {
      const key = `${el.Category || ''}|||${el.TypeName || el.Type || ''}`
      if (!groups[key]) groups[key] = { category: el.Category || '', typeName: el.TypeName || el.Type || '', elements: [] }
      groups[key].elements.push(el)
    }

    const groupList = Object.values(groups)
    console.log(`[CAD] Classifying ${elements.length} elements in ${groupList.length} groups (${system})`)

    const classified = []

    // Process in batches of 10 groups
    for (let i = 0; i < groupList.length; i += 10) {
      const batch = groupList.slice(i, i + 10)
      const batchDesc = batch.map((g, idx) =>
        `${idx + 1}. Category: "${g.category}", Type: "${g.typeName}"`
      ).join('\n')

      const prompt = `Classify these BIM/construction elements according to the ${system.toUpperCase()} classification system.

Elements:
${batchDesc}

For each element, provide:
- "index": 1-based index matching the input
- "code": ${system} classification code
- "name": classification name
- "confidence": confidence score 0-100
- "is_building_element": true if it's a physical building element, false if it's a drawing/annotation element

Return ONLY a JSON array of objects.`

      try {
        const result = await geminiModel.generateContent({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.1, maxOutputTokens: 2000 },
        })

        const text = result.response.text().trim()
        const jsonMatch = text.match(/\[[\s\S]*\]/)
        if (jsonMatch) {
          const classifications = JSON.parse(jsonMatch[0])
          for (const cls of classifications) {
            const group = batch[cls.index - 1]
            if (!group) continue

            for (const el of group.elements) {
              classified.push({
                ...el,
                classification_system: system,
                classification_code: cls.code,
                classification_name: cls.name,
                classification_confidence: cls.confidence,
                is_building_element: cls.is_building_element,
              })
            }
          }
        }
      } catch (err) {
        console.error(`[CAD] Classification batch ${i} failed:`, err.message)
        // Add unclassified
        for (const group of batch) {
          for (const el of group.elements) {
            classified.push({ ...el, classification_system: system, classification_code: '', classification_name: 'Unclassified', classification_confidence: 0 })
          }
        }
      }
    }

    return classified
  }

  /**
   * Generate QTO (Quantity Take-Off) HTML report.
   * Replaces n8n workflow #9.
   * @param {Array<object>} elements — classified/quantified elements
   * @param {string} groupBy — 'category' | 'level' | 'type' | 'classification'
   * @returns {string} HTML report
   */
  function generateQTOReport(elements, groupBy = 'category') {
    // Group elements
    const groups = {}
    for (const el of elements) {
      const key = el[groupBy] || el.Category || 'Ungrouped'
      if (!groups[key]) groups[key] = []
      groups[key].push(el)
    }

    // Aggregate quantities per group
    const sections = Object.entries(groups).map(([name, els]) => {
      const totalVolume = els.reduce((s, e) => s + (Number(e.Volume) || 0), 0)
      const totalArea = els.reduce((s, e) => s + (Number(e.Area) || 0), 0)
      const totalLength = els.reduce((s, e) => s + (Number(e.Length) || 0), 0)
      const totalCount = els.length

      return { name, elements: els, totalVolume, totalArea, totalLength, totalCount }
    })

    sections.sort((a, b) => b.totalCount - a.totalCount)

    // Build HTML
    const sectionRows = sections.map(sec => {
      const elRows = sec.elements.slice(0, 50).map(el =>
        `<tr>
          <td>${el.GlobalId || el.Id || ''}</td>
          <td>${el.TypeName || el.Type || ''}</td>
          <td>${el.Level || ''}</td>
          <td style="text-align:right">${el.Volume ? Number(el.Volume).toFixed(3) : ''}</td>
          <td style="text-align:right">${el.Area ? Number(el.Area).toFixed(2) : ''}</td>
          <td style="text-align:right">${el.Length ? Number(el.Length).toFixed(2) : ''}</td>
          <td>${el.Material || ''}</td>
        </tr>`
      ).join('\n')

      return `<h3>${sec.name} (${sec.totalCount} elements)</h3>
      <div class="summary-row">
        <span>Volume: ${sec.totalVolume.toFixed(3)} m³</span>
        <span>Area: ${sec.totalArea.toFixed(2)} m²</span>
        <span>Length: ${sec.totalLength.toFixed(2)} m</span>
      </div>
      <table>
        <thead><tr><th>ID</th><th>Type</th><th>Level</th><th>Volume</th><th>Area</th><th>Length</th><th>Material</th></tr></thead>
        <tbody>${elRows}</tbody>
      </table>`
    }).join('\n')

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Jens Platform — QTO Report</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 2em; color: #1a1a1a; }
  h1 { color: #4338ca; }
  h3 { margin-top: 1.5em; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.3em; }
  table { width: 100%; border-collapse: collapse; margin: 0.5em 0 1.5em; font-size: 12px; }
  th, td { padding: 6px 10px; border: 1px solid #e5e7eb; }
  th { background: #f9fafb; text-align: left; font-weight: 600; }
  .summary-row { display: flex; gap: 2em; margin: 0.5em 0; color: #6b7280; font-size: 13px; }
  .totals { background: #f0f4ff; padding: 1em; border-radius: 8px; margin-top: 1em; }
</style>
</head><body>
<h1>Quantity Take-Off Report</h1>
<p>Grouped by: ${groupBy} | Total elements: ${elements.length} | Groups: ${sections.length} | Generated: ${new Date().toISOString().slice(0, 10)}</p>

<div class="totals">
  <b>Grand Totals:</b>
  Volume: ${sections.reduce((s, sec) => s + sec.totalVolume, 0).toFixed(3)} m³ |
  Area: ${sections.reduce((s, sec) => s + sec.totalArea, 0).toFixed(2)} m² |
  Length: ${sections.reduce((s, sec) => s + sec.totalLength, 0).toFixed(2)} m |
  Elements: ${elements.length}
</div>

${sectionRows}

<p style="margin-top:2em;color:#999;font-size:11px">Generated by Jens Platform — CAD Pipeline</p>
</body></html>`
  }

  return {
    batchConvert,
    validateBIM,
    classifyElements,
    generateQTOReport,
    getDefaultValidationRules,
  }
}
