import { useRef, useCallback, useEffect } from 'react'
import type { DrawingToolType } from './ifc/types'

interface UseAnnotationsParams {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  active: boolean
  tool: DrawingToolType
  color: string
  lineWidth: number
  fontSize: number
}

export function useAnnotations({ canvasRef, active, tool, color, lineWidth, fontSize }: UseAnnotationsParams) {
  const isDrawingRef = useRef(false)
  const undoStackRef = useRef<ImageData[]>([])
  const snapshotRef = useRef<ImageData | null>(null)
  const startPosRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 })
  const textInputRef = useRef<HTMLInputElement | null>(null)

  const getCtx = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.getContext('2d')
  }, [canvasRef])

  const pushUndo = useCallback(() => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    undoStackRef.current.push(data)
    if (undoStackRef.current.length > 20) undoStackRef.current.shift()
  }, [getCtx, canvasRef])

  const undo = useCallback(() => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    const stack = undoStackRef.current
    if (stack.length === 0) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    const prev = stack.pop()!
    ctx.putImageData(prev, 0, 0)
  }, [getCtx, canvasRef])

  const clearAll = useCallback(() => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    pushUndo()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  }, [getCtx, canvasRef, pushUndo])

  const getCanvasDataURL = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return null
    return canvas.toDataURL('image/png')
  }, [canvasRef])

  const restoreFromDataURL = useCallback((dataURL: string) => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (!ctx || !canvas) return
    const img = new Image()
    img.onload = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    }
    img.src = dataURL
  }, [getCtx, canvasRef])

  const hasAnnotations = useCallback(() => {
    const ctx = getCtx()
    const canvas = canvasRef.current
    if (!ctx || !canvas) return false
    const data = ctx.getImageData(0, 0, canvas.width, canvas.height)
    for (let i = 3; i < data.data.length; i += 4) {
      if (data.data[i] > 0) return true
    }
    return false
  }, [getCtx, canvasRef])

  // Draw arrow helper
  const drawArrow = useCallback((ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number) => {
    const headLen = Math.max(lineWidth * 4, 12)
    const angle = Math.atan2(y2 - y1, x2 - x1)
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6))
    ctx.moveTo(x2, y2)
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6))
    ctx.stroke()
  }, [lineWidth])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !active) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const getPos = (e: PointerEvent) => {
      const rect = canvas.getBoundingClientRect()
      return { x: e.clientX - rect.left, y: e.clientY - rect.top }
    }

    const handlePointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return

      if (tool === 'text') {
        const pos = getPos(e)
        // Create text input at click position
        if (textInputRef.current) textInputRef.current.remove()
        const input = document.createElement('input')
        input.type = 'text'
        input.style.cssText = `position:absolute;left:${pos.x}px;top:${pos.y}px;z-index:100;background:rgba(0,0,0,0.8);color:${color};border:1px solid ${color};padding:2px 6px;font-size:${fontSize}px;font-family:sans-serif;outline:none;border-radius:4px;min-width:80px;`
        canvas.parentElement?.appendChild(input)
        input.focus()
        textInputRef.current = input

        const commitText = () => {
          if (input.value.trim()) {
            pushUndo()
            ctx.font = `${fontSize}px sans-serif`
            ctx.fillStyle = color
            ctx.fillText(input.value, pos.x, pos.y + fontSize)
          }
          input.remove()
          textInputRef.current = null
        }
        input.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') commitText() })
        input.addEventListener('blur', commitText)
        return
      }

      isDrawingRef.current = true
      const pos = getPos(e)
      startPosRef.current = pos

      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.lineWidth = lineWidth

      if (tool === 'eraser') {
        ctx.globalCompositeOperation = 'destination-out'
        ctx.lineWidth = lineWidth * 3
      } else {
        ctx.globalCompositeOperation = 'source-over'
        ctx.strokeStyle = color
        ctx.fillStyle = color
      }

      if (tool === 'pen' || tool === 'eraser') {
        pushUndo()
        ctx.beginPath()
        ctx.moveTo(pos.x, pos.y)
      } else {
        // For shapes: snapshot before drawing
        snapshotRef.current = ctx.getImageData(0, 0, canvas.width, canvas.height)
        pushUndo()
      }
    }

    const handlePointerMove = (e: PointerEvent) => {
      if (!isDrawingRef.current) return
      const pos = getPos(e)

      if (tool === 'pen' || tool === 'eraser') {
        ctx.lineTo(pos.x, pos.y)
        ctx.stroke()
        return
      }

      // Restore snapshot for preview
      if (snapshotRef.current) {
        ctx.putImageData(snapshotRef.current, 0, 0)
      }

      const sx = startPosRef.current.x
      const sy = startPosRef.current.y
      ctx.globalCompositeOperation = 'source-over'
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = lineWidth
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'

      switch (tool) {
        case 'line':
          ctx.beginPath()
          ctx.moveTo(sx, sy)
          ctx.lineTo(pos.x, pos.y)
          ctx.stroke()
          break
        case 'rectangle':
          ctx.beginPath()
          ctx.strokeRect(sx, sy, pos.x - sx, pos.y - sy)
          break
        case 'circle': {
          const rx = Math.abs(pos.x - sx) / 2
          const ry = Math.abs(pos.y - sy) / 2
          const cx = sx + (pos.x - sx) / 2
          const cy = sy + (pos.y - sy) / 2
          ctx.beginPath()
          ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2)
          ctx.stroke()
          break
        }
        case 'arrow':
          drawArrow(ctx, sx, sy, pos.x, pos.y)
          break
      }
    }

    const handlePointerUp = () => {
      if (!isDrawingRef.current) return
      isDrawingRef.current = false
      ctx.globalCompositeOperation = 'source-over'
      snapshotRef.current = null
    }

    canvas.addEventListener('pointerdown', handlePointerDown)
    canvas.addEventListener('pointermove', handlePointerMove)
    canvas.addEventListener('pointerup', handlePointerUp)
    canvas.addEventListener('pointerleave', handlePointerUp)

    return () => {
      canvas.removeEventListener('pointerdown', handlePointerDown)
      canvas.removeEventListener('pointermove', handlePointerMove)
      canvas.removeEventListener('pointerup', handlePointerUp)
      canvas.removeEventListener('pointerleave', handlePointerUp)
    }
  }, [canvasRef, active, tool, color, lineWidth, fontSize, pushUndo, drawArrow])

  return { undo, clearAll, getCanvasDataURL, restoreFromDataURL, hasAnnotations }
}
