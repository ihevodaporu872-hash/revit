import { useState, useCallback, useRef } from 'react'
import type { RevitProperties } from './ifc/types'
import { fetchRevitPropertiesBulk } from '../../services/revit-api'

interface RevitScope {
  projectId: string
  modelVersion?: string
}

export function useRevitEnrichment() {
  const cacheByGlobalId = useRef<Map<string, RevitProperties>>(new Map())
  const cacheByElementId = useRef<Map<number, RevitProperties>>(new Map())
  const scopeRef = useRef<RevitScope>({ projectId: 'default' })
  const [isLoading, setIsLoading] = useState(false)
  const [hasData, setHasData] = useState(false)

  const setScope = useCallback((scope: RevitScope) => {
    scopeRef.current = {
      projectId: scope.projectId || 'default',
      modelVersion: scope.modelVersion,
    }
  }, [])

  const prefetchBulk = useCallback(async (globalIds: string[], scope?: RevitScope) => {
    if (globalIds.length === 0) return
    if (scope) setScope(scope)
    const activeScope = scope || scopeRef.current

    setIsLoading(true)
    try {
      const { results } = await fetchRevitPropertiesBulk({
        globalIds,
        projectId: activeScope.projectId,
        modelVersion: activeScope.modelVersion,
      })

      for (const props of results) {
        if (!props.globalId) continue
        cacheByGlobalId.current.set(props.globalId, props)
        if (props.revitElementId) {
          cacheByElementId.current.set(props.revitElementId, props)
        }
      }
      setHasData(cacheByGlobalId.current.size > 0 || cacheByElementId.current.size > 0)
    } finally {
      setIsLoading(false)
    }
  }, [setScope])

  const prefetchByElementIds = useCallback(async (ids: number[], scope?: RevitScope) => {
    if (ids.length === 0) return
    if (scope) setScope(scope)
    const activeScope = scope || scopeRef.current

    setIsLoading(true)
    try {
      const { results } = await fetchRevitPropertiesBulk({
        elementIds: ids,
        projectId: activeScope.projectId,
        modelVersion: activeScope.modelVersion,
      })

      for (const props of results) {
        if (props.revitElementId) {
          cacheByElementId.current.set(props.revitElementId, props)
        }
        if (props.globalId) {
          cacheByGlobalId.current.set(props.globalId, props)
        }
      }
      setHasData(cacheByGlobalId.current.size > 0 || cacheByElementId.current.size > 0)
    } finally {
      setIsLoading(false)
    }
  }, [setScope])

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
    setScope,
    hasRevitData,
    hasAnyData: hasData,
    isLoading,
    invalidateCache,
    getAllCachedProps,
    scope: scopeRef.current,
  }
}
