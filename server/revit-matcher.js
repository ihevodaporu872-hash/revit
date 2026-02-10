function norm(value) {
  return String(value || '').trim().toLowerCase()
}

function isSyntheticGlobalId(value) {
  return String(value || '').startsWith('REVIT_EID_')
}

function parseElementId(value) {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function extractIfcTypeIfcGuid(ifcElement) {
  if (!ifcElement?.properties || !Array.isArray(ifcElement.properties)) return null
  const hit = ifcElement.properties.find((p) => /type ifcguid/i.test(String(p?.name || '')))
  const val = String(hit?.value || '').trim()
  return val || null
}

function scoreCandidate(ifcElement, row) {
  let score = 0
  const reasons = []
  let matchedBy = 'mixed'

  const ifcGlobalId = String(ifcElement.globalId || '').trim()
  const ifcTagId = parseElementId(ifcElement.tag)
  const ifcTypeIfcGuid = extractIfcTypeIfcGuid(ifcElement)

  if (ifcGlobalId && row.global_id && ifcGlobalId === row.global_id) {
    score += 1.0
    reasons.push('globalId')
    matchedBy = 'globalId'
  }

  if (ifcTagId !== null && row.revit_element_id !== null && ifcTagId === row.revit_element_id) {
    score += 0.85
    reasons.push('elementId')
    if (matchedBy !== 'globalId') matchedBy = 'elementId'
  }

  if (ifcTypeIfcGuid && row.type_ifc_guid && ifcTypeIfcGuid === row.type_ifc_guid) {
    score += 0.55
    reasons.push('typeIfcGuid')
    if (matchedBy === 'mixed') matchedBy = 'typeIfcGuid'
  }

  const ifcType = norm(ifcElement.type)
  const rowCategory = norm(row.category)
  if (ifcType && rowCategory && (ifcType.includes(rowCategory) || rowCategory.includes(ifcType))) {
    score += 0.15
    reasons.push('category')
  }

  const ifcName = norm(ifcElement.name)
  const rowName = norm(row.element_name)
  if (ifcName && rowName && (ifcName.includes(rowName) || rowName.includes(ifcName))) {
    score += 0.1
    reasons.push('name')
  }

  return { score, reasons, matchedBy }
}

function dedupeRows(rows) {
  const seen = new Set()
  const list = []
  for (const row of rows) {
    const key = `${row.global_id || ''}|${row.revit_element_id || ''}|${row.revit_unique_id || ''}`
    if (seen.has(key)) continue
    seen.add(key)
    list.push(row)
  }
  return list
}

function getRowKey(row) {
  return `${row.global_id || ''}|${row.revit_element_id || ''}|${row.revit_unique_id || ''}`
}

function buildLookup(rows) {
  const byGlobalId = new Map()
  const byElementId = new Map()
  const byTypeIfcGuid = new Map()

  for (const row of rows) {
    if (row.global_id && !isSyntheticGlobalId(row.global_id)) {
      const list = byGlobalId.get(row.global_id) || []
      list.push(row)
      byGlobalId.set(row.global_id, list)
    }
    if (Number.isFinite(row.revit_element_id)) {
      const list = byElementId.get(row.revit_element_id) || []
      list.push(row)
      byElementId.set(row.revit_element_id, list)
    }
    if (row.type_ifc_guid) {
      const list = byTypeIfcGuid.get(row.type_ifc_guid) || []
      list.push(row)
      byTypeIfcGuid.set(row.type_ifc_guid, list)
    }
  }

  return { byGlobalId, byElementId, byTypeIfcGuid }
}

function getUnmatchedReason(ifcElement, candidates, topScore) {
  if (!ifcElement.globalId && !ifcElement.tag) return 'missing_globalid_and_tag'
  if (!ifcElement.globalId) return 'missing_globalid'
  if (!ifcElement.tag) return 'missing_tag'
  if (candidates.length === 0) return 'no_candidate'
  if (topScore < 0.65) return 'no_candidate'
  return 'ambiguous_or_conflict'
}

export function buildMatchReport({
  ifcElements,
  revitRows,
  matchThreshold = 0.85,
  ambiguousThreshold = 0.65,
}) {
  const normalizedIfc = Array.isArray(ifcElements) ? ifcElements : []
  const normalizedRows = Array.isArray(revitRows) ? revitRows : []
  const rows = dedupeRows(normalizedRows)
  const lookup = buildLookup(rows)

  const matchedRows = new Set()
  const matchedIfc = new Set()
  const matchMap = new Map()
  const diagnostics = []
  const ambiguous = []
  const missingInRevit = []
  const matchedByKey = {
    globalId: 0,
    elementId: 0,
    typeIfcGuid: 0,
    mixed: 0,
  }

  for (const ifcElement of normalizedIfc) {
    const candidateBucket = []
    const tagId = parseElementId(ifcElement.tag)
    const typeIfcGuid = extractIfcTypeIfcGuid(ifcElement)

    if (ifcElement.globalId && lookup.byGlobalId.has(ifcElement.globalId)) {
      candidateBucket.push(...lookup.byGlobalId.get(ifcElement.globalId))
    }
    if (tagId !== null && lookup.byElementId.has(tagId)) {
      candidateBucket.push(...lookup.byElementId.get(tagId))
    }
    if (typeIfcGuid && lookup.byTypeIfcGuid.has(typeIfcGuid)) {
      candidateBucket.push(...lookup.byTypeIfcGuid.get(typeIfcGuid))
    }

    const candidates = dedupeRows(candidateBucket)
      .map((row) => ({ row, ...scoreCandidate(ifcElement, row) }))
      .sort((a, b) => b.score - a.score)

    const top = candidates[0]
    const second = candidates[1]
    const topScore = top?.score ?? 0

    if (!top || topScore < ambiguousThreshold) {
      const reason = getUnmatchedReason(ifcElement, candidates, topScore)
      diagnostics.push({ expressID: ifcElement.expressID, reason, candidateCount: candidates.length, topScore })
      missingInRevit.push(ifcElement)
      continue
    }

    const hasTie = second && top.score === second.score
    if (hasTie || topScore < matchThreshold) {
      ambiguous.push({
        expressID: ifcElement.expressID,
        globalId: ifcElement.globalId || null,
        tag: ifcElement.tag || null,
        candidates: candidates.slice(0, 5).map((c) => ({
          globalId: c.row.global_id || null,
          revitElementId: c.row.revit_element_id ?? null,
          score: Number(c.score.toFixed(4)),
          reasons: c.reasons,
        })),
      })
      diagnostics.push({
        expressID: ifcElement.expressID,
        reason: hasTie ? 'duplicate_element_id' : 'ambiguous_score_band',
        candidateCount: candidates.length,
        topScore,
      })
      missingInRevit.push(ifcElement)
      continue
    }

    const candidate = candidates.find((c) => !matchedRows.has(getRowKey(c.row)))
    if (!candidate) {
      diagnostics.push({
        expressID: ifcElement.expressID,
        reason: 'duplicate_element_id',
        candidateCount: candidates.length,
        topScore,
      })
      missingInRevit.push(ifcElement)
      continue
    }

    const rowKey = getRowKey(candidate.row)
    matchedRows.add(rowKey)
    matchedIfc.add(ifcElement.expressID)
    matchMap.set(ifcElement.expressID, {
      ifcExpressId: ifcElement.expressID,
      revitRow: candidate.row,
      matchedBy: candidate.matchedBy,
      score: Number(candidate.score.toFixed(4)),
      reasons: candidate.reasons,
    })
    matchedByKey[candidate.matchedBy] += 1
  }

  const missingInIfc = rows.filter((row) => !matchedRows.has(getRowKey(row)))
  const byCategory = new Map()

  for (const el of normalizedIfc) {
    const key = el.type || 'Unknown'
    const item = byCategory.get(key) || { ifcCount: 0, revitCount: 0, matchedCount: 0 }
    item.ifcCount += 1
    if (matchedIfc.has(el.expressID)) item.matchedCount += 1
    byCategory.set(key, item)
  }
  for (const row of rows) {
    const key = row.category || 'Unknown'
    const item = byCategory.get(key) || { ifcCount: 0, revitCount: 0, matchedCount: 0 }
    item.revitCount += 1
    byCategory.set(key, item)
  }

  const totalIfcElements = normalizedIfc.length
  const totalMatched = matchedIfc.size
  const matchRate = totalIfcElements > 0 ? Number((totalMatched / totalIfcElements).toFixed(4)) : 0

  return {
    totalIfcElements,
    totalRevitRows: rows.length,
    totalMatched,
    matchRate,
    matchedByKey,
    ambiguous,
    missingInIfc,
    missingInRevit,
    diagnostics,
    byCategory: Array.from(byCategory.entries()).map(([category, stats]) => ({ category, ...stats })),
    matchMap,
  }
}
