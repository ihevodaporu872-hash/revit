import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import type { MeasurePoint, Measurement } from './ifc/types'

interface UseMeasureToolParams {
  sceneRef: React.RefObject<THREE.Scene | null>
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>
  modelGroupRef: React.RefObject<THREE.Group | null>
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function useMeasureTool({ sceneRef, cameraRef, modelGroupRef, containerRef }: UseMeasureToolParams) {
  const measurementsRef = useRef<Measurement[]>([])
  const pendingPointRef = useRef<MeasurePoint | null>(null)
  const pendingMarkerRef = useRef<THREE.Mesh | null>(null)

  const createSphere = useCallback((position: THREE.Vector3, color: number) => {
    const geo = new THREE.SphereGeometry(0.08, 16, 16)
    const mat = new THREE.MeshBasicMaterial({ color, depthTest: false })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.copy(position)
    mesh.renderOrder = 999
    return mesh
  }, [])

  const createLabel = useCallback((text: string, position: THREE.Vector3) => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')!
    canvas.width = 256
    canvas.height = 64
    ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
    ctx.roundRect(0, 0, 256, 64, 8)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 28px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(text, 128, 32)

    const texture = new THREE.CanvasTexture(canvas)
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false })
    const sprite = new THREE.Sprite(mat)
    sprite.position.copy(position)
    sprite.scale.set(2, 0.5, 1)
    sprite.renderOrder = 999
    return sprite
  }, [])

  const createDashedLine = useCallback((start: THREE.Vector3, end: THREE.Vector3) => {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end])
    const mat = new THREE.LineDashedMaterial({
      color: 0xffcc00,
      dashSize: 0.15,
      gapSize: 0.1,
      depthTest: false,
    })
    const line = new THREE.Line(geo, mat)
    line.computeLineDistances()
    line.renderOrder = 999
    return line
  }, [])

  const handleMeasureClick = useCallback((event: MouseEvent) => {
    const camera = cameraRef.current
    const group = modelGroupRef.current
    const scene = sceneRef.current
    const container = containerRef.current
    if (!camera || !group || !scene || !container) return

    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(group.children, true)
    if (intersects.length === 0) return

    const hit = intersects[0]
    const point: MeasurePoint = {
      position: hit.point.clone(),
      expressID: hit.object.userData.expressID ?? null,
    }

    if (!pendingPointRef.current) {
      // First point
      pendingPointRef.current = point
      const sphere = createSphere(point.position, 0x22c55e)
      scene.add(sphere)
      pendingMarkerRef.current = sphere
    } else {
      // Second point — complete measurement
      const pointA = pendingPointRef.current
      const pointB = point
      const distance = pointA.position.distanceTo(pointB.position)

      const visualGroup = new THREE.Group()
      visualGroup.userData.isMeasurement = true

      const sphereA = createSphere(pointA.position, 0x22c55e)
      const sphereB = createSphere(pointB.position, 0xef4444)
      const line = createDashedLine(pointA.position, pointB.position)
      const midpoint = new THREE.Vector3().lerpVectors(pointA.position, pointB.position, 0.5)
      midpoint.y += 0.3
      const label = createLabel(`${distance.toFixed(3)} m`, midpoint)

      visualGroup.add(sphereA, sphereB, line, label)
      scene.add(visualGroup)

      // Remove pending marker
      if (pendingMarkerRef.current) {
        scene.remove(pendingMarkerRef.current)
        pendingMarkerRef.current.geometry.dispose()
        ;(pendingMarkerRef.current.material as THREE.MeshBasicMaterial).dispose()
        pendingMarkerRef.current = null
      }

      const measurement: Measurement = {
        id: Date.now().toString(),
        pointA,
        pointB,
        distance,
        visualGroup,
      }
      measurementsRef.current.push(measurement)
      pendingPointRef.current = null
    }
  }, [cameraRef, modelGroupRef, sceneRef, containerRef, createSphere, createDashedLine, createLabel])

  const deleteMeasurement = useCallback((id: string) => {
    const scene = sceneRef.current
    if (!scene) return
    const idx = measurementsRef.current.findIndex((m) => m.id === id)
    if (idx === -1) return
    const m = measurementsRef.current[idx]
    m.visualGroup.traverse((obj) => {
      if (obj instanceof THREE.Mesh || obj instanceof THREE.Line) {
        obj.geometry.dispose()
        if (Array.isArray(obj.material)) obj.material.forEach((mt) => mt.dispose())
        else obj.material.dispose()
      }
      if (obj instanceof THREE.Sprite) {
        obj.material.map?.dispose()
        obj.material.dispose()
      }
    })
    scene.remove(m.visualGroup)
    measurementsRef.current.splice(idx, 1)
  }, [sceneRef])

  const clearAllMeasurements = useCallback(() => {
    const ids = measurementsRef.current.map((m) => m.id)
    ids.forEach(deleteMeasurement)
    // Also clean pending
    const scene = sceneRef.current
    if (pendingMarkerRef.current && scene) {
      scene.remove(pendingMarkerRef.current)
      pendingMarkerRef.current.geometry.dispose()
      ;(pendingMarkerRef.current.material as THREE.MeshBasicMaterial).dispose()
      pendingMarkerRef.current = null
    }
    pendingPointRef.current = null
  }, [deleteMeasurement, sceneRef])

  const cancelPending = useCallback(() => {
    const scene = sceneRef.current
    if (pendingMarkerRef.current && scene) {
      scene.remove(pendingMarkerRef.current)
      pendingMarkerRef.current.geometry.dispose()
      ;(pendingMarkerRef.current.material as THREE.MeshBasicMaterial).dispose()
      pendingMarkerRef.current = null
    }
    pendingPointRef.current = null
  }, [sceneRef])

  const getMeasurements = useCallback(() => {
    return measurementsRef.current.map((m) => ({
      id: m.id,
      distance: m.distance,
    }))
  }, [])

  const hasPendingPoint = useCallback(() => pendingPointRef.current !== null, [])

  return {
    handleMeasureClick,
    deleteMeasurement,
    clearAllMeasurements,
    cancelPending,
    getMeasurements,
    hasPendingPoint,
  }
}
