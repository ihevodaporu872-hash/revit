import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import type { ClipAxis, SectionMode, ClipPlaneState, ClipBoxState } from './ifc/types'

interface UseSectionPlanesParams {
  rendererRef: React.RefObject<THREE.WebGLRenderer | null>
  sceneRef: React.RefObject<THREE.Scene | null>
}

const PLANE_COLORS: Record<ClipAxis, number> = { x: 0xff4444, y: 0x44ff44, z: 0x4444ff }

export function useSectionPlanes({ rendererRef, sceneRef }: UseSectionPlanesParams) {
  const planesRef = useRef<Map<string, THREE.Plane>>(new Map())
  const helpersRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const boundsRef = useRef<THREE.Box3>(new THREE.Box3())
  const modeRef = useRef<SectionMode>('off')

  const initBounds = useCallback((group: THREE.Group) => {
    const box = new THREE.Box3().setFromObject(group)
    boundsRef.current = box
  }, [])

  const updateClipping = useCallback((
    mode: SectionMode,
    planeStates: ClipPlaneState[],
    boxState: ClipBoxState,
  ) => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    if (!renderer || !scene) return

    modeRef.current = mode

    // Remove old helpers
    helpersRef.current.forEach((mesh) => scene.remove(mesh))
    helpersRef.current.clear()
    planesRef.current.clear()

    if (mode === 'off') {
      renderer.clippingPlanes = []
      return
    }

    const bounds = boundsRef.current
    const size = bounds.getSize(new THREE.Vector3())
    const center = bounds.getCenter(new THREE.Vector3())
    const clipPlanes: THREE.Plane[] = []

    if (mode === 'planes') {
      for (const ps of planeStates) {
        if (!ps.enabled) continue

        const normal = new THREE.Vector3()
        if (ps.axis === 'x') normal.set(ps.flipped ? 1 : -1, 0, 0)
        else if (ps.axis === 'y') normal.set(0, ps.flipped ? 1 : -1, 0)
        else normal.set(0, 0, ps.flipped ? 1 : -1)

        const min = ps.axis === 'x' ? bounds.min.x : ps.axis === 'y' ? bounds.min.y : bounds.min.z
        const max = ps.axis === 'x' ? bounds.max.x : ps.axis === 'y' ? bounds.max.y : bounds.max.z
        const pos = min + (max - min) * ps.position
        const constant = ps.flipped ? -pos : pos

        const plane = new THREE.Plane(normal, constant)
        clipPlanes.push(plane)
        planesRef.current.set(ps.axis, plane)

        // Visual helper
        const helperSize = Math.max(size.x, size.y, size.z) * 1.2
        const geo = new THREE.PlaneGeometry(helperSize, helperSize)
        const mat = new THREE.MeshBasicMaterial({
          color: PLANE_COLORS[ps.axis],
          transparent: true,
          opacity: 0.12,
          side: THREE.DoubleSide,
          depthWrite: false,
        })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.renderOrder = 1

        if (ps.axis === 'x') {
          mesh.rotation.y = Math.PI / 2
          mesh.position.set(pos, center.y, center.z)
        } else if (ps.axis === 'y') {
          mesh.rotation.x = Math.PI / 2
          mesh.position.set(center.x, pos, center.z)
        } else {
          mesh.position.set(center.x, center.y, pos)
        }

        scene.add(mesh)
        helpersRef.current.set(ps.axis, mesh)
      }
    } else if (mode === 'box') {
      if (!boxState.enabled) {
        renderer.clippingPlanes = []
        return
      }

      const axes: { axis: ClipAxis; min: number; max: number; bMin: number; bMax: number }[] = [
        { axis: 'x', min: boxState.xMin, max: boxState.xMax, bMin: bounds.min.x, bMax: bounds.max.x },
        { axis: 'y', min: boxState.yMin, max: boxState.yMax, bMin: bounds.min.y, bMax: bounds.max.y },
        { axis: 'z', min: boxState.zMin, max: boxState.zMax, bMin: bounds.min.z, bMax: bounds.max.z },
      ]

      for (const a of axes) {
        const minPos = a.bMin + (a.bMax - a.bMin) * a.min
        const maxPos = a.bMin + (a.bMax - a.bMin) * a.max

        const normalMin = new THREE.Vector3()
        const normalMax = new THREE.Vector3()

        if (a.axis === 'x') { normalMin.set(-1, 0, 0); normalMax.set(1, 0, 0) }
        else if (a.axis === 'y') { normalMin.set(0, -1, 0); normalMax.set(0, 1, 0) }
        else { normalMin.set(0, 0, -1); normalMax.set(0, 0, 1) }

        clipPlanes.push(new THREE.Plane(normalMin, minPos))
        clipPlanes.push(new THREE.Plane(normalMax, -maxPos))
      }
    }

    renderer.clippingPlanes = clipPlanes
  }, [rendererRef, sceneRef])

  const dispose = useCallback(() => {
    const renderer = rendererRef.current
    const scene = sceneRef.current
    if (renderer) renderer.clippingPlanes = []
    helpersRef.current.forEach((mesh) => {
      if (scene) scene.remove(mesh)
      mesh.geometry.dispose()
      ;(mesh.material as THREE.MeshBasicMaterial).dispose()
    })
    helpersRef.current.clear()
    planesRef.current.clear()
  }, [rendererRef, sceneRef])

  return { initBounds, updateClipping, dispose }
}
