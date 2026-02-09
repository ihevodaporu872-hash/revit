import { useRef, useCallback, useEffect } from 'react'
import * as THREE from 'three'

interface UseBoxSelectParams {
  containerRef: React.RefObject<HTMLDivElement | null>
  cameraRef: React.RefObject<THREE.PerspectiveCamera | null>
  modelGroupRef: React.RefObject<THREE.Group | null>
  enabled: boolean
  onSelect: (ids: number[], additive: boolean) => void
}

interface DragRect {
  startX: number; startY: number; endX: number; endY: number
}

export function useBoxSelect({ containerRef, cameraRef, modelGroupRef, enabled, onSelect }: UseBoxSelectParams) {
  const isDraggingRef = useRef(false)
  const dragRectRef = useRef<DragRect | null>(null)
  const startScreenRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const overlayRef = useRef<HTMLDivElement | null>(null)

  const DRAG_THRESHOLD = 5

  const updateOverlay = useCallback(() => {
    if (!overlayRef.current || !dragRectRef.current) return
    const r = dragRectRef.current
    const left = Math.min(r.startX, r.endX)
    const top = Math.min(r.startY, r.endY)
    const w = Math.abs(r.endX - r.startX)
    const h = Math.abs(r.endY - r.startY)
    overlayRef.current.style.left = `${left}px`
    overlayRef.current.style.top = `${top}px`
    overlayRef.current.style.width = `${w}px`
    overlayRef.current.style.height = `${h}px`
    overlayRef.current.style.display = 'block'
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || !enabled) return

    // Create overlay element
    const overlay = document.createElement('div')
    overlay.style.cssText = 'position:absolute;border:1.5px solid hsl(217.2 91.2% 59.8%);background:hsl(217.2 91.2% 59.8% / 0.08);pointer-events:none;display:none;z-index:15;border-radius:2px;'
    container.appendChild(overlay)
    overlayRef.current = overlay

    const handleMouseDown = (e: MouseEvent) => {
      if (e.button !== 0) return
      const rect = container.getBoundingClientRect()
      startScreenRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top }
      isDraggingRef.current = false
      dragRectRef.current = null
    }

    const handleMouseMove = (e: MouseEvent) => {
      if (e.buttons !== 1) return
      const rect = container.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top
      const dx = x - startScreenRef.current.x
      const dy = y - startScreenRef.current.y

      if (!isDraggingRef.current && Math.sqrt(dx * dx + dy * dy) > DRAG_THRESHOLD) {
        isDraggingRef.current = true
      }

      if (isDraggingRef.current) {
        dragRectRef.current = {
          startX: startScreenRef.current.x,
          startY: startScreenRef.current.y,
          endX: x,
          endY: y,
        }
        updateOverlay()
      }
    }

    const handleMouseUp = (e: MouseEvent) => {
      if (!isDraggingRef.current || !dragRectRef.current) {
        isDraggingRef.current = false
        overlay.style.display = 'none'
        return
      }

      const camera = cameraRef.current
      const group = modelGroupRef.current
      const rect = container.getBoundingClientRect()

      if (!camera || !group) {
        isDraggingRef.current = false
        overlay.style.display = 'none'
        dragRectRef.current = null
        return
      }

      const dr = dragRectRef.current
      const minX = Math.min(dr.startX, dr.endX) / rect.width * 2 - 1
      const maxX = Math.max(dr.startX, dr.endX) / rect.width * 2 - 1
      const minY = -(Math.max(dr.startY, dr.endY) / rect.height * 2 - 1)
      const maxY = -(Math.min(dr.startY, dr.endY) / rect.height * 2 - 1)

      const selectedIds: number[] = []
      group.traverse((obj) => {
        if (!(obj instanceof THREE.Mesh) || obj.userData.expressID === undefined) return
        const worldPos = new THREE.Vector3()
        obj.getWorldPosition(worldPos)
        const ndc = worldPos.project(camera)
        if (ndc.x >= minX && ndc.x <= maxX && ndc.y >= minY && ndc.y <= maxY && ndc.z >= -1 && ndc.z <= 1) {
          selectedIds.push(obj.userData.expressID)
        }
      })

      if (selectedIds.length > 0) {
        onSelect(selectedIds, e.shiftKey)
      }

      isDraggingRef.current = false
      overlay.style.display = 'none'
      dragRectRef.current = null
    }

    container.addEventListener('mousedown', handleMouseDown)
    container.addEventListener('mousemove', handleMouseMove)
    container.addEventListener('mouseup', handleMouseUp)

    return () => {
      container.removeEventListener('mousedown', handleMouseDown)
      container.removeEventListener('mousemove', handleMouseMove)
      container.removeEventListener('mouseup', handleMouseUp)
      if (container.contains(overlay)) container.removeChild(overlay)
      overlayRef.current = null
    }
  }, [containerRef, cameraRef, modelGroupRef, enabled, onSelect, updateOverlay])

  const isDragging = useCallback(() => isDraggingRef.current, [])

  return { isDragging }
}
