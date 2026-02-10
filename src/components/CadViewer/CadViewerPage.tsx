import { useEffect, useRef, useState, useCallback, type DragEvent } from 'react'
import type {
  AcApDocManager as AcApDocManagerType,
  AcApDocManagerOptions,
  AcEdViewHoverEventArgs,
} from '@mlightcad/cad-simple-viewer'
import type { AcDbEntity, AcDbObjectId, AcGiLineWeight } from '@mlightcad/data-model'
import { MotionPage } from '../MotionPage'
import { Button } from '../ui/Button'
import {
  Upload,
  Loader2,
  FileUp,
  Move,
  ZoomIn,
  Maximize,
  SquareDashedMousePointer,
  Undo2,
  RefreshCw,
  AlertCircle,
  Info,
  X,
} from 'lucide-react'

/* ── Helpers ────────────────────────────────────────────── */

const SUPPORTED_EXTENSIONS = ['.dwg', '.dxf']
const DWG_MAGIC = new Uint8Array([0x41, 0x43]) // "AC"

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase()
    if (msg.includes('wasm') || msg.includes('webassembly'))
      return 'Failed to load WebAssembly module. Please refresh the page or try a different browser.'
    if (msg.includes('memory') || msg.includes('heap'))
      return 'Not enough memory to load this file. Try a smaller CAD file.'
    if (msg.includes('invalid') || msg.includes('parse') || msg.includes('syntax'))
      return 'Invalid CAD file format. Please check that the file is a valid DWG or DXF file.'
    if (msg.includes('network') || msg.includes('fetch'))
      return 'Network error. Please check your internet connection.'
    if (msg.includes('timeout'))
      return 'Loading timed out. The file may be too large or the connection is slow.'
    if (msg.includes('worker'))
      return 'CAD parser worker failed to load. Worker files may be missing from /assets/.'
    return error.message
  }
  return 'An unexpected error occurred. Please try again.'
}

function isValidCadFile(fileName: string): boolean {
  return SUPPORTED_EXTENSIONS.some((ext) => fileName.toLowerCase().endsWith(ext))
}

function validateDwgHeader(buffer: ArrayBuffer): { valid: boolean; version?: string } {
  if (buffer.byteLength < 6) return { valid: false }
  const header = new Uint8Array(buffer, 0, 6)
  if (header[0] !== DWG_MAGIC[0] || header[1] !== DWG_MAGIC[1]) return { valid: false }
  return { valid: true, version: String.fromCharCode(...header) }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}

/* ── Geometry helpers for length / area ──────────────────── */

function dist3d(a: { x: number; y: number; z: number }, b: { x: number; y: number; z: number }): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
}

function computeEntityMetrics(entity: AcDbEntity): { length?: number; area?: number } {
  const t = entity.type
  try {
    if (t === 'Line') {
      const e = entity as unknown as { startPoint: { x: number; y: number; z: number }; endPoint: { x: number; y: number; z: number } }
      return { length: dist3d(e.startPoint, e.endPoint) }
    }
    if (t === 'Circle') {
      const e = entity as unknown as { radius: number }
      return { length: 2 * Math.PI * e.radius, area: Math.PI * e.radius ** 2 }
    }
    if (t === 'Arc') {
      const e = entity as unknown as { radius: number; startAngle: number; endAngle: number }
      let angle = e.endAngle - e.startAngle
      if (angle < 0) angle += 2 * Math.PI
      return { length: e.radius * angle }
    }
    if (t === 'Polyline') {
      const e = entity as unknown as { numberOfVertices: number; closed: boolean; getPoint3dAt(i: number): { x: number; y: number; z: number } }
      let length = 0
      for (let i = 1; i < e.numberOfVertices; i++) {
        length += dist3d(e.getPoint3dAt(i - 1), e.getPoint3dAt(i))
      }
      if (e.closed && e.numberOfVertices > 2) {
        length += dist3d(e.getPoint3dAt(e.numberOfVertices - 1), e.getPoint3dAt(0))
      }
      // Approximate area for closed polylines using the shoelace formula (2D)
      let area: number | undefined
      if (e.closed && e.numberOfVertices >= 3) {
        let sum = 0
        for (let i = 0; i < e.numberOfVertices; i++) {
          const curr = e.getPoint3dAt(i)
          const next = e.getPoint3dAt((i + 1) % e.numberOfVertices)
          sum += curr.x * next.y - next.x * curr.y
        }
        area = Math.abs(sum) / 2
      }
      return { length, area }
    }
    if (t === 'Ellipse') {
      const e = entity as unknown as { center: { x: number; y: number; z: number }; radiusRatio: number; majorAxis: { x: number; y: number; z: number }; startAngle: number; endAngle: number; closed: boolean }
      const a = Math.sqrt(e.majorAxis.x ** 2 + e.majorAxis.y ** 2 + e.majorAxis.z ** 2)
      const b = a * e.radiusRatio
      // Ramanujan approximation for circumference
      const circumference = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)))
      if (e.closed) {
        return { length: circumference, area: Math.PI * a * b }
      }
      let angle = e.endAngle - e.startAngle
      if (angle < 0) angle += 2 * Math.PI
      return { length: circumference * (angle / (2 * Math.PI)) }
    }
  } catch {
    // Silently ignore errors from accessing entity properties
  }
  return {}
}

