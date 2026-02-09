import { useCallback, useRef } from 'react'
import * as THREE from 'three'
import type { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { IFCService } from './ifc/ifcService'

interface UseZoomToSelectedParams {
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>
  controlsRef: React.RefObject<OrbitControls | null>
  ifcServiceRef: React.RefObject<IFCService | null>
  selectedElementIds: number[]
}

export function useZoomToSelected({ cameraRef, controlsRef, ifcServiceRef, selectedElementIds }: UseZoomToSelectedParams) {
  const isAnimatingRef = useRef(false)

  const zoomToSelected = useCallback(() => {
    const camera = cameraRef.current
    const controls = controlsRef.current
    const service = ifcServiceRef.current
    if (!camera || !controls || !service || selectedElementIds.length === 0) return

    const box = new THREE.Box3()
    let hasGeometry = false

    for (const id of selectedElementIds) {
      const mesh = service.getMesh(id)
      if (mesh) {
        box.expandByObject(mesh)
        hasGeometry = true
      }
    }
    if (!hasGeometry) return

    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z)
    const fov = camera.fov * (Math.PI / 180)
    const targetDistance = Math.max(maxDim / (2 * Math.tan(fov / 2)) * 1.5, 2)

    // Preserve viewing direction
    const direction = new THREE.Vector3().subVectors(camera.position, controls.target).normalize()
    const targetPosition = new THREE.Vector3().copy(center).addScaledVector(direction, targetDistance)

    const startPosition = camera.position.clone()
    const startTarget = controls.target.clone()
    const startTime = performance.now()
    const duration = 500

    isAnimatingRef.current = true

    const animate = (now: number) => {
      const elapsed = now - startTime
      const rawT = Math.min(elapsed / duration, 1)
      // Cubic ease-out
      const t = 1 - Math.pow(1 - rawT, 3)

      camera.position.lerpVectors(startPosition, targetPosition, t)
      controls.target.lerpVectors(startTarget, center, t)
      controls.update()

      if (rawT < 1) {
        requestAnimationFrame(animate)
      } else {
        isAnimatingRef.current = false
      }
    }
    requestAnimationFrame(animate)
  }, [cameraRef, controlsRef, ifcServiceRef, selectedElementIds])

  return { zoomToSelected, isAnimating: isAnimatingRef.current }
}
