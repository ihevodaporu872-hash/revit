import { useRef, useCallback } from 'react'
import * as THREE from 'three'
import type { MeasurePoint, Measurement, MeasureMode, AreaMeasurement } from './ifc/types'

interface UseMeasureToolParams {
  sceneRef: React.RefObject<THREE.Scene | null>
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>
  modelGroupRef: React.RefObject<THREE.Group | null>
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function useMeasureTool({ sceneRef, cameraRef, modelGroupRef, containerRef }: UseMeasureToolParams) {
  const measurementsRef = useRef<Measurement[]>([])
  const areaMeasurementsRef = useRef<AreaMeasurement[]>([])
  const pendingPointRef = useRef<MeasurePoint | null>(null)
  const pendingMarkerRef = useRef<THREE.Mesh | null>(null)
  const modeRef = useRef<MeasureMode>('distance')

  // Area mode state
  const areaPointsRef = useRef<MeasurePoint[]>([])
  const areaMarkersRef = useRef<THREE.Group>(new THREE.Group())
  const areaPreviewLineRef = useRef<THREE.Line | null>(null)

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
      color: 0x7dd3fc,
      dashSize: 0.15,
      gapSize: 0.1,
      depthTest: false,
    })
    const line = new THREE.Line(geo, mat)
    line.computeLineDistances()
    line.renderOrder = 999
    return line
  }, [])

  // Calculate area of 3D polygon using Newell's method
  const calculatePolygonArea = useCallback((points: THREE.Vector3[]): number => {
    if (points.length < 3) return 0
    const normal = new THREE.Vector3()
    for (let i = 0; i < points.length; i++) {
      const curr = points[i]
      const next = points[(i + 1) % points.length]
      normal.x += (curr.y - next.y) * (curr.z + next.z)
      normal.y += (curr.z - next.z) * (curr.x + next.x)
      normal.z += (curr.x - next.x) * (curr.y + next.y)
    }
    return normal.length() / 2
  }, [])

  const raycastPoint = useCallback((event: MouseEvent): MeasurePoint | null => {
    const camera = cameraRef.current
    const group = modelGroupRef.current
    const container = containerRef.current
    if (!camera || !group || !container) return null

    const rect = container.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    )

    const raycaster = new THREE.Raycaster()
    raycaster.setFromCamera(mouse, camera)
    const intersects = raycaster.intersectObjects(group.children, true)
    if (intersects.length === 0) return null

    const hit = intersects[0]
    return {
      position: hit.point.clone(),
      expressID: hit.object.userData.expressID ?? null,
    }
  }, [cameraRef, modelGroupRef, containerRef])

  // ── Distance mode click ─────────────────────────────────
  const handleDistanceClick = useCallback((event: MouseEvent) => {
    const scene = sceneRef.current
    if (!scene) return

    const point = raycastPoint(event)
    if (!point) return

    if (!pendingPointRef.current) {
      pendingPointRef.current = point
      const sphere = createSphere(point.position, 0x38bdf8)
      scene.add(sphere)
      pendingMarkerRef.current = sphere
    } else {
      const pointA = pendingPointRef.current
      const pointB = point
      const distance = pointA.position.distanceTo(pointB.position)

      const visualGroup = new THREE.Group()
      visualGroup.userData.isMeasurement = true

      const sphereA = createSphere(pointA.position, 0x38bdf8)
      const sphereB = createSphere(pointB.position, 0x0ea5e9)
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
  }, [sceneRef, raycastPoint, createSphere, createDashedLine, createLabel])

  // ── Area mode click ─────────────────────────────────────
  const handleAreaClick = useCallback((event: MouseEvent) => {
    const scene = sceneRef.current
    if (!scene) return

    const point = raycastPoint(event)
    if (!point) return

    const points = areaPointsRef.current

    // Check if clicking near first point to close polygon
    if (points.length >= 3) {
      const firstPos = points[0].position
      const dist = point.position.distanceTo(firstPos)
      if (dist < 0.3) {
        // Close polygon — create area measurement
        completeAreaMeasurement()
        return
      }
    }

    // Add point
    points.push(point)

    // Add visual marker
    const sphere = createSphere(point.position, 0x38bdf8)
    areaMarkersRef.current.add(sphere)
    if (areaMarkersRef.current.parent !== scene) {
      scene.add(areaMarkersRef.current)
    }

    // Draw edge line from previous point
    if (points.length > 1) {
      const prev = points[points.length - 2].position
      const line = createDashedLine(prev, point.position)
      areaMarkersRef.current.add(line)
    }
  }, [sceneRef, raycastPoint, createSphere, createDashedLine])

  const handleAreaDoubleClick = useCallback(() => {
    if (areaPointsRef.current.length >= 3) {
      completeAreaMeasurement()
    }
  }, [])

  const completeAreaMeasurement = useCallback(() => {
    const scene = sceneRef.current
    if (!scene) return
    const points = areaPointsRef.current
    if (points.length < 3) return

    // Remove preview markers
    scene.remove(areaMarkersRef.current)
    disposeGroup(areaMarkersRef.current)
    areaMarkersRef.current = new THREE.Group()

    // Build final visual
    const visualGroup = new THREE.Group()
    visualGroup.userData.isAreaMeasurement = true

    const positions = points.map(p => p.position)

    // Draw polygon edges
    for (let i = 0; i < positions.length; i++) {
      const next = (i + 1) % positions.length
      const line = createDashedLine(positions[i], positions[next])
      visualGroup.add(line)
      const sphere = createSphere(positions[i], 0x38bdf8)
      visualGroup.add(sphere)
    }

    // Create semi-transparent fill
    const shape = new THREE.Shape()
    // Project to a local 2D plane for fill
    const normal = new THREE.Vector3()
    for (let i = 0; i < positions.length; i++) {
      const curr = positions[i]
      const next = positions[(i + 1) % positions.length]
      normal.x += (curr.y - next.y) * (curr.z + next.z)
      normal.y += (curr.z - next.z) * (curr.x + next.x)
      normal.z += (curr.x - next.x) * (curr.y + next.y)
    }
    normal.normalize()

    // Build rotation to flatten polygon
    const up = new THREE.Vector3(0, 0, 1)
    const quat = new THREE.Quaternion().setFromUnitVectors(normal, up)
    const center = new THREE.Vector3()
    positions.forEach(p => center.add(p))
    center.divideScalar(positions.length)

    const flat2D = positions.map(p => {
      const v = p.clone().sub(center).applyQuaternion(quat)
      return new THREE.Vector2(v.x, v.y)
    })

    shape.moveTo(flat2D[0].x, flat2D[0].y)
    for (let i = 1; i < flat2D.length; i++) {
      shape.lineTo(flat2D[i].x, flat2D[i].y)
    }
    shape.closePath()

    const shapeGeo = new THREE.ShapeGeometry(shape)
    const shapeMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthTest: false,
    })
    const shapeMesh = new THREE.Mesh(shapeGeo, shapeMat)
    // Rotate back to world space
    const quatInv = quat.clone().invert()
    shapeMesh.quaternion.copy(quatInv)
    shapeMesh.position.copy(center)
    shapeMesh.renderOrder = 998
    visualGroup.add(shapeMesh)

    // Calculate area and add label
    const area = calculatePolygonArea(positions)
    const labelPos = center.clone()
    labelPos.y += 0.4
    const label = createLabel(`${area.toFixed(3)} m²`, labelPos)
    visualGroup.add(label)

    scene.add(visualGroup)

    const areaMeasurement: AreaMeasurement = {
      id: Date.now().toString(),
      points: [...points],
      area,
      visualGroup,
    }
    areaMeasurementsRef.current.push(areaMeasurement)

    // Reset area drawing state
    areaPointsRef.current = []
    if (areaPreviewLineRef.current) {
      scene.remove(areaPreviewLineRef.current)
      areaPreviewLineRef.current = null
    }
  }, [sceneRef, createDashedLine, createSphere, createLabel, calculatePolygonArea])

  // ── Unified click handler ─────────────────────────────
  const handleMeasureClick = useCallback((event: MouseEvent) => {
    if (modeRef.current === 'distance') {
      handleDistanceClick(event)
    } else {
      handleAreaClick(event)
    }
  }, [handleDistanceClick, handleAreaClick])

  const handleMeasureDoubleClick = useCallback((event: MouseEvent) => {
    if (modeRef.current === 'area') {
      event.preventDefault()
      handleAreaDoubleClick()
    }
  }, [handleAreaDoubleClick])

  const deleteMeasurement = useCallback((id: string) => {
    const scene = sceneRef.current
    if (!scene) return
    const idx = measurementsRef.current.findIndex((m) => m.id === id)
    if (idx !== -1) {
      const m = measurementsRef.current[idx]
      disposeGroup(m.visualGroup)
      scene.remove(m.visualGroup)
      measurementsRef.current.splice(idx, 1)
      return
    }
    const aIdx = areaMeasurementsRef.current.findIndex((m) => m.id === id)
    if (aIdx !== -1) {
      const m = areaMeasurementsRef.current[aIdx]
      disposeGroup(m.visualGroup)
      scene.remove(m.visualGroup)
      areaMeasurementsRef.current.splice(aIdx, 1)
    }
  }, [sceneRef])

  const clearAllMeasurements = useCallback(() => {
    const allIds = [
      ...measurementsRef.current.map((m) => m.id),
      ...areaMeasurementsRef.current.map((m) => m.id),
    ]
    allIds.forEach(deleteMeasurement)
    // Also clean pending
    const scene = sceneRef.current
    if (pendingMarkerRef.current && scene) {
      scene.remove(pendingMarkerRef.current)
      pendingMarkerRef.current.geometry.dispose()
      ;(pendingMarkerRef.current.material as THREE.MeshBasicMaterial).dispose()
      pendingMarkerRef.current = null
    }
    pendingPointRef.current = null
    // Clean area pending
    if (scene) {
      scene.remove(areaMarkersRef.current)
      disposeGroup(areaMarkersRef.current)
      areaMarkersRef.current = new THREE.Group()
    }
    areaPointsRef.current = []
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
    // Cancel area pending too
    if (scene) {
      scene.remove(areaMarkersRef.current)
      disposeGroup(areaMarkersRef.current)
      areaMarkersRef.current = new THREE.Group()
    }
    areaPointsRef.current = []
  }, [sceneRef])

  const getMeasurements = useCallback(() => {
    return [
      ...measurementsRef.current.map((m) => ({
        id: m.id,
        distance: m.distance,
        type: 'distance' as const,
      })),
      ...areaMeasurementsRef.current.map((m) => ({
        id: m.id,
        distance: m.area,
        type: 'area' as const,
      })),
    ]
  }, [])

  const hasPendingPoint = useCallback(() => pendingPointRef.current !== null || areaPointsRef.current.length > 0, [])

  const setMode = useCallback((mode: MeasureMode) => {
    // Cancel any pending state when switching modes
    cancelPending()
    modeRef.current = mode
  }, [cancelPending])

  const getMode = useCallback(() => modeRef.current, [])

  return {
    handleMeasureClick,
    handleMeasureDoubleClick,
    deleteMeasurement,
    clearAllMeasurements,
    cancelPending,
    getMeasurements,
    hasPendingPoint,
    setMode,
    getMode,
  }
}

function disposeGroup(group: THREE.Group) {
  group.traverse((obj) => {
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
}