/** Pick a line weight 3× heavier (in 100ths mm). Minimum visual bump to 50. */
const LINEWEIGHT_VALUES = [0, 5, 9, 13, 15, 18, 20, 25, 30, 35, 40, 50, 53, 60, 70, 80, 90, 100, 106, 120, 140, 158, 200, 211]

function tripleLineWeight(lw: number): number {
  // Negative values = ByLayer/ByBlock/default — use a thick fallback
  if (lw <= 0) return 60  // 0.6 mm — clearly visible
  const target = lw * 3
  // Find nearest available weight
  let best = LINEWEIGHT_VALUES[LINEWEIGHT_VALUES.length - 1]
  for (const v of LINEWEIGHT_VALUES) {
    if (v >= target) { best = v; break }
  }
  return best
}

/* ── Property panel data ────────────────────────────────── */

interface HoveredEntityInfo {
  id: AcDbObjectId
  type: string
  layer: string
  length?: number
  area?: number
  properties: { groupName: string; props: { label: string; value: string }[] }[]
}

function extractEntityInfo(entity: AcDbEntity, id: AcDbObjectId): HoveredEntityInfo {
  const metrics = computeEntityMetrics(entity)
  const properties: HoveredEntityInfo['properties'] = []

  try {
    const ep = entity.properties
    for (const group of ep.groups) {
      const props: { label: string; value: string }[] = []
      for (const p of group.properties) {
        try {
          const val = p.accessor.get()
          const str = val === null || val === undefined ? '—' : typeof val === 'object' ? JSON.stringify(val) : String(val)
          props.push({ label: p.name, value: str })
        } catch {
          // skip unreadable prop
        }
      }
      if (props.length > 0) {
        properties.push({ groupName: group.groupName, props })
      }
    }
  } catch {
    // Entity might not support properties API
  }

  return {
    id,
    type: entity.type,
    layer: entity.layer || '0',
    length: metrics.length,
    area: metrics.area,
    properties,
  }
}

function formatNum(n: number): string {
  return n < 0.01 ? n.toExponential(2) : n.toFixed(2)
}

/* ── Component ──────────────────────────────────────────── */

