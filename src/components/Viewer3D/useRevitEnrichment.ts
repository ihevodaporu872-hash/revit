import { useState, useCallback, useRef } from 'react'
import type { RevitProperties } from './ifc/types'
import { fetchRevitPropertiesBulk } from '../../services/supabase-api'

export function useRevitEnrichment() {
  const cacheRef = useRef<Map<string, RevitProperties>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [hasData, setHasData] = useState(false)

  const prefetchBulk = useCallback(async (globalIds: string[]) => {
    if (globalIds.length === 0) return
    setIsLoading(true)
    try {
      const results = await fetchRevitPropertiesBulk(globalIds)
      for (const [id, props] of results) {
        cacheRef.current.set(id, props)
      }
      setHasData(cacheRef.current.size > 0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getRevitProps = useCallback((globalId: string): RevitProperties | undefined => {
    return cacheRef.current.get(globalId)
  }, [])

  const hasRevitData = useCallback((globalId: string): boolean => {
    return cacheRef.current.has(globalId)
  }, [])

  const invalidateCache = useCallback(() => {
    cacheRef.current.clear()
    setHasData(false)
  }, [])

  return {
    getRevitProps,
    prefetchBulk,
    hasRevitData,
    hasAnyData: hasData,
    isLoading,
    invalidateCache,
  }
}
