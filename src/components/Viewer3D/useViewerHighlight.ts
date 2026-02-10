import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import type { ActiveSetDisplay } from './ifc/types'

interface HighlightState {
  originalMaterials: Map<string, THREE.Material | THREE.Material[]>
  originalVisibility: Map<string, boolean>
}

export function useViewerHighlight() {
  const stateRef = useRef<HighlightState>({
    originalMaterials: new Map(),
    originalVisibility: new Map(),
  })

  const reset = useCallback((group: THREE.Group) => {
    const { originalMaterials, originalVisibility } = stateRef.current
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.expressID !== undefined) {
        const saved = originalMaterials.get(obj.uuid)
        if (saved) {
          obj.material = saved
        }
        const vis = originalVisibility.get(obj.uuid)
        if (vis !== undefined) {
          obj.visible = vis
        }
      }
    })
    originalMaterials.clear()
    originalVisibility.clear()
  }, [])

  const backup = useCallback((group: THREE.Group) => {
    const { originalMaterials, originalVisibility } = stateRef.current
    if (originalMaterials.size > 0) return // already backed up
    group.traverse((obj) => {
      if (obj instanceof THREE.Mesh && obj.userData.expressID !== undefined) {
        originalMaterials.set(obj.uuid, obj.material)
        originalVisibility.set(obj.uuid, obj.visible)
      }
    })
  }, [])

  const applyDisplay = useCallback(
    (group: THREE.Group, matchingIds: Set<number>, display: ActiveSetDisplay, color: string) => {
      backup(group)

      const highlightColor = new THREE.Color(color)

      group.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || obj.userData.expressID === undefined) return
        const isMatch = matchingIds.has(obj.userData.expressID)

        switch (display.mode) {
          case 'highlight': {
            if (isMatch) {
              const mat = (obj.material as THREE.MeshPhysicalMaterial).clone()
              mat.emissive = highlightColor
              mat.emissiveIntensity = 0.4
              obj.material = mat
            }
            break
          }
          case 'isolate': {
            obj.visible = isMatch
            break
          }
          case 'transparent': {
            if (!isMatch) {
              const mat = (obj.material as THREE.MeshPhysicalMaterial).clone()
              mat.transparent = true
              mat.opacity = 0.1
              mat.depthWrite = false
              obj.material = mat
            }
            break
          }
          case 'wireframe': {
            const mat = (obj.material as THREE.MeshPhysicalMaterial).clone()
            if (isMatch) {
              mat.wireframe = false
              mat.transparent = false
              mat.opacity = 1
              mat.depthWrite = true
            } else {
              mat.wireframe = true
              mat.transparent = true
              mat.opacity = 0.14
              mat.depthWrite = false
            }
            obj.material = mat
            break
          }
        }
      })
    },
    [backup],
  )

  return { applyDisplay, reset }
}
