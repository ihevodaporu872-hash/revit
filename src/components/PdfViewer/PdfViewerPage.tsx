import { useState, useCallback, useRef, useEffect, type DragEvent, type ChangeEvent } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { Upload, FileText, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Layers, TestTube } from 'lucide-react'
import { MotionPage } from '../MotionPage'
import type { AnnotationModel, AnnotationLayer, AnnotationItem } from './types'
import { parseXmlMarkup } from './xmlMarkupParser'
import { parseJsonMarkup } from './jsonMarkupParser'
import { PdfOverlay } from './PdfOverlay'
import { AnnotationSidebar } from './AnnotationSidebar'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.min.mjs',
  import.meta.url,
).toString()

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

interface DocumentInfo {
  name: string
  size: number
  currentPage: number
  totalPages: number
}

interface PageRenderInfo {
  pageIndex: number
  width: number
  height: number
  baseWidth: number
  baseHeight: number
}

export default function PdfViewerPage() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const markupInputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const pdfDocRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null)

  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragOver, setIsDragOver] = useState(false)
  const [documentInfo, setDocumentInfo] = useState<DocumentInfo | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [scale, setScale] = useState(1.5)

  const [, setAnnotationModel] = useState<AnnotationModel | null>(null)
  const [layers, setLayers] = useState<AnnotationLayer[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [showSidebar, setShowSidebar] = useState(false)
  const [markupFileName, setMarkupFileName] = useState<string | null>(null)
  const [pageViewports, setPageViewports] = useState<PageRenderInfo[]>([])

  const clearError = useCallback(() => setError(null), [])

  const renderPage = useCallback(async (
    pdf: pdfjsLib.PDFDocumentProxy,
    pageNum: number,
    container: HTMLDivElement,
    renderScale: number,
  ): Promise<PageRenderInfo> => {
    const page = await pdf.getPage(pageNum)
    const baseViewport = page.getViewport({ scale: 1 })
    const viewport = page.getViewport({ scale: renderScale })

    const pageDiv = document.createElement('div')
    pageDiv.className = 'relative mx-auto mb-4 w-fit bg-white shadow-lg'
    pageDiv.setAttribute('data-page-number', String(pageNum))
    pageDiv.style.width = `${viewport.width}px`

    const canvas = document.createElement('canvas')
    canvas.height = viewport.height
    canvas.width = viewport.width
    canvas.style.display = 'block'
    pageDiv.appendChild(canvas)

    const label = document.createElement('div')
    label.className = 'bg-background py-1 text-center text-xs text-muted-foreground'
    label.textContent = `Page ${pageNum}`
    pageDiv.appendChild(label)

    container.appendChild(pageDiv)

    await page.render({ canvas, viewport }).promise

    return {
      pageIndex: pageNum,
      width: viewport.width,
      height: viewport.height,
      baseWidth: baseViewport.width,
      baseHeight: baseViewport.height,
    }
  }, [])

  const renderAllPages = useCallback(async (pdf: pdfjsLib.PDFDocumentProxy, renderScale: number) => {
    if (!containerRef.current) return
    containerRef.current.innerHTML = ''
    const viewports: PageRenderInfo[] = []
    for (let i = 1; i <= pdf.numPages; i++) {
      const info = await renderPage(pdf, i, containerRef.current, renderScale)
      viewports.push(info)
    }
    setPageViewports(viewports)
  }, [renderPage])

  const loadPdfData = useCallback(async (data: ArrayBuffer, fileName: string, fileSize: number) => {
    setIsLoading(true)
    setError(null)
    try {
      if (pdfDocRef.current) {
        await pdfDocRef.current.destroy()
        pdfDocRef.current = null
      }
      const pdf = await pdfjsLib.getDocument({ data }).promise
      pdfDocRef.current = pdf
      setDocumentInfo({ name: fileName, size: fileSize, currentPage: 1, totalPages: pdf.numPages })
      setCurrentPage(1)
      await renderAllPages(pdf, scale)
      setIsLoading(false)
    } catch (err) {
      console.error('Failed to load PDF:', err)
      setError(err instanceof Error ? err.message : 'Failed to load PDF file')
      setIsLoading(false)
    }
  }, [scale, renderAllPages])

  const loadPdfFile = useCallback(async (file: File) => {
    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Please select a valid PDF file')
      return
    }
    const arrayBuffer = await file.arrayBuffer()
    await loadPdfData(arrayBuffer, file.name, file.size)
  }, [loadPdfData])

  const loadMarkupFromText = useCallback((text: string, fileName: string) => {
    try {
      let model: AnnotationModel
      const lowerName = fileName.toLowerCase()
      if (lowerName.endsWith('.xml')) {
        model = parseXmlMarkup(text)
      } else if (lowerName.endsWith('.json')) {
        model = parseJsonMarkup(text)
      } else {
        const trimmed = text.trim()
        if (trimmed.startsWith('<') || trimmed.startsWith('<?xml')) {
          model = parseXmlMarkup(text)
        } else if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
          model = parseJsonMarkup(text)
        } else {
          setError('Unsupported markup format. Use XML or JSON.')
          return
        }
      }
      setAnnotationModel(model)
      setLayers(model.layers)
      setMarkupFileName(fileName)
      setShowSidebar(true)
      setSelectedItemId(null)
    } catch (err) {
      console.error('Failed to parse markup:', err)
      setError(err instanceof Error ? err.message : 'Failed to parse markup file')
    }
  }, [])

  const loadMarkupFile = useCallback(async (file: File) => {
    const text = await file.text()
    loadMarkupFromText(text, file.name)
  }, [loadMarkupFromText])

  const handleFileUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) await loadPdfFile(file)
    event.target.value = ''
  }, [loadPdfFile])

  const handleMarkupUpload = useCallback(async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) await loadMarkupFile(file)
    event.target.value = ''
  }, [loadMarkupFile])

  const handleDragOver = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(true)
  }, [])

  const handleDragLeave = useCallback((event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
  }, [])

  const handleDrop = useCallback(async (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    setIsDragOver(false)
    const files = Array.from(event.dataTransfer.files)
    for (const file of files) {
      const name = file.name.toLowerCase()
      if (name.endsWith('.pdf') || file.type.includes('pdf')) {
        await loadPdfFile(file)
      } else if (name.endsWith('.xml') || name.endsWith('.json')) {
        await loadMarkupFile(file)
      }
    }
  }, [loadPdfFile, loadMarkupFile])

  const handleUploadClick = useCallback(() => fileInputRef.current?.click(), [])
  const handleMarkupUploadClick = useCallback(() => markupInputRef.current?.click(), [])

  const goToPage = useCallback((pageNum: number) => {
    if (!containerRef.current || !documentInfo) return
    const clampedPage = Math.max(1, Math.min(pageNum, documentInfo.totalPages))
    setCurrentPage(clampedPage)
    const pageEl = containerRef.current.querySelector(`[data-page-number="${clampedPage}"]`)
    if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [documentInfo])

  const handleZoomIn = useCallback(async () => {
    const newScale = Math.min(scale + 0.25, 4)
    setScale(newScale)
    if (pdfDocRef.current) await renderAllPages(pdfDocRef.current, newScale)
  }, [scale, renderAllPages])

  const handleZoomOut = useCallback(async () => {
    const newScale = Math.max(scale - 0.25, 0.5)
    setScale(newScale)
    if (pdfDocRef.current) await renderAllPages(pdfDocRef.current, newScale)
  }, [scale, renderAllPages])

  const handleToggleLayer = useCallback((layerId: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, visible: !l.visible } : l))
  }, [])

  const handleChangeLayerColor = useCallback((layerId: string, color: string) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, color } : l))
  }, [])

  const handleChangeLayerOpacity = useCallback((layerId: string, opacity: number) => {
    setLayers(prev => prev.map(l => l.id === layerId ? { ...l, opacity } : l))
  }, [])

  const handleSelectItem = useCallback((item: AnnotationItem) => {
    setSelectedItemId(prev => prev === item.id ? null : item.id)
    if (containerRef.current) {
      const pageEl = containerRef.current.querySelector(`[data-page-number="${item.page}"]`)
      if (pageEl) pageEl.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [])

  const handleOverlayItemClick = useCallback((item: AnnotationItem) => {
    setSelectedItemId(prev => prev === item.id ? null : item.id)
  }, [])

  const handleCloseSidebar = useCallback(() => setShowSidebar(false), [])

  useEffect(() => {
    return () => { if (pdfDocRef.current) pdfDocRef.current.destroy() }
  }, [])

  return (
    <MotionPage>
      <div className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--card-glow)]">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold text-foreground">
              {documentInfo?.name || 'PDF Viewer'}
            </h2>
            <p className="text-xs text-muted-foreground">
              View PDF with annotation overlay
              {markupFileName && (
                <span className="ml-1 font-medium text-green-400"> | Markup: {markupFileName}</span>
              )}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {documentInfo && (
              <div className="flex items-center gap-3 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-xs">
                <span className="font-medium text-foreground">
                  Page {currentPage} / {documentInfo.totalPages}
                </span>
                <span className="border-l border-border/50 pl-3 text-muted-foreground">
                  {formatFileSize(documentInfo.size)}
                </span>
              </div>
            )}
            {documentInfo && (
              <>
                <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage <= 1}
                  className="rounded-md border border-border bg-muted p-1.5 text-foreground transition-colors hover:bg-accent disabled:opacity-50" title="Previous page">
                  <ChevronLeft size={16} />
                </button>
                <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage >= documentInfo.totalPages}
                  className="rounded-md border border-border bg-muted p-1.5 text-foreground transition-colors hover:bg-accent disabled:opacity-50" title="Next page">
                  <ChevronRight size={16} />
                </button>
                <button onClick={handleZoomOut} disabled={scale <= 0.5}
                  className="rounded-md border border-border bg-muted p-1.5 text-foreground transition-colors hover:bg-accent disabled:opacity-50" title="Zoom out">
                  <ZoomOut size={16} />
                </button>
                <span className="text-xs text-muted-foreground">{Math.round(scale * 100)}%</span>
                <button onClick={handleZoomIn} disabled={scale >= 4}
                  className="rounded-md border border-border bg-muted p-1.5 text-foreground transition-colors hover:bg-accent disabled:opacity-50" title="Zoom in">
                  <ZoomIn size={16} />
                </button>
              </>
            )}
            <button onClick={handleUploadClick} disabled={isLoading}
              className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
              <Upload size={14} />
              Upload PDF
            </button>
            <button onClick={handleMarkupUploadClick} disabled={isLoading || !documentInfo}
              className="flex items-center gap-1.5 rounded-md border border-green-500/50 bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-400 transition-colors hover:bg-green-500/20 disabled:opacity-50"
              title="Load XML or JSON markup file">
              <FileText size={14} />
              Load Markup
            </button>
            {layers.length > 0 && (
              <button onClick={() => setShowSidebar(!showSidebar)}
                className={`flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-colors ${
                  showSidebar ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-muted text-foreground hover:bg-accent'
                }`}>
                <Layers size={14} />
                Layers
              </button>
            )}
            <input ref={fileInputRef} type="file" accept=".pdf,application/pdf" onChange={handleFileUpload} className="hidden" disabled={isLoading} />
            <input ref={markupInputRef} type="file" accept=".xml,.json,application/xml,application/json,text/xml" onChange={handleMarkupUpload} className="hidden" disabled={isLoading} />
          </div>
        </div>

        {/* Content area */}
        <div className="flex flex-1 overflow-hidden">
          <div
            className={`relative flex-1 overflow-auto bg-background ${isDragOver ? 'ring-2 ring-primary ring-inset' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div ref={containerRef} className="p-4" data-testid="pdf-pages-container" />

            {layers.length > 0 && pageViewports.map(({ pageIndex, width, height, baseWidth, baseHeight }) => (
              <PdfPageOverlay
                key={`overlay-${pageIndex}-${scale}`}
                containerRef={containerRef}
                pageIndex={pageIndex}
                width={width}
                height={height}
                baseWidth={baseWidth}
                baseHeight={baseHeight}
                layers={layers}
                selectedItemId={selectedItemId}
                onItemClick={handleOverlayItemClick}
                scale={scale}
              />
            ))}

            {isLoading && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90">
                <div className="mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-muted border-t-primary" />
                <p className="text-sm text-muted-foreground">Loading PDF...</p>
              </div>
            )}

            {error && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90">
                <p className="mb-3 text-sm text-destructive">Error: {error}</p>
                <button onClick={clearError} className="rounded-md border border-border bg-muted px-3 py-1.5 text-xs text-foreground hover:bg-accent">
                  Dismiss
                </button>
              </div>
            )}

            {isDragOver && (
              <div className="absolute inset-0 z-10 flex items-center justify-center border-[3px] border-dashed border-primary bg-primary/10">
                <p className="text-xl font-semibold text-primary">Drop PDF or markup file here</p>
              </div>
            )}

            {!documentInfo && !isLoading && !error && (
              <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-background/90">
                <FileText size={64} className="mb-4 text-muted-foreground/50" strokeWidth={1.5} />
                <p className="mb-1 text-base text-foreground">Drop PDF + markup files here</p>
                <p className="text-sm text-muted-foreground">or use buttons above</p>
              </div>
            )}
          </div>

          {showSidebar && layers.length > 0 && (
            <AnnotationSidebar
              layers={layers}
              selectedItemId={selectedItemId}
              onToggleLayer={handleToggleLayer}
              onChangeLayerColor={handleChangeLayerColor}
              onChangeLayerOpacity={handleChangeLayerOpacity}
              onSelectItem={handleSelectItem}
              onClose={handleCloseSidebar}
            />
          )}
        </div>
      </div>
    </MotionPage>
  )
}

interface PdfPageOverlayProps {
  containerRef: React.RefObject<HTMLDivElement | null>
  pageIndex: number
  width: number
  height: number
  baseWidth: number
  baseHeight: number
  layers: AnnotationLayer[]
  selectedItemId: string | null
  onItemClick: (item: AnnotationItem) => void
  scale: number
}

function PdfPageOverlay({ containerRef, pageIndex, width, height, baseWidth, baseHeight, layers, selectedItemId, onItemClick, scale }: PdfPageOverlayProps) {
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null)

  useEffect(() => {
    if (!containerRef.current) return
    const pageEl = containerRef.current.querySelector(`[data-page-number="${pageIndex}"]`) as HTMLElement
    if (!pageEl) return

    const updatePosition = () => {
      const containerRect = containerRef.current!.getBoundingClientRect()
      const pageRect = pageEl.getBoundingClientRect()
      setPosition({
        top: pageRect.top - containerRect.top + containerRef.current!.scrollTop,
        left: pageRect.left - containerRect.left + containerRef.current!.scrollLeft,
      })
    }

    updatePosition()
    const scrollContainer = containerRef.current.parentElement
    if (scrollContainer) {
      scrollContainer.addEventListener('scroll', updatePosition)
      return () => scrollContainer.removeEventListener('scroll', updatePosition)
    }
  }, [containerRef, pageIndex, scale, width, height])

  if (!position) return null
  const hasItems = layers.some(l => l.visible && l.items.some(i => i.page === pageIndex))
  if (!hasItems) return null

  return (
    <div style={{ position: 'absolute', top: position.top, left: position.left, width, height, pointerEvents: 'none', zIndex: 5 }}>
      <PdfOverlay
        pageIndex={pageIndex}
        viewportWidth={width}
        viewportHeight={height}
        baseWidth={baseWidth}
        baseHeight={baseHeight}
        layers={layers}
        selectedItemId={selectedItemId}
        onItemClick={onItemClick}
      />
    </div>
  )
}
