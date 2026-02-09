import { useState, useCallback, useRef } from 'react'
import type { RevitProperties } from './ifc/types'
import { fetchRevitPropertiesBulk, fetchRevitPropertiesByElementIds } from '../../services/supabase-api'

export function useRevitEnrichment() {
  const cacheByGlobalId = useRef<Map<string, RevitProperties>>(new Map())
  const cacheByElementId = useRef<Map<number, RevitProperties>>(new Map())
  const [isLoading, setIsLoading] = useState(false)
  const [hasData, setHasData] = useState(false)

  const prefetchBulk = useCallback(async (globalIds: string[]) => {
    if (globalIds.length === 0) return
    setIsLoading(true)
    try {
      const results = await fetchRevitPropertiesBulk(globalIds)
      for (const [id, props] of results) {
        cacheByGlobalId.current.set(id, props)
        if (props.revitElementId) {
          cacheByElementId.current.set(props.revitElementId, props)
        }
      }
      setHasData(cacheByGlobalId.current.size > 0 || cacheByElementId.current.size > 0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const prefetchByElementIds = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return
    setIsLoading(true)
    try {
      const results = await fetchRevitPropertiesByElementIds(ids)
      for (const [id, props] of results) {
        cacheByElementId.current.set(id, props)
        if (props.globalId) {
          cacheByGlobalId.current.set(props.globalId, props)
        }
      }
      setHasData(cacheByGlobalId.current.size > 0 || cacheByElementId.current.size > 0)
    } finally {
      setIsLoading(false)
    }
  }, [])

  const getRevitProps = useCallback((globalId: string): RevitProperties | undefined => {
    return cacheByGlobalId.current.get(globalId)
  }, [])

  const getRevitPropsByElementId = useCallback((elementId: number): RevitProperties | undefined => {
    return cacheByElementId.current.get(elementId)
  }, [])

  /** Try GlobalId first, then fall back to ElementId (Tag) */
  const getRevitPropsAny = useCallback((globalId?: string, tag?: string): RevitProperties | undefined => {
    if (globalId) {
      const byGid = cacheByGlobalId.current.get(globalId)
      if (byGid) return byGid
    }
    if (tag) {
      const tagNum = parseInt(tag, 10)
      if (!isNaN(tagNum)) {
        const byEid = cacheByElementId.current.get(tagNum)
        if (byEid) return byEid
      }
    }
    return undefined
  }, [])

  const hasRevitData = useCallback((globalId: string): boolean => {
    return cacheByGlobalId.current.has(globalId)
  }, [])

  const invalidateCache = useCallback(() => {
    cacheByGlobalId.current.clear()
    cacheByElementId.current.clear()
    setHasData(false)
  }, [])

  const getAllCachedProps = useCallback((): RevitProperties[] => {
    return Array.from(cacheByGlobalId.current.values())
  }, [])

  return {
    getRevitProps,
    getRevitPropsByElementId,
    getRevitPropsAny,
    prefetchBulk,
    prefetchByElementIds,
    hasRevitData,
    hasAnyData: hasData,
    isLoading,
    invalidateCache,
    getAllCachedProps,
  }
}