export default function CadViewerPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const docManagerRef = useRef<AcApDocManagerType | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Loading...')
  const [error, setError] = useState<string | null>(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)
  const [hoveredInfo, setHoveredInfo] = useState<HoveredEntityInfo | null>(null)
  const [panelOpen, setPanelOpen] = useState(true)

  // Store original lineWeight to restore on unhover
  const hoverStateRef = useRef<{ id: AcDbObjectId; entity: AcDbEntity; origLw: AcGiLineWeight } | null>(null)

  /* ── Hover handler ───────────────────────────────────── */

  const handleHover = useCallback((args: AcEdViewHoverEventArgs) => {
    const mgr = docManagerRef.current
    if (!mgr) return

    try {
      const db = mgr.curDocument.database
      const entity = db.tables.blockTable.getEntityById(args.id)
      if (!entity) return

      // Extract info for panel
      const info = extractEntityInfo(entity, args.id)
      setHoveredInfo(info)

      // Highlight with built-in method
      mgr.curView.highlight([args.id])

      // Apply 3× line weight
      const origLw = entity.lineWeight
      const thickLw = tripleLineWeight(origLw as number) as unknown as AcGiLineWeight
      entity.lineWeight = thickLw
      mgr.curView.updateEntity(entity)

      hoverStateRef.current = { id: args.id, entity, origLw }
    } catch (err) {
      console.warn('[CadViewer] hover error:', err)
    }
  }, [])

  const handleUnhover = useCallback((args: AcEdViewHoverEventArgs) => {
    const mgr = docManagerRef.current
    if (!mgr) return

    try {
      // Unhighlight
      mgr.curView.unhighlight([args.id])

      // Restore original lineWeight
      const state = hoverStateRef.current
      if (state && state.id === args.id) {
        state.entity.lineWeight = state.origLw
        mgr.curView.updateEntity(state.entity)
        hoverStateRef.current = null
      }

      setHoveredInfo(null)
    } catch (err) {
      console.warn('[CadViewer] unhover error:', err)
    }
  }, [])

  /* ── Viewer init ───────────────────────────────────────── */

  useEffect(() => {
    let destroyed = false

    const init = async () => {
      if (!containerRef.current) return
      try {
        setIsLoading(true)
        setLoadingMessage('Initializing CAD viewer...')
        setError(null)

        const { AcApDocManager } = await import('@mlightcad/cad-simple-viewer')
        if (destroyed) return

        const mgr = AcApDocManager.createInstance({
          container: containerRef.current,
          autoResize: true,
        } as AcApDocManagerOptions)

        if (mgr) {
          docManagerRef.current = mgr

          // Subscribe to hover events
          mgr.curView.events.hover.addEventListener(handleHover)
          mgr.curView.events.unhover.addEventListener(handleUnhover)

          setViewerReady(true)
        } else {
          setError('Failed to create CAD viewer instance. Please refresh the page.')
        }
        setIsLoading(false)
      } catch (err) {
        if (destroyed) return
        console.error('Failed to initialize CAD viewer:', err)
        setError(getErrorMessage(err))
        setIsLoading(false)
      }
    }

    init()

    return () => {
      destroyed = true
      if (docManagerRef.current) {
        const mgr = docManagerRef.current
        mgr.curView.events.hover.removeEventListener(handleHover)
        mgr.curView.events.unhover.removeEventListener(handleUnhover)

        // Restore lineWeight if unmounting while hovered
        if (hoverStateRef.current) {
          try {
            hoverStateRef.current.entity.lineWeight = hoverStateRef.current.origLw
          } catch { /* ignore */ }
          hoverStateRef.current = null
        }

        mgr.destroy()
        docManagerRef.current = null
      }
    }
  }, [handleHover, handleUnhover])

  /* ── File processing ───────────────────────────────────── */

  const processFile = useCallback(async (file: File) => {
    if (!docManagerRef.current) {
      setError('Viewer not initialized. Please wait and try again.')
      return
    }
    if (!isValidCadFile(file.name)) {
      setError('Unsupported file format. Please use DWG or DXF files.')
      return
    }

    setIsLoading(true)
    setLoadingMessage(`Loading ${file.name}...`)
    setError(null)

    try {
      const arrayBuffer = await file.arrayBuffer()

      if (file.name.toLowerCase().endsWith('.dwg')) {
        const { valid, version } = validateDwgHeader(arrayBuffer)
        if (!valid) {
          setError('Invalid DWG file: file header is missing or corrupted.')
          setFileInfo(null)
          setIsLoading(false)
          return
        }
        console.log(`[CadViewer] DWG version: ${version}, size: ${file.size} bytes`)
      }

      const success = await docManagerRef.current.openDocument(file.name, arrayBuffer, {})

      if (success) {
        setFileInfo({ name: file.name, size: file.size })
      } else {
        setError('Failed to open the CAD file. The parser could not process this file format.')
        setFileInfo(null)
      }
      setIsLoading(false)
    } catch (err) {
      console.error('[CadViewer] Failed to load file:', file.name, err)
      setError(getErrorMessage(err))
      setFileInfo(null)
      setIsLoading(false)
    }
  }, [])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    await processFile(file)
    event.target.value = ''
  }

  /* ── Drag & drop ───────────────────────────────────────── */

  const handleDragEnter = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      if (viewerReady && !isLoading) setIsDragging(true)
    },
    [viewerReady, isLoading],
  )

  const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.currentTarget === e.target) setIsDragging(false)
  }, [])

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)
      if (!viewerReady || isLoading) return
      const files = e.dataTransfer.files
      if (files.length === 0) return
      await processFile(files[0])
    },
    [viewerReady, isLoading, processFile],
  )

  /* ── Navigation controls ───────────────────────────────── */

  const handlePan = useCallback(() => {
    docManagerRef.current?.sendStringToExecute('pan')
  }, [])
  const handleZoomIn = useCallback(() => {
    docManagerRef.current?.sendStringToExecute('zoom')
  }, [])
  const handleZoomWindow = useCallback(() => {
    docManagerRef.current?.sendStringToExecute('zoom w')
  }, [])
  const handleZoomFit = useCallback(() => {
    docManagerRef.current?.curView?.zoomToFitDrawing()
  }, [])
  const handleZoomPrevious = useCallback(() => {
    docManagerRef.current?.sendStringToExecute('zoom p')
  }, [])
  const handleRegen = useCallback(() => {
    docManagerRef.current?.regen()
  }, [])

  /* ── Render ────────────────────────────────────────────── */

  return (
    <MotionPage>
      <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--card-glow)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {fileInfo ? fileInfo.name : 'CAD Viewer'}
            </h2>
            <p className="text-xs text-muted-foreground">
              View DWG/DXF files — powered by mlightcad
            </p>
            {fileInfo && (
              <div className="mt-1 flex items-center gap-3 text-xs">
                <span className="max-w-[200px] truncate font-medium text-foreground" title={fileInfo.name}>
                  {fileInfo.name}
                </span>
                <span className="border-l border-border pl-3 text-muted-foreground">
                  {formatFileSize(fileInfo.size)}
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {viewerReady && fileInfo && (
              <>
                <div className="flex items-center gap-1">
                  <Button variant="outline" size="sm" onClick={handlePan} disabled={isLoading} title="Pan">
                    <Move size={14} className="mr-1" /> Pan
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomIn} disabled={isLoading} title="Zoom">
                    <ZoomIn size={14} className="mr-1" /> Zoom
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomWindow} disabled={isLoading} title="Zoom Window">
                    <SquareDashedMousePointer size={14} className="mr-1" /> Window
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomFit} disabled={isLoading} title="Fit to view">
                    <Maximize size={14} className="mr-1" /> Fit
                  </Button>
                  <Button variant="outline" size="sm" onClick={handleZoomPrevious} disabled={isLoading} title="Previous view">
                    <Undo2 size={14} className="mr-1" /> Previous
                  </Button>
                </div>
                <div className="mx-1 h-6 w-px bg-border" />
                <Button variant="outline" size="sm" onClick={handleRegen} disabled={isLoading} title="Regenerate">
                  <RefreshCw size={14} className="mr-1" /> Regen
                </Button>
                <Button
                  variant={panelOpen ? 'primary' : 'outline'}
                  size="sm"
                  onClick={() => setPanelOpen((v) => !v)}
                  title="Properties panel"
                >
                  <Info size={14} className="mr-1" /> Properties
                </Button>
              </>
            )}

            <label className="inline-flex cursor-pointer">
              <span className="sr-only">Upload DWG/DXF</span>
              <Button
                variant="primary"
                size="sm"
                icon={<Upload size={14} />}
                disabled={!viewerReady || isLoading}
                className="pointer-events-none"
              >
                Upload DWG/DXF
              </Button>
              <input
                type="file"
                accept=".dwg,.dxf"
                onChange={handleFileUpload}
                disabled={!viewerReady || isLoading}
                className="hidden"
                data-testid="cad-file-input"
              />
            </label>
          </div>
        </div>

        {/* Viewer area + Properties side panel */}
        <div className="flex min-h-0 flex-1">
          {/* CAD canvas */}
          <div
            className={`relative flex min-h-0 min-w-0 flex-1 flex-col ${isDragging ? 'ring-2 ring-inset ring-primary' : ''}`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            <div ref={containerRef} className="min-h-0 flex-1 overflow-hidden" />

            {/* Loading overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90">
                <Loader2 size={40} className="mb-3 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">{loadingMessage}</p>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90">
                <AlertCircle size={48} className="mb-3 text-destructive" />
                <p className="mb-1 text-sm font-medium text-destructive">Error</p>
                <p className="max-w-md px-4 text-center text-sm text-muted-foreground">{error}</p>
                <Button variant="outline" size="sm" className="mt-4" onClick={() => setError(null)}>
                  Dismiss
                </Button>
              </div>
            )}

            {/* Initializing overlay */}
            {!viewerReady && !isLoading && !error && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90">
                <Loader2 size={40} className="mb-3 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">Initializing CAD viewer...</p>
              </div>
            )}

            {/* Empty state */}
            {viewerReady && !fileInfo && !isLoading && !error && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90">
                <FileUp size={64} className="mb-4 text-muted-foreground/40" />
                <p className="mb-1 text-base font-medium text-foreground">Drop a CAD file here</p>
                <p className="mb-1 text-sm text-muted-foreground">
                  or click "Upload DWG/DXF" button above
                </p>
                <p className="text-xs text-muted-foreground/60">Supported formats: DWG, DXF</p>
              </div>
            )}

            {/* Drag overlay */}
            {isDragging && (
              <div className="absolute inset-0 z-20 flex flex-col items-center justify-center border-2 border-dashed border-primary bg-primary/10">
                <Upload size={64} className="mb-3 text-primary" />
                <p className="text-base font-medium text-primary">Drop to load file</p>
              </div>
            )}
          </div>

          {/* Properties side panel */}
          {panelOpen && fileInfo && (
            <div className="flex w-72 shrink-0 flex-col border-l border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <h3 className="text-sm font-semibold text-foreground">Properties</h3>
                <button
                  onClick={() => setPanelOpen(false)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto px-4 py-3">
                {hoveredInfo ? (
                  <div className="space-y-4">
                    {/* Entity type badge */}
                    <div>
                      <span className="inline-block rounded bg-primary/15 px-2 py-0.5 text-xs font-semibold text-primary">
                        {hoveredInfo.type}
                      </span>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Layer: <span className="font-medium text-foreground">{hoveredInfo.layer}</span>
                      </p>
                    </div>

                    {/* Length / Area summary */}
                    {(hoveredInfo.length !== undefined || hoveredInfo.area !== undefined) && (
                      <div className="rounded-lg border border-border bg-muted/30 p-3">
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Summary</p>
                        {hoveredInfo.length !== undefined && (
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Length</span>
                            <span className="font-mono font-medium text-foreground">{formatNum(hoveredInfo.length)}</span>
                          </div>
                        )}
                        {hoveredInfo.area !== undefined && (
                          <div className="mt-1 flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">Area</span>
                            <span className="font-mono font-medium text-foreground">{formatNum(hoveredInfo.area)}</span>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Full properties */}
                    {hoveredInfo.properties.map((group) => (
                      <div key={group.groupName}>
                        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                          {group.groupName}
                        </p>
                        <div className="space-y-1">
                          {group.props.map((p) => (
                            <div key={p.label} className="flex items-start justify-between gap-2 text-xs">
                              <span className="shrink-0 text-muted-foreground">{p.label}</span>
                              <span className="truncate text-right font-mono text-foreground" title={p.value}>
                                {p.value}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center pt-12 text-center">
                    <Info size={32} className="mb-3 text-muted-foreground/30" />
                    <p className="text-sm text-muted-foreground">Hover over an element to see its properties</p>
                    <p className="mt-1 text-xs text-muted-foreground/60">Length, area and geometry details will appear here</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom hint bar */}
        {fileInfo && (
          <div className="flex items-center gap-6 border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
            <span>Scroll: Zoom</span>
            <span>Click + drag: Pan</span>
            <span>Hover: Properties</span>
          </div>
        )}
      </div>
    </MotionPage>
  )
}
