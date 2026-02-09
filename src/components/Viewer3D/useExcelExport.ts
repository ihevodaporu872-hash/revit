import { useCallback } from 'react'
import * as XLSX from 'xlsx'
import type { IFCService } from './ifc/ifcService'
import type { SavedSet, SearchCriterion, SearchLogic } from './ifc/types'

type ExportScope = 'all' | 'selected' | 'set'

interface ExportOptions {
  scope: ExportScope
  selectedIds?: number[]
  set?: SavedSet
  evaluateSearchSet?: (service: IFCService, criteria: SearchCriterion[], logic: SearchLogic) => Promise<number[]>
}

export function useExcelExport() {
  const exportToExcel = useCallback(async (
    service: IFCService,
    modelName: string,
    options: ExportOptions,
    onProgress?: (percent: number) => void,
  ) => {
    let ids: number[]

    if (options.scope === 'selected' && options.selectedIds) {
      ids = options.selectedIds
    } else if (options.scope === 'set' && options.set && options.evaluateSearchSet) {
      if (options.set.type === 'selection' && options.set.expressIDs) {
        ids = options.set.expressIDs
      } else if (options.set.criteria) {
        ids = await options.evaluateSearchSet(service, options.set.criteria, options.set.logic || 'AND')
      } else {
        ids = []
      }
    } else {
      ids = service.getAllExpressIDs()
    }

    const rows: Record<string, string | number>[] = []
    const allKeys = new Set<string>()

    for (let i = 0; i < ids.length; i++) {
      const info = await service.getElementProperties(ids[i])
      if (!info) continue

      const row: Record<string, string | number> = {
        'Express ID': info.expressID,
        'Type': info.type,
        'Name': info.name,
        'Material': info.material || '',
        'Volume': info.volume || '',
        'Area': info.area || '',
      }

      for (const prop of info.properties) {
        row[prop.name] = prop.value
        allKeys.add(prop.name)
      }

      rows.push(row)

      if (i % 10 === 0) {
        onProgress?.(Math.round((i / ids.length) * 100))
        await new Promise((r) => setTimeout(r, 0)) // yield to UI
      }
    }

    onProgress?.(100)

    const ws = XLSX.utils.json_to_sheet(rows)

    // Auto-width columns
    const colWidths: number[] = []
    const header = Object.keys(rows[0] || {})
    header.forEach((key, i) => {
      let maxLen = key.length
      rows.forEach((r) => {
        const val = String(r[key] || '')
        if (val.length > maxLen) maxLen = val.length
      })
      colWidths[i] = Math.min(maxLen + 2, 50)
    })
    ws['!cols'] = colWidths.map((w) => ({ wch: w }))

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'IFC Elements')

    const date = new Date().toISOString().split('T')[0]
    const safeName = modelName.replace(/\.ifc$/i, '').replace(/[^a-zA-Z0-9_-]/g, '_')
    XLSX.writeFile(wb, `${safeName}_export_${date}.xlsx`)
  }, [])

  return { exportToExcel }
}
