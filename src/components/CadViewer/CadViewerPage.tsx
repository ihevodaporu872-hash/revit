import { useEffect, useRef, useState, useCallback, type DragEvent } from 'react'
import type {
  AcApDocManager as AcApDocManagerType,
  AcApDocManagerOptions,
  AcDbDocumentEventArgs,
} from '@mlightcad/cad-simple-viewer'
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

/* ── Component ──────────────────────────────────────────── */

export default function CadViewerPage() {
  const containerRef = useRef<HTMLDivElement>(null)
  const docManagerRef = useRef<AcApDocManagerType | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [loadingMessage, setLoadingMessage] = useState('Loading...')
  const [error, setError] = useState<string | null>(null)
  const [viewerReady, setViewerReady] = useState(false)
  const [hasDocument, setHasDocument] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [fileInfo, setFileInfo] = useState<{ name: string; size: number } | null>(null)

  /* ── Viewer init ───────────────────────────────────────── */

  const handleDocumentActivated = useCallback((_args: AcDbDocumentEventArgs) => {
    setHasDocument(true)
  }, [])

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
          mgr.events.documentActivated.addEventListener(handleDocumentActivated)
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
        docManagerRef.current.events.documentActivated.removeEventListener(handleDocumentActivated)
        docManagerRef.current.destroy()
        docManagerRef.current = null
      }
    }
  }, [handleDocumentActivated])

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
            {viewerReady && hasDocument && (
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

        {/* Viewer area — flex-1 + min-h-0 ensures proper height propagation */}
        <div
          className={`relative flex min-h-0 flex-1 flex-col ${isDragging ? 'ring-2 ring-inset ring-primary' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* The container gets flex-1 + min-h-0 so mlightcad can compute real dimensions */}
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
          {viewerReady && !hasDocument && !isLoading && !error && (
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

        {/* Bottom hint bar */}
        {hasDocument && (
          <div className="flex items-center gap-6 border-t border-border px-4 py-1.5 text-xs text-muted-foreground">
            <span>Scroll: Zoom</span>
            <span>Click + drag: Pan</span>
          </div>
        )}
      </div>
    </MotionPage>
  )
}
