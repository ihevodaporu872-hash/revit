// ============================================================================
// CWICR Vector Search Engine — Jens Platform
// ============================================================================
// Semantic search over construction items using:
// - Gemini text-embedding-004 (768 dims) for embeddings
// - Supabase pgvector for similarity search
// - Gemini Flash for query transformation + reranking
// ============================================================================

/**
 * Initialize the CWICR engine.
 * @param {object} deps — { supabase, genAI, geminiModel }
 * @returns {object} engine API
 */
export function createCWICREngine({ supabase, genAI, geminiModel }) {
  // Embedding model (768 dimensions)
  const EMBEDDING_MODEL = 'text-embedding-004'

  // Language config matching n8n workflow settings
  const LANGUAGE_CONFIG = {
    DE: { sym: '€', searchLang: 'German', collection: 'ddc_cwicr_de' },
    EN: { sym: 'CAD $', searchLang: 'English', collection: 'ddc_cwicr_en' },
    RU: { sym: '₽', searchLang: 'Russian', collection: 'ddc_cwicr_ru' },
    ES: { sym: '€', searchLang: 'Spanish', collection: 'ddc_cwicr_es' },
    FR: { sym: '€', searchLang: 'French', collection: 'ddc_cwicr_fr' },
    PT: { sym: 'R$', searchLang: 'Portuguese', collection: 'ddc_cwicr_pt' },
    ZH: { sym: '¥', searchLang: 'Chinese', collection: 'ddc_cwicr_zh' },
    AR: { sym: 'د.إ', searchLang: 'Arabic', collection: 'ddc_cwicr_ar' },
    HI: { sym: '₹', searchLang: 'Hindi', collection: 'ddc_cwicr_hi' },
  }

  /**
   * Generate embedding vector using Gemini text-embedding-004.
   * @param {string} text
   * @returns {Promise<number[]>} 768-dim vector
   */
  async function generateEmbedding(text) {
    if (!genAI) throw new Error('Gemini AI not initialized')
    const embeddingModel = genAI.getGenerativeModel({ model: EMBEDDING_MODEL })
    const result = await embeddingModel.embedContent(text)
    return result.embedding.values
  }

  /**
   * Transform user query into optimal search keywords using Gemini.
   * Exact prompt logic from n8n workflow.
   * @param {string} query — user input
   * @param {string} language — EN, DE, RU, etc.
   * @returns {Promise<string>} optimized search text
   */
  async function transformQuery(query, language = 'EN') {
    if (!geminiModel) return query

    const langConfig = LANGUAGE_CONFIG[language] || LANGUAGE_CONFIG.EN
    const prompt = `Transform user query into optimal SEARCH KEYWORDS for a construction cost database.

Language: ${langConfig.searchLang}

Rules:
1. Extract the core construction work/material from the query
2. Add relevant synonyms and related terms
3. Include technical construction terminology
4. Keep the keywords in ${langConfig.searchLang}
5. Return ONLY the optimized search keywords, nothing else
6. Do NOT add explanations or formatting

User query: "${query}"

Optimized search keywords:`

    try {
      const result = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 200 },
      })
      const transformed = result.response.text().trim()
      return transformed || query
    } catch (err) {
      console.warn('[CWICR] Query transformation failed, using original:', err.message)
      return query
    }
  }

  /**
   * Search CWICR items using pgvector cosine similarity.
   * @param {string} query
   * @param {string} language
   * @param {number} limit
   * @returns {Promise<Array>} matched items with similarity scores
   */
  async function searchCWICR(query, language = 'EN', limit = 10) {
    if (!supabase) throw new Error('Supabase not initialized')

    const embedding = await generateEmbedding(query)

    const { data, error } = await supabase.rpc('match_cwicr_items', {
      query_embedding: embedding,
      match_language: language,
      match_count: limit,
      match_threshold: 0.3,
    })

    if (error) {
      console.error('[CWICR] pgvector search error:', error)
      throw new Error(`Vector search failed: ${error.message}`)
    }

    return data || []
  }

  /**
   * Rerank search results using Gemini AI scoring (0-100).
   * Exact prompt logic from n8n workflow.
   * @param {string} query — original user query
   * @param {Array} candidates — search results
   * @param {string} unit — expected unit (optional)
   * @returns {Promise<Array>} reranked results with scores
   */
  async function rerankResults(query, candidates, unit = '') {
    if (!geminiModel || candidates.length === 0) return candidates

    const candidateList = candidates.map((c, i) =>
      `${i + 1}. [${c.rate_code}] ${c.rate_name} (unit: ${c.rate_unit || '?'})`
    ).join('\n')

    const prompt = `Score construction rate candidates (0-100) for matching the user's construction work query.

User query: "${query}"
${unit ? `Expected unit: ${unit}` : ''}

Candidates:
${candidateList}

Scoring criteria:
- 90-100: Perfect match — same work type, same scope, correct unit
- 70-89: Good match — similar work type, close scope
- 50-69: Partial match — related category but different specifics
- 30-49: Weak match — same general domain only
- 0-29: Poor match — different work type

Return ONLY a JSON array of objects with "index" (1-based) and "score" (0-100).
Example: [{"index":1,"score":95},{"index":2,"score":72}]`

    try {
      const result = await geminiModel.generateContent({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.05, maxOutputTokens: 500 },
      })

      const responseText = result.response.text().trim()
      const jsonMatch = responseText.match(/\[[\s\S]*\]/)
      if (!jsonMatch) return candidates

      const scores = JSON.parse(jsonMatch[0])
      const scoreMap = new Map(scores.map(s => [s.index - 1, s.score]))

      const reranked = candidates.map((c, i) => ({
        ...c,
        rerank_score: scoreMap.get(i) ?? 50,
      }))

      reranked.sort((a, b) => b.rerank_score - a.rerank_score)
      return reranked
    } catch (err) {
      console.warn('[CWICR] Reranking failed, returning original order:', err.message)
      return candidates
    }
  }

  /**
   * Calculate costs for a work item matched to a CWICR rate.
   * Exact cost calculation logic from n8n workflow.
   * @param {{ name: string, quantity: number, unit: string }} workItem
   * @param {object} matchedRate — CWICR item from search
   * @returns {object} cost breakdown
   */
  function calculateCosts(workItem, matchedRate) {
    const costSummary = matchedRate.cost_summary || {}
    const totalCostPosition = Number(costSummary.total_cost_position || 0)
    const rateUnit = matchedRate.rate_unit || ''
    const resources = matchedRate.resources || []

    // n8n logic: check if rate is per 100 units
    const unitDivisor = rateUnit.includes('100') ? 100 : 1
    const unitCost = unitDivisor > 0 ? totalCostPosition / unitDivisor : totalCostPosition
    const quantity = Number(workItem.quantity || 0)
    const totalCost = quantity * unitCost
    const scaleFactor = unitDivisor > 0 ? quantity / unitDivisor : quantity

    // Scale resources
    const scaledResources = resources.map(r => {
      const rQty = Number(r.quantity || 0)
      const rPrice = Number(r.pricePerUnit || r.price || 0)
      const scaledQty = rQty * scaleFactor
      const scaledCost = scaledQty * rPrice

      return {
        resource_code: r.resource_code || r.code || '',
        name: r.name || '',
        unit: r.unit || '',
        type: r.type || '',
        quantity: scaledQty,
        price_per_unit: rPrice,
        total_cost: scaledCost,
      }
    })

    // Aggregate by type
    const labor = scaledResources
      .filter(r => r.type === 'labor' || r.type === 'Labour')
      .reduce((sum, r) => sum + r.total_cost, 0)
    const materials = scaledResources
      .filter(r => r.type === 'material' || r.type === 'Materials')
      .reduce((sum, r) => sum + r.total_cost, 0)
    const machines = scaledResources
      .filter(r => r.type === 'machine' || r.type === 'Machines' || r.type === 'Equipment')
      .reduce((sum, r) => sum + r.total_cost, 0)

    // Labor hours
    const laborHours = scaledResources
      .filter(r => (r.type === 'labor' || r.type === 'Labour') && (r.unit === 'h' || r.unit === 'час' || r.unit === 'Std'))
      .reduce((sum, r) => sum + r.quantity, 0)

    return {
      work_name: workItem.name,
      quantity,
      unit: workItem.unit || matchedRate.rate_unit || '',
      rate_code: matchedRate.rate_code,
      rate_name: matchedRate.rate_name,
      rate_unit: matchedRate.rate_unit,
      unit_cost: unitCost,
      total_cost: totalCost,
      labor,
      materials,
      machines,
      labor_hours: laborHours,
      resources: scaledResources,
      similarity: matchedRate.similarity,
      rerank_score: matchedRate.rerank_score,
    }
  }

  /**
   * Full search pipeline: transform → search → rerank.
   * @param {string} query
   * @param {string} language
   * @param {number} limit
   * @returns {Promise<Array>}
   */
  async function fullSearch(query, language = 'EN', limit = 5) {
    const optimizedQuery = await transformQuery(query, language)
    console.log(`[CWICR] Original: "${query}" → Optimized: "${optimizedQuery}"`)

    const candidates = await searchCWICR(optimizedQuery, language, limit * 2)
    if (candidates.length === 0) return []

    const reranked = await rerankResults(query, candidates)
    return reranked.slice(0, limit)
  }

  /**
   * Get language config.
   * @param {string} lang
   * @returns {object}
   */
  function getLangConfig(lang = 'EN') {
    return LANGUAGE_CONFIG[lang] || LANGUAGE_CONFIG.EN
  }

  return {
    generateEmbedding,
    transformQuery,
    searchCWICR,
    rerankResults,
    calculateCosts,
    fullSearch,
    getLangConfig,
    LANGUAGE_CONFIG,
  }
}
