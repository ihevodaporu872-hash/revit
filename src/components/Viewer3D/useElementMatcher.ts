import { useState, useCallback, useRef } from 'react'
import type { IFCElementInfo, RevitProperties, MatchDiagnostic } from './ifc/types'

type MatchedBy = 'elementId' | 'globalId' | 'typeIfcGuid' | 'mixed'

interface MatchCandidate {
  globalId: string | null
  revitElementId: number | null
  score: number
  reasons: string[]
}

interface MatchMapEntry {
  ifcExpressId: number
  revitProps: RevitProperties
  matchedBy: MatchedBy
  score: number
  reasons: string[]
}

interface CategoryCoverage {
  ifcCount: number
  revitCount: number
  matchedCount: number
}

export interface MatchResult {
  totalIfcElements: number
  totalExcelRows: number
  matchedByElementId: number
  matchedByGlobalId: number
  matchedByTypeIfcGuid: number
  matchedMixed: number
  totalMatched: number
  matchRate: number
  ambiguous: Array<{ expressID: number; globalId?: string; tag?: string; candidates: MatchCandidate[] }>
  diagnostics: MatchDiagnostic[]
  missingInIfc: RevitProperties[]     // in Excel but not in IFC
  missingInExcel: IFCElementInfo[]    // in IFC but not in Excel
  matchMap: Map<number, MatchMapEntry>
  byCategory: Map<string, CategoryCoverage>
  coverageSummary: {
    matched: number
    ambiguous: number
    unmatched: number
  }
}

function normalize(value: unknown): string {
  return String(value || '').trim().toLowerCase()
}

function parseElementId(value: unknown): number | null {
  const parsed = Number.parseInt(String(value || ''), 10)
  return Number.isFinite(parsed) ? parsed : null
}

function isSyntheticGlobalId(value: unknown): boolean {
  return String(value || '').startsWith('REVIT_EID_')
}

function extractIfcTypeIfcGuid(ifcElement: IFCElementInfo): string | null {
  if (!Array.isArray(ifcElement.properties)) return null
  const match = ifcElement.properties.find((p) => /type ifcguid/i.test(String(p?.name || '')))
  const val = String(match?.value || '').trim()
  return val || null
}

function rowKey(row: RevitProperties): string {
  return `${row.globalId || ''}|${row.revitElementId || ''}|${row.revitUniqueId || ''}`
}

function dedupeRows(rows: RevitProperties[]): RevitProperties[] {
  const seen = new Set<string>()
  const out: RevitProperties[] = []
  for (const row of rows) {
    const key = rowKey(row)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(row)
  }
  return out
}

function scoreCandidate(ifcElement: IFCElementInfo, row: RevitProperties): {
  score: number
  reasons: string[]
  matchedBy: MatchedBy
} {
  let score = 0
  const reasons: string[] = []
  let matchedBy: MatchedBy = 'mixed'

  const ifcGlobalId = String(ifcElement.globalId || '').trim()
  const ifcTagId = parseElementId(ifcElement.tag)
  const ifcTypeIfcGuid = extractIfcTypeIfcGuid(ifcElement)

  if (ifcGlobalId && row.globalId && ifcGlobalId === row.globalId) {
    score += 1.0
    reasons.push('globalId')
    matchedBy = 'globalId'
  }

  if (ifcTagId !== null && row.revitElementId !== undefined && row.revitElementId !== null && ifcTagId === row.revitElementId) {
    score += 0.85
    reasons.push('elementId')
    if (matchedBy !== 'globalId') matchedBy = 'elementId'
  }

  if (ifcTypeIfcGuid && row.typeIfcGuid && ifcTypeIfcGuid === row.typeIfcGuid) {
    score += 0.55
    reasons.push('typeIfcGuid')
    if (matchedBy === 'mixed') matchedBy = 'typeIfcGuid'
  }

  const ifcType = normalize(ifcElement.type)
  const category = normalize(row.category)
  if (ifcType && category && (ifcType.includes(category) || category.includes(ifcType))) {
    score += 0.15
    reasons.push('category')
  }

  const ifcName = normalize(ifcElement.name)
  const rowName = normalize(row.elementName)
  if (ifcName && rowName && (ifcName.includes(rowName) || rowName.includes(ifcName))) {
    score += 0.1
    reasons.push('name')
  }

  return { score, reasons, matchedBy }
}

