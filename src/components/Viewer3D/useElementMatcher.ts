import { useState, useCallback, useRef } from 'react'
import type { IFCElementInfo, RevitProperties } from './ifc/types'

export interface MatchResult {
  totalIfcElements: number
  totalExcelRows: number
  matchedByElementId: number
  matchedByGlobalId: number
  totalMatched: number
  missingInIfc: RevitProperties[]     // in Excel but not in IFC
  missingInExcel: IFCElementInfo[]    // in IFC but not in Excel
  matchMap: Map<number, { ifcExpressId: number; revitProps: RevitProperties; matchedBy: 'elementId' | 'globalId' }>
  byCategory: Map<string, { ifcCount: number; revitCount: number; matchedCount: number }>
}

export function useElementMatcher() {
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null)
  const [isMatching, setIsMatching] = useState(false)
  const matchMapRef = useRef<Map<number, { ifcExpressId: number; revitProps: RevitProperties; matchedBy: 'elementId' | 'globalId' }>>(new Map())

  const runMatching = useCallback((
    ifcElements: IFCElementInfo[],
    revitRows: RevitProperties[],
  ): MatchResult => {
    setIsMatching(true)

    try {
      // Build IFC lookup maps
      const ifcByTag = new Map<string, IFCElementInfo>()       // Tag (ElementId) → IFC element
      const ifcByGlobalId = new Map<string, IFCElementInfo>()  // GlobalId → IFC element

      for (const el of ifcElements) {
        if (el.tag) ifcByTag.set(el.tag, el)
        if (el.globalId) ifcByGlobalId.set(el.globalId, el)
      }

      // Build Excel lookup maps
      const excelById = new Map<number, RevitProperties>()       // ElementId → row
      const excelByGlobalId = new Map<string, RevitProperties>() // GlobalId → row

      for (const row of revitRows) {
        if (row.revitElementId) excelById.set(row.revitElementId, row)
        if (row.globalId && !row.globalId.startsWith('REVIT_EID_')) {
          excelByGlobalId.set(row.globalId, row)
        }
      }

      // Matching
      const matchMap = new Map<number, { ifcExpressId: number; revitProps: RevitProperties; matchedBy: 'elementId' | 'globalId' }>()
      const matchedIfcExpressIds = new Set<number>()
      const matchedRevitGlobalIds = new Set<string>()
      let matchedByElementId = 0
      let matchedByGlobalId = 0

      // Pass 1: Match by ElementId (Tag → ID)
      for (const el of ifcElements) {
        if (!el.tag) continue
        const tagNum = parseInt(el.tag, 10)
        if (isNaN(tagNum)) continue
        const revitRow = excelById.get(tagNum)
        if (revitRow) {
          matchMap.set(el.expressID, { ifcExpressId: el.expressID, revitProps: revitRow, matchedBy: 'elementId' })
          matchedIfcExpressIds.add(el.expressID)
          matchedRevitGlobalIds.add(revitRow.globalId)
          matchedByElementId++
        }
      }

      // Pass 2: Match unmatched IFC elements by GlobalId
      for (const el of ifcElements) {
        if (matchedIfcExpressIds.has(el.expressID)) continue
        if (!el.globalId) continue
        const revitRow = excelByGlobalId.get(el.globalId)
        if (revitRow && !matchedRevitGlobalIds.has(revitRow.globalId)) {
          matchMap.set(el.expressID, { ifcExpressId: el.expressID, revitProps: revitRow, matchedBy: 'globalId' })
          matchedIfcExpressIds.add(el.expressID)
          matchedRevitGlobalIds.add(revitRow.globalId)
          matchedByGlobalId++
        }
      }

      // Collect unmatched
      const missingInIfc = revitRows.filter(r => !matchedRevitGlobalIds.has(r.globalId))
      const missingInExcel = ifcElements.filter(el => !matchedIfcExpressIds.has(el.expressID))

      // Category breakdown
      const byCategory = new Map<string, { ifcCount: number; revitCount: number; matchedCount: number }>()

      for (const el of ifcElements) {
        const cat = el.type || 'Unknown'
        const entry = byCategory.get(cat) || { ifcCount: 0, revitCount: 0, matchedCount: 0 }
        entry.ifcCount++
        if (matchedIfcExpressIds.has(el.expressID)) entry.matchedCount++
        byCategory.set(cat, entry)
      }

      for (const row of revitRows) {
        const cat = row.category || 'Unknown'
        const entry = byCategory.get(cat) || { ifcCount: 0, revitCount: 0, matchedCount: 0 }
        entry.revitCount++
        byCategory.set(cat, entry)
      }

      const result: MatchResult = {
        totalIfcElements: ifcElements.length,
        totalExcelRows: revitRows.length,
        matchedByElementId,
        matchedByGlobalId,
        totalMatched: matchedByElementId + matchedByGlobalId,
        missingInIfc,
        missingInExcel,
        matchMap,
        byCategory,
      }

      matchMapRef.current = matchMap
      setMatchResult(result)
      return result
    } finally {
      setIsMatching(false)
    }
  }, [])

  const getMatchForExpressId = useCallback((expressID: number) => {
    return matchMapRef.current.get(expressID)
  }, [])

  const isElementMatched = useCallback((expressID: number) => {
    return matchMapRef.current.has(expressID)
  }, [])

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
