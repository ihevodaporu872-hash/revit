import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import type { IFCService } from './ifc/ifcService'
import type { ProfileLegendEntry } from './ifc/types'

const PALETTE = [
  '#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7',
  '#ec4899', '#f97316', '#06b6d4', '#84cc16', '#f43f5e',
  '#8b5cf6', '#14b8a6', '#f59e0b', '#6366f1', '#10b981',
  '#e11d48', '#0ea5e9', '#d946ef', '#78716c', '#64748b',
]

type ProfileField = 'type' | 'name' | 'material' | 'objectType'

export function useAppearanceProfiler() {
  const originalMaterialsRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map())

  const buildProfile = useCallback(async (
    service: IFCService,
    field: ProfileField,
    group: THREE.Group,
    onProgress?: (percent: number) => void,
  ): Promise<ProfileLegendEntry[]> => {
    const ids = service.getAllExpressIDs()
    const groups = new Map<string, number[]>()

    for (let i = 0; i < ids.length; i++) {
      const info = await service.getElementProperties(ids[i])
      if (!info) continue

      let value = ''
      switch (field) {
        case 'type': value = info.type; break
        case 'name': value = info.name; break
        case 'material': value = info.material || 'No Material'; break
        case 'objectType': {
          const prop = info.properties.find((p) => p.name === 'ObjectType')
          value = prop?.value || 'Unknown'
          break
        }
      }

      if (!groups.has(value)) groups.set(value, [])
      groups.get(value)!.push(ids[i])

      if (i % 50 === 0) onProgress?.(Math.round((i / ids.length) * 100))
    }

    // Sort by count descending
    const sorted = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length)

    const legend: ProfileLegendEntry[] = sorted.map(([value, ids], idx) => ({
      value,
      color: PALETTE[idx % PALETTE.length],
      count: ids.length,
    }))

    // Build ID -> color map
    const idColorMap = new Map<number, string>()
    sorted.forEach(([, ids], idx) => {
      const color = PALETTE[idx % PALETTE.length]
      ids.forEach((id) => idColorMap.set(id, color))
    })

    // Apply colors
    applyColors(group, idColorMap)

    return legend
  }, [])

  const applyColors = (group: THREE.Group, idColorMap: Map<number, string>) => {
    // Backup originals first
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.expressID !== undefined) {
        if (!originalMaterialsRef.current.has(obj.uuid)) {
          originalMaterialsRef.current.set(obj.uuid, obj.material)
        }
        const color = idColorMap.get(obj.userData.expressID)
        if (color) {
          const mat = (obj.material as THREE.MeshPhysicalMaterial).clone()
          mat.color = new THREE.Color(color)
          mat.emissive = new THREE.Color(color)
          mat.emissiveIntensity = 0.15
          obj.material = mat
        }
      }
    })
  }

  const clearProfile = useCallback((group: THREE.Group) => {
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.expressID !== undefined) {
        const original = originalMaterialsRef.current.get(obj.uuid)
        if (original) {
          obj.material = original
        }
      }
    })
    originalMaterialsRef.current.clear()
  }, [])

  return { buildProfile, clearProfile }
}