function unresolvedReason(ifcElement: IFCElementInfo, candidates: RevitProperties[], topScore: number): string {
  if (!ifcElement.globalId && !ifcElement.tag) return 'missing_globalid_and_tag'
  if (!ifcElement.globalId) return 'missing_globalid'
  if (!ifcElement.tag) return 'missing_tag'
  if (candidates.length === 0) return 'no_candidate'
  if (topScore < 0.65) return 'no_candidate'
  return 'ambiguous_or_conflict'
}

export function useElementMatcher() {
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [isMatching, setIsMatching] = useState(false)
  const matchMapRef = useRef<Map<number, MatchMapEntry>>(new Map())

  const runMatching = useCallback((
    ifcElements: IFCElementInfo[],
    revitRows: RevitProperties[],
  ): MatchResult => {
    setIsMatching(true)

    try {
      const rows = dedupeRows(revitRows)
      const byGlobalId = new Map<string, RevitProperties[]>()
      const byElementId = new Map<number, RevitProperties[]>()
      const byTypeIfcGuid = new Map<string, RevitProperties[]>()

      for (const row of rows) {
        if (row.globalId && !isSyntheticGlobalId(row.globalId)) {
          const list = byGlobalId.get(row.globalId) || []
          list.push(row)
          byGlobalId.set(row.globalId, list)
        }
        if (Number.isFinite(row.revitElementId)) {
          const list = byElementId.get(row.revitElementId!) || []
          list.push(row)
          byElementId.set(row.revitElementId!, list)
        }
        if (row.typeIfcGuid) {
          const list = byTypeIfcGuid.get(row.typeIfcGuid) || []
          list.push(row)
          byTypeIfcGuid.set(row.typeIfcGuid, list)
        }
      }

      const matchedRowKeys = new Set<string>()
      const matchedIfcExpressIds = new Set<number>()
      const matchMap = new Map<number, MatchMapEntry>()
      const ambiguous: MatchResult['ambiguous'] = []
      const diagnostics: MatchDiagnostic[] = []
      const missingInExcel: IFCElementInfo[] = []

      let matchedByElementId = 0
      let matchedByGlobalId = 0
      let matchedByTypeIfcGuid = 0
      let matchedMixed = 0

      for (const ifc of ifcElements) {
        const bucket: RevitProperties[] = []
        const tag = parseElementId(ifc.tag)
        const typeIfcGuid = extractIfcTypeIfcGuid(ifc)

        if (ifc.globalId && byGlobalId.has(ifc.globalId)) bucket.push(...(byGlobalId.get(ifc.globalId) || []))
        if (tag !== null && byElementId.has(tag)) bucket.push(...(byElementId.get(tag) || []))
        if (typeIfcGuid && byTypeIfcGuid.has(typeIfcGuid)) bucket.push(...(byTypeIfcGuid.get(typeIfcGuid) || []))

        const candidates = dedupeRows(bucket)
          .map((row) => ({ row, ...scoreCandidate(ifc, row) }))
          .sort((a, b) => b.score - a.score)

        const top = candidates[0]
        const second = candidates[1]
        const topScore = top?.score ?? 0

        if (!top || topScore < 0.65) {
          diagnostics.push({
            expressID: ifc.expressID,
            reason: unresolvedReason(ifc, bucket, topScore),
            candidateCount: candidates.length,
            topScore,
          })
          missingInExcel.push(ifc)
          continue
        }

        const hasTie = !!second && second.score === top.score
        if (hasTie || topScore < 0.85) {
          ambiguous.push({
            expressID: ifc.expressID,
            globalId: ifc.globalId,
            tag: ifc.tag,
            candidates: candidates.slice(0, 5).map((c) => ({
              globalId: c.row.globalId || null,
              revitElementId: c.row.revitElementId ?? null,
              score: Number(c.score.toFixed(4)),
              reasons: c.reasons,
            })),
          })
          diagnostics.push({
            expressID: ifc.expressID,
            reason: hasTie ? 'duplicate_element_id' : 'ambiguous_score_band',
            candidateCount: candidates.length,
            topScore: Number(topScore.toFixed(4)),
          })
          missingInExcel.push(ifc)
          continue
        }

        const selected = candidates.find((c) => !matchedRowKeys.has(rowKey(c.row)))
        if (!selected) {
          diagnostics.push({
            expressID: ifc.expressID,
            reason: 'duplicate_element_id',
            candidateCount: candidates.length,
            topScore: Number(topScore.toFixed(4)),
          })
          missingInExcel.push(ifc)
          continue
        }

        const k = rowKey(selected.row)
        matchedRowKeys.add(k)
        matchedIfcExpressIds.add(ifc.expressID)

        const enrichedRow: RevitProperties = {
          ...selected.row,
          matchConfidence: Number(selected.score.toFixed(4)),
          matchedBy: selected.matchedBy,
        }

        matchMap.set(ifc.expressID, {
          ifcExpressId: ifc.expressID,
          revitProps: enrichedRow,
          matchedBy: selected.matchedBy,
          score: Number(selected.score.toFixed(4)),
          reasons: selected.reasons,
        })

        if (selected.matchedBy === 'elementId') matchedByElementId += 1
        else if (selected.matchedBy === 'globalId') matchedByGlobalId += 1
        else if (selected.matchedBy === 'typeIfcGuid') matchedByTypeIfcGuid += 1
        else matchedMixed += 1
      }

      const missingInIfc = rows.filter((row) => !matchedRowKeys.has(rowKey(row)))

      const byCategory = new Map<string, CategoryCoverage>()
      for (const el of ifcElements) {
        const cat = el.type || 'Unknown'
        const entry = byCategory.get(cat) || { ifcCount: 0, revitCount: 0, matchedCount: 0 }
        entry.ifcCount += 1
        if (matchedIfcExpressIds.has(el.expressID)) entry.matchedCount += 1
        byCategory.set(cat, entry)
      }
      for (const row of rows) {
        const cat = row.category || 'Unknown'
        const entry = byCategory.get(cat) || { ifcCount: 0, revitCount: 0, matchedCount: 0 }
        entry.revitCount += 1
        byCategory.set(cat, entry)
      }

      const totalMatched = matchedIfcExpressIds.size
      const result: MatchResult = {
        totalIfcElements: ifcElements.length,
        totalExcelRows: rows.length,
        matchedByElementId,
        matchedByGlobalId,
        matchedByTypeIfcGuid,
        matchedMixed,
        totalMatched,
        matchRate: ifcElements.length > 0 ? Number((totalMatched / ifcElements.length).toFixed(4)) : 0,
        ambiguous,
        diagnostics,
        missingInIfc,
        missingInExcel,
        matchMap,
        byCategory,
        coverageSummary: {
          matched: totalMatched,
          ambiguous: ambiguous.length,
          unmatched: ifcElements.length - totalMatched - ambiguous.length,
        },
      }

      matchMapRef.current = matchMap
      setMatchResult(result)
      return result
    } finally {
      setIsMatching(false)
    }
  }, [])

  const getMatchForExpressId = useCallback((expressID: number) => matchMapRef.current.get(expressID), [])
  const isElementMatched = useCallback((expressID: number) => matchMapRef.current.has(expressID), [])

  const clearMatch = useCallback(() => {
    matchMapRef.current.clear()
    setMatchResult(null)
  }, [])

  return {
    matchResult,
    isMatching,
    runMatching,
    getMatchForExpressId,
    isElementMatched,
    clearMatch,
  }
}
