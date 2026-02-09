import { useCallback, useRef } from 'react'
import * as THREE from 'three'

interface MaterialBackup {
  wireframe: boolean
  opacity: number
  transparent: boolean
}

export function useWireframe() {
  const backupMap = useRef(new WeakMap<THREE.MeshPhysicalMaterial, MaterialBackup>())

  const toggle = useCallback((group: THREE.Group | null, enable: boolean) => {
    if (!group) return
    group.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      const mat = obj.material
      if (!(mat instanceof THREE.MeshPhysicalMaterial)) return

      if (enable) {
        // Save original props
        backupMap.current.set(mat, {
          wireframe: mat.wireframe,
          opacity: mat.opacity,
          transparent: mat.transparent,
        })
        mat.wireframe = true
        mat.opacity = 0.3
        mat.transparent = true
      } else {
        const backup = backupMap.current.get(mat)
        if (backup) {
          mat.wireframe = backup.wireframe
          mat.opacity = backup.opacity
          mat.transparent = backup.transparent
          backupMap.current.delete(mat)
        }
      }
      mat.needsUpdate = true
    })
  }, [])

  return { toggle }
}
