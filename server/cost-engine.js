// ============================================================================
// Cost Estimation Engine — Jens Platform
// ============================================================================
// Full pipeline replacing n8n workflows #1-#4:
// Text/Photo → AI parse → CWICR search → rerank → calculate → aggregate
// ============================================================================

/**
 * Initialize the Cost Engine.
 * @param {object} deps — { supabase, geminiModel, cwicr }
 * @returns {object} cost engine API
 */
export function createCostEngine({ supabase, geminiModel, cwicr }) {

  /**
   * Parse free text into structured work items using Gemini AI.
   * Exact prompt from n8n workflow #1.
   * @param {string} text — user description of works
   * @param {string} language — EN, DE, RU, etc.
   * @returns {Promise<Array<{name: string, quantity: number, unit: string, room: string}>>}
   */
  async function parseTextToWorks(text, language = 'EN') {
    if (!geminiModel) throw new Error('Gemini AI not initialized')

    const langConfig = cwicr.getLangConfig(language)
    const prompt = `Extract ALL construction works from the following text description.

Language: ${langConfig.searchLang}

Rules:
1. Extract each distinct construction work/activity
2. Estimate quantities if mentioned, otherwise use 1
3. Determine the correct unit for each work (m², m³, m, pcs, kg, etc.)
4. Identify the room/area if mentioned
5. Return a JSON array of objects

Required fields per item:
- "name": descriptive name of the work in ${langConfig.searchLang}
- "quantity": numeric quantity (default 1)
- "unit": measurement unit
- "room": room/area name or "" if not specified

Input text:
"${text}"

Return ONLY a valid JSON array. No explanations.`

    const result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 2000 },
    })

    const responseText = result.response.text().trim()
    const jsonMatch = responseText.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('Failed to parse works from text')

    return JSON.parse(jsonMatch[0])
  }

  /**
   * Parse photo into construction elements and works using Vision AI.
   * Exact prompt from n8n workflow #2.
   * @param {string} imageBase64 — base64-encoded image
   * @param {string} language
   * @returns {Promise<Array<{name: string, quantity: number, unit: string, room: string}>>}
   */
  async function parsePhotoToWorks(imageBase64, language = 'EN') {
    if (!geminiModel) throw new Error('Gemini AI not initialized')

    const langConfig = cwicr.getLangConfig(language)

    // Step 1: Identify construction elements in the photo
    const identifyPrompt = `You are an expert construction surveyor analyzing a photo of a construction site or building.

Identify ALL visible construction elements, materials, and work items in this image.

For each element found:
- Name the element/material
- Estimate approximate dimensions or quantity
- Note the condition (new, damaged, needs repair, etc.)

Language: ${langConfig.searchLang}

Return a JSON array of objects with:
- "element": name of the construction element
- "description": brief description of what you see
- "estimated_quantity": approximate quantity with unit
- "condition": condition assessment`

    const step1Result = await geminiModel.generateContent({
      contents: [{
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'image/jpeg', data: imageBase64 } },
          { text: identifyPrompt },
        ],
      }],
      generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
    })

    const elementsText = step1Result.response.text().trim()
    const elementsMatch = elementsText.match(/\[[\s\S]*\]/)
    const elements = elementsMatch ? JSON.parse(elementsMatch[0]) : []

    if (elements.length === 0) return []

    // Step 2: Decompose elements into concrete works
    const elementsList = elements.map((e, i) =>
      `${i + 1}. ${e.element}: ${e.description} (${e.estimated_quantity})`
    ).join('\n')

    const decomposePrompt = `Decompose each identified construction element into specific construction WORKS that need to be done.

Elements found:
${elementsList}

For each work:
- "name": specific construction work name in ${langConfig.searchLang}
- "quantity": estimated numeric quantity
- "unit": measurement unit (m², m³, m, pcs, kg, etc.)
- "room": area/location or ""

Return ONLY a valid JSON array.`

    const step2Result = await geminiModel.generateContent({
      contents: [{ role: 'user', parts: [{ text: decomposePrompt }] }],
      generationConfig: { temperature: 0.15, maxOutputTokens: 2000 },
    })

    const worksText = step2Result.response.text().trim()
    const worksMatch = worksText.match(/\[[\s\S]*\]/)
    if (!worksMatch) return []

    return JSON.parse(worksMatch[0])
  }

  /**
   * Estimate costs for an array of work items.
   * For each work: transformQuery → searchCWICR → rerank → calculateCosts.
   * @param {Array<{name: string, quantity: number, unit: string}>} works
   * @param {string} language
   * @returns {Promise<Array>} cost results per work item
   */
  async function estimateWorks(works, language = 'EN') {
    const results = []

    for (const work of works) {
      try {
        const matches = await cwicr.fullSearch(work.name, language, 3)

        if (matches.length === 0) {
          results.push({
            work_name: work.name,
            quantity: work.quantity || 1,
            unit: work.unit || '',
            room: work.room || '',
            matched: false,
            error: 'No matching CWICR rate found',
          })
          continue
        }

        const bestMatch = matches[0]
        const costResult = cwicr.calculateCosts(work, bestMatch)
        results.push({
          ...costResult,
          room: work.room || '',
          matched: true,
          alternatives: matches.slice(1, 3).map(m => ({
            rate_code: m.rate_code,
            rate_name: m.rate_name,
            similarity: m.similarity,
          })),
        })
      } catch (err) {
        console.error(`[Cost] Error estimating "${work.name}":`, err.message)
        results.push({
          work_name: work.name,
          quantity: work.quantity || 1,
          unit: work.unit || '',
          room: work.room || '',
          matched: false,
          error: err.message,
        })
      }
    }

    return results
  }

  /**
   * Aggregate estimation results into summary totals.
   * @param {Array} results — from estimateWorks()
   * @returns {object} aggregated summary
   */
  function aggregateResults(results) {
    const matched = results.filter(r => r.matched)
    const unmatched = results.filter(r => !r.matched)

    const totalCost = matched.reduce((sum, r) => sum + (r.total_cost || 0), 0)
    const laborTotal = matched.reduce((sum, r) => sum + (r.labor || 0), 0)
    const materialsTotal = matched.reduce((sum, r) => sum + (r.materials || 0), 0)
    const machinesTotal = matched.reduce((sum, r) => sum + (r.machines || 0), 0)
    const laborHoursTotal = matched.reduce((sum, r) => sum + (r.labor_hours || 0), 0)

    // Group by category (from rate_code prefix)
    const categories = {}
    for (const r of matched) {
      const cat = (r.rate_code || '').split('.').slice(0, 2).join('.') || 'Other'
      if (!categories[cat]) categories[cat] = { total: 0, count: 0 }
      categories[cat].total += r.total_cost || 0
      categories[cat].count += 1
    }

    return {
      total_cost: totalCost,
      labor_total: laborTotal,
      materials_total: materialsTotal,
      machines_total: machinesTotal,
      labor_hours: laborHoursTotal,
      matched_count: matched.length,
      unmatched_count: unmatched.length,
      total_items: results.length,
      categories: Object.entries(categories).map(([code, data]) => ({
        code,
        total: data.total,
        count: data.count,
        percentage: totalCost > 0 ? Math.round((data.total / totalCost) * 100) : 0,
      })),
    }
  }

  /**
   * Export results as CSV string.
   * @param {Array} results
   * @param {string} language
   * @returns {string} CSV content
   */
  function exportCSV(results, language = 'EN') {
    const langConfig = cwicr.getLangConfig(language)
    const header = 'No,Work Name,Rate Code,Rate Name,Qty,Unit,Unit Cost,Total Cost,Labor,Materials,Machines,Room'
    const rows = results.map((r, i) => {
      if (!r.matched) {
        return `${i + 1},"${(r.work_name || '').replace(/"/g, '""')}",,,${r.quantity || ''},${r.unit || ''},,,,,"${(r.room || '').replace(/"/g, '""')}"`
      }
      return [
        i + 1,
        `"${(r.work_name || '').replace(/"/g, '""')}"`,
        r.rate_code || '',
        `"${(r.rate_name || '').replace(/"/g, '""')}"`,
        r.quantity || '',
        r.unit || '',
        (r.unit_cost || 0).toFixed(2),
        (r.total_cost || 0).toFixed(2),
        (r.labor || 0).toFixed(2),
        (r.materials || 0).toFixed(2),
        (r.machines || 0).toFixed(2),
        `"${(r.room || '').replace(/"/g, '""')}"`,
      ].join(',')
    })

    return [header, ...rows].join('\n')
  }

  /**
   * Generate simple HTML report for PDF export.
   * @param {Array} results
   * @param {object} summary — from aggregateResults()
   * @param {string} language
   * @returns {string} HTML content
   */
  function exportHTML(results, summary, language = 'EN') {
    const langConfig = cwicr.getLangConfig(language)
    const sym = langConfig.sym

    const rows = results.map((r, i) => {
      if (!r.matched) {
        return `<tr class="unmatched"><td>${i + 1}</td><td>${r.work_name || ''}</td><td colspan="5" style="color:#999">No match found</td></tr>`
      }
      return `<tr>
        <td>${i + 1}</td>
        <td>${r.work_name || ''}</td>
        <td><code>${r.rate_code || ''}</code></td>
        <td>${r.quantity || ''} ${r.unit || ''}</td>
        <td style="text-align:right">${sym} ${(r.unit_cost || 0).toFixed(2)}</td>
        <td style="text-align:right"><b>${sym} ${(r.total_cost || 0).toFixed(2)}</b></td>
        <td>${r.room || ''}</td>
      </tr>`
    }).join('\n')

    return `<!DOCTYPE html>
<html><head>
<meta charset="utf-8">
<title>Jens Platform — Cost Estimate</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 2em; color: #1a1a1a; }
  h1 { color: #4338ca; }
  table { width: 100%; border-collapse: collapse; margin-top: 1em; }
  th, td { padding: 8px 12px; border: 1px solid #ddd; font-size: 13px; }
  th { background: #f5f5f5; text-align: left; }
  .summary { display: flex; gap: 2em; margin-top: 1.5em; }
  .summary-card { background: #f8f9fa; padding: 1em; border-radius: 8px; flex: 1; }
  .summary-card h3 { margin: 0 0 0.5em 0; font-size: 14px; color: #666; }
  .summary-card .value { font-size: 24px; font-weight: bold; }
  .unmatched td { color: #999; }
  code { background: #f0f0f0; padding: 2px 4px; border-radius: 3px; font-size: 12px; }
</style>
</head><body>
<h1>Jens Platform — Cost Estimate</h1>
<p>Language: ${language} | Items: ${summary.total_items} | Generated: ${new Date().toISOString().slice(0, 10)}</p>

<div class="summary">
  <div class="summary-card"><h3>Total Cost</h3><div class="value">${sym} ${summary.total_cost.toFixed(2)}</div></div>
  <div class="summary-card"><h3>Labor</h3><div class="value">${sym} ${summary.labor_total.toFixed(2)}</div></div>
  <div class="summary-card"><h3>Materials</h3><div class="value">${sym} ${summary.materials_total.toFixed(2)}</div></div>
  <div class="summary-card"><h3>Machines</h3><div class="value">${sym} ${summary.machines_total.toFixed(2)}</div></div>
</div>

<table>
<thead><tr><th>#</th><th>Work</th><th>Rate Code</th><th>Qty</th><th>Unit Cost</th><th>Total</th><th>Room</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><th colspan="5" style="text-align:right">Grand Total:</th><th style="text-align:right">${sym} ${summary.total_cost.toFixed(2)}</th><th></th></tr></tfoot>
</table>

<p style="margin-top:2em;color:#999;font-size:11px">Generated by Jens Platform — CWICR Cost Engine</p>
</body></html>`
  }

  /**
   * Save estimate to Supabase.
   * @param {object} params
   * @returns {Promise<object>} saved record
   */
  async function saveEstimate({ source, queryText, photoUrl, language, items, summary }) {
    if (!supabase) return null

    const langConfig = cwicr.getLangConfig(language)
    const { data, error } = await supabase
      .from('cost_estimates')
      .insert({
        source: source || 'web',
        query_text: queryText || null,
        photo_url: photoUrl || null,
        language,
        items,
        total_cost: summary.total_cost,
        currency: langConfig.sym,
        labor_total: summary.labor_total,
        materials_total: summary.materials_total,
        machines_total: summary.machines_total,
        labor_hours: summary.labor_hours,
      })
      .select()
      .single()

    if (error) {
      console.error('[Cost] Error saving estimate:', error)
      return null
    }

    return data
  }

  /**
   * Full text-to-estimate pipeline.
   * @param {string} text
   * @param {string} language
   * @returns {Promise<object>}
   */
  async function estimateFromText(text, language = 'EN') {
    console.log(`[Cost] Estimating from text (${language}): "${text.slice(0, 80)}..."`)

    const works = await parseTextToWorks(text, language)
    console.log(`[Cost] Parsed ${works.length} work items`)

    const results = await estimateWorks(works, language)
    const summary = aggregateResults(results)

    const saved = await saveEstimate({
      source: 'web',
      queryText: text,
      language,
      items: results,
      summary,
    })

    return { id: saved?.id, works, results, summary }
  }

  /**
   * Full photo-to-estimate pipeline.
   * @param {string} imageBase64
   * @param {string} language
   * @returns {Promise<object>}
   */
  async function estimateFromPhoto(imageBase64, language = 'EN') {
    console.log(`[Cost] Estimating from photo (${language})`)

    const works = await parsePhotoToWorks(imageBase64, language)
    console.log(`[Cost] Vision AI found ${works.length} work items`)

    const results = await estimateWorks(works, language)
    const summary = aggregateResults(results)

    const saved = await saveEstimate({
      source: 'photo',
      language,
      items: results,
      summary,
    })

    return { id: saved?.id, works, results, summary }
  }

  return {
    parseTextToWorks,
    parsePhotoToWorks,
    estimateWorks,
    aggregateResults,
    exportCSV,
    exportHTML,
    saveEstimate,
    estimateFromText,
    estimateFromPhoto,
  }
}
