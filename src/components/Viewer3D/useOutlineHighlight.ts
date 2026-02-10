import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import { Line2 } from 'three/addons/lines/Line2.js'
import { LineMaterial } from 'three/addons/lines/LineMaterial.js'
import { LineGeometry } from 'three/addons/lines/LineGeometry.js'
import type { IFCService } from './ifc/ifcService'

const OUTLINE_GROUP_NAME = '__summary_outlines__'
const MAX_OUTLINE_ELEMENTS = 200
const DEFAULT_COLOR = 0x3b82f6

export function useOutlineHighlight() {
  const outlineGroupRef = useRef<THREE.Group | null>(null)
  const emissiveBackupRef = useRef<Map<string, THREE.Material | THREE.Material[]>>(new Map())
  const lineMaterialRef = useRef<LineMaterial | null>(null)

  const clearHighlight = useCallback((scene: THREE.Scene) => {
    // Remove outline group
    if (outlineGroupRef.current) {
      outlineGroupRef.current.traverse((obj) => {
        if (obj instanceof Line2) {
          obj.geometry.dispose()
        }
      })
      scene.remove(outlineGroupRef.current)
      outlineGroupRef.current = null
    }

    // Dispose line material
    if (lineMaterialRef.current) {
      lineMaterialRef.current.dispose()
      lineMaterialRef.current = null
    }

    // Restore emissive materials
    emissiveBackupRef.current.forEach((original, uuid) => {
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && obj.uuid === uuid) {
          obj.material = original
        }
      })
    })
    emissiveBackupRef.current.clear()
  }, [])

  const highlightGroup = useCallback((
    expressIDs: number[],
    service: IFCService,
    scene: THREE.Scene,
    renderer: THREE.WebGLRenderer,
    color: number = DEFAULT_COLOR,
  ) => {
    // Clear previous
    clearHighlight(scene)

    const outlineGroup = new THREE.Group()
    outlineGroup.name = OUTLINE_GROUP_NAME
    outlineGroupRef.current = outlineGroup

    const size = renderer.getSize(new THREE.Vector2())

    const lineMat = new LineMaterial({
      color,
      linewidth: 3,
      resolution: new THREE.Vector2(size.x, size.y),
    })
    lineMaterialRef.current = lineMat

    let outlineCount = 0

    for (const id of expressIDs) {
      const mesh = service.getMesh(id)
      if (!mesh) continue

      // Always apply emissive highlight
      if (!emissiveBackupRef.current.has(mesh.uuid)) {
        emissiveBackupRef.current.set(mesh.uuid, mesh.material)
      }
      const mat = (mesh.material as THREE.MeshPhysicalMaterial).clone()
      mat.emissive = new THREE.Color(color)
      mat.emissiveIntensity = 0.4
      mesh.material = mat

      // Add thick outlines only for first N elements
      if (outlineCount < MAX_OUTLINE_ELEMENTS) {
        try {
          const edgesGeo = new THREE.EdgesGeometry(mesh.geometry, 30)
          const posAttr = edgesGeo.getAttribute('position')
          if (posAttr && posAttr.count >= 2) {
            const positions: number[] = []
            for (let i = 0; i < posAttr.count; i++) {
              positions.push(posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i))
            }

            const lineGeo = new LineGeometry()
            lineGeo.setPositions(positions)

            const line = new Line2(lineGeo, lineMat)
            line.computeLineDistances()

            // Apply mesh world transform
            line.applyMatrix4(mesh.matrixWorld)
            outlineGroup.add(line)
            outlineCount++
          }
          edgesGeo.dispose()
        } catch {
          // Some geometries may not support edges
        }
      }
    }

    scene.add(outlineGroup)
  }, [clearHighlight])

  const updateResolution = useCallback((w: number, h: number) => {
    if (lineMaterialRef.current) {
      lineMaterialRef.current.resolution.set(w, h)
    }
  }, [])

  return { highlightGroup, clearHighlight, updateResolution }
}
