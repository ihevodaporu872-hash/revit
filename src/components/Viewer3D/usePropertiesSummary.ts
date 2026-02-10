import { useRef, useCallback, useState } from 'react'
import type { IFCService } from './ifc/ifcService'
import type { SummaryGroupBy, SummaryElementData, SummaryGroup, SummaryData } from './ifc/types'

function parseNumeric(val: string | undefined): number {
  if (!val) return 0
  const n = parseFloat(val)
  return isNaN(n) ? 0 : n
}

function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0))
}

export function usePropertiesSummary() {
  const elementsRef = useRef<SummaryElementData[]>([])
  const abortRef = useRef(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [isScanning, setIsScanning] = useState(false)
  const [scannedCount, setScannedCount] = useState(0)

  const scanElements = useCallback(async (service: IFCService): Promise<SummaryElementData[]> => {
    abortRef.current = false
    setIsScanning(true)
    setScanProgress(0)

    const ids = service.getAllExpressIDs()
    const elements: SummaryElementData[] = []

    for (let i = 0; i < ids.length; i++) {
      if (abortRef.current) break

      const info = await service.getElementProperties(ids[i])
      if (info) {
        // Parse length from properties (look for Length/Height quantity)
        let length = 0
        let area = parseNumeric(info.area)
        let volume = parseNumeric(info.volume)

        for (const prop of info.properties) {
          const pName = prop.name.toLowerCase()
          if (pName.includes('length') && !length) length = parseNumeric(prop.value)
          if (pName.includes('area') && !area) area = parseNumeric(prop.value)
          if (pName.includes('volume') && !volume) volume = parseNumeric(prop.value)
        }

        elements.push({
          expressID: ids[i],
          type: info.type,
          name: info.name,
          material: info.material || 'No Material',
          length,
          area,
          volume,
        })
      }

      if (i % 50 === 0) {
        const progress = Math.round((i / ids.length) * 100)
        setScanProgress(progress)
        setScannedCount(elements.length)
        await yieldToMain()
      }
    }

    elementsRef.current = elements
    setScanProgress(100)
    setScannedCount(elements.length)
    setIsScanning(false)
    return elements
  }, [])

  const abort = useCallback(() => {
    abortRef.current = true
  }, [])

  const buildSummary = useCallback((groupBy: SummaryGroupBy): SummaryData => {
    const elements = elementsRef.current
    const groupMap = new Map<string, SummaryElementData[]>()

    for (const el of elements) {
      let key: string
      switch (groupBy) {
        case 'type': key = el.type; break
        case 'name': key = el.name; break
        case 'material': key = el.material; break
      }
      if (!groupMap.has(key)) groupMap.set(key, [])
      groupMap.get(key)!.push(el)
    }

    const groups: SummaryGroup[] = Array.from(groupMap.entries()).map(([key, els]) => ({
      key,
      count: els.length,
      expressIDs: els.map((e) => e.expressID),
      totalLength: els.reduce((sum, e) => sum + e.length, 0),
      totalArea: els.reduce((sum, e) => sum + e.area, 0),
      totalVolume: els.reduce((sum, e) => sum + e.volume, 0),
      elements: els,
    }))

    return {
      groupBy,
      groups,
      totalElements: elements.length,
      scanProgress,
      isScanning,
    }
  }, [scanProgress, isScanning])

  const hasData = useCallback(() => elementsRef.current.length > 0, [])

  const clear = useCallback(() => {
    elementsRef.current = []
    setScanProgress(0)
    setScannedCount(0)
  }, [])

  return { scanElements, buildSummary, hasData, clear, abort, scanProgress, isScanning, scannedCount }
}
