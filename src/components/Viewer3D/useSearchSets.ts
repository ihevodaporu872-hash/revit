import { useCallback } from 'react'
import type { SearchCriterion, SearchLogic } from './ifc/types'
import type { IFCService } from './ifc/ifcService'

export function useSearchSets() {
  const evaluateSearchSet = useCallback(
    async (
      service: IFCService,
      criteria: SearchCriterion[],
      logic: SearchLogic,
    ): Promise<number[]> => {
      if (criteria.length === 0) return []

      const allIds = service.getAllExpressIDs()
      const matchingIds: number[] = []

      for (const id of allIds) {
        const info = await service.getElementProperties(id)
        if (!info) continue

        const results = criteria.map((c) => {
          let fieldValue = ''
          if (c.field === 'type') fieldValue = info.type
          else if (c.field === 'name') fieldValue = info.name
          else if (c.field === 'material') fieldValue = info.material || ''
          else {
            const prop = info.properties.find((p) => p.name.toLowerCase().includes(c.field.toLowerCase()))
            fieldValue = prop?.value || ''
          }
          return matchOperator(fieldValue, c.operator, c.value)
        })

        const matches = logic === 'AND' ? results.every(Boolean) : results.some(Boolean)
        if (matches) matchingIds.push(id)
      }

      return matchingIds
    },
    [],
  )

  return { evaluateSearchSet }
}

function matchOperator(fieldValue: string, operator: string, value: string): boolean {
  const fv = fieldValue.toLowerCase()
  const v = value.toLowerCase()
  switch (operator) {
    case 'equals': return fv === v
    case 'notEquals': return fv !== v
    case 'contains': return fv.includes(v)
    case 'startsWith': return fv.startsWith(v)
    case 'endsWith': return fv.endsWith(v)
    case 'greaterThan': return parseFloat(fieldValue) > parseFloat(value)
    case 'lessThan': return parseFloat(fieldValue) < parseFloat(value)
    default: return false
  }
}
