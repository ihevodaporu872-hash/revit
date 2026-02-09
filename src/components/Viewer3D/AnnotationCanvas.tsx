import { useEffect } from 'react'

interface AnnotationCanvasProps {
  canvasRef: React.RefObject<HTMLCanvasElement | null>
  active: boolean
  containerRef: React.RefObject<HTMLDivElement | null>
}

export function AnnotationCanvas({ canvasRef, active, containerRef }: AnnotationCanvasProps) {
  // Resize canvas to match container
  useEffect(() => {
    const resize = () => {
      const canvas = canvasRef.current
      const container = containerRef.current
      if (!canvas || !container) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const w = container.clientWidth
      const h = container.clientHeight

      if (canvas.width === w && canvas.height === h) return

      // Save current content
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const tempCanvas = document.createElement('canvas')
      tempCanvas.width = canvas.width
      tempCanvas.height = canvas.height
      tempCanvas.getContext('2d')?.putImageData(imageData, 0, 0)

      canvas.width = w
      canvas.height = h
      ctx.drawImage(tempCanvas, 0, 0)
    }

    resize()
    const observer = new ResizeObserver(resize)
    if (containerRef.current) observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [canvasRef, containerRef])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 z-[5]"
      style={{
        pointerEvents: active ? 'auto' : 'none',
        cursor: active ? 'crosshair' : 'default',
        touchAction: active ? 'none' : 'auto',
      }}
    />
  )
}
