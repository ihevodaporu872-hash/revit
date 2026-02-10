import { useEffect, useRef, useState, useCallback } from 'react'
import { createUniver, IWorkbookData, ICellData, IObjectMatrixPrimitiveType, LocaleType, mergeLocales } from '@univerjs/presets'
import { UniverSheetsCorePreset } from '@univerjs/presets/preset-sheets-core'
import sheetsEnUS from '@univerjs/presets/preset-sheets-core/locales/en-US'
import * as XLSX from 'xlsx'
import { Upload, Table } from 'lucide-react'
import { MotionPage } from '../MotionPage'

import '@univerjs/presets/lib/styles/preset-sheets-core.css'

interface LoadingState {
  isLoading: boolean
  progress: number
  message: string
}

function colLetterToIndex(col: string): number {
  let result = 0
  for (let i = 0; i < col.length; i++) {
    result = result * 26 + (col.charCodeAt(i) - 'A'.charCodeAt(0) + 1)
  }
  return result - 1
}

function parseCellAddress(address: string): { row: number; col: number } {
  const match = address.match(/^([A-Z]+)(\d+)$/)
  if (!match) return { row: 0, col: 0 }
  return { row: parseInt(match[2], 10) - 1, col: colLetterToIndex(match[1]) }
}

function convertSheetToUniverCellData(worksheet: XLSX.WorkSheet): IObjectMatrixPrimitiveType<ICellData> {
  const cellData: IObjectMatrixPrimitiveType<ICellData> = {}
  if (!worksheet['!ref']) return cellData

  for (const cellAddress in worksheet) {
    if (cellAddress.startsWith('!')) continue
    const cell = worksheet[cellAddress] as XLSX.CellObject
    const { row, col } = parseCellAddress(cellAddress)
    if (!cellData[row]) cellData[row] = {}

    const univerCell: ICellData = {}
    if (cell.t === 'n') univerCell.v = cell.v as number
    else if (cell.t === 'b') univerCell.v = cell.v ? 1 : 0
    else if (cell.t === 's') univerCell.v = cell.v as string
    else if (cell.t === 'd') univerCell.v = cell.w || String(cell.v)
    else if (cell.v !== undefined) univerCell.v = String(cell.v)
    if (cell.f) univerCell.f = cell.f

    cellData[row][col] = univerCell
  }
  return cellData
}

function convertXLSXToUniver(workbook: XLSX.WorkBook): IWorkbookData {
  const sheetOrder: string[] = []
  const sheets: IWorkbookData['sheets'] = {}

  workbook.SheetNames.forEach((sheetName, index) => {
    const sheetId = `sheet-${index}`
    sheetOrder.push(sheetId)
    const worksheet = workbook.Sheets[sheetName]
    const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1')
    sheets[sheetId] = {
      id: sheetId,
      name: sheetName,
      rowCount: Math.max(range.e.r + 1, 100),
      columnCount: Math.max(range.e.c + 1, 26),
      cellData: convertSheetToUniverCellData(worksheet),
    }
  })

  return {
    id: 'workbook-imported',
    name: workbook.Props?.Title || 'Imported Workbook',
    sheetOrder,
    sheets,
  } as IWorkbookData
}

let containerIdCounter = 0

export default function ExcelViewerPage() {
  const wrapperRef = useRef<HTMLDivElement>(null)
  const univerInstanceRef = useRef<{ univerAPI: ReturnType<typeof createUniver>['univerAPI'] } | null>(null)
  const univerContainerRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [loadingState, setLoadingState] = useState<LoadingState>({ isLoading: false, progress: 0, message: '' })
  const [fileName, setFileName] = useState<string>('')
  const [error, setError] = useState<string>('')

  const initializeUniver = useCallback((workbookData?: IWorkbookData) => {
    if (!wrapperRef.current) return

    if (univerInstanceRef.current) {
      try { univerInstanceRef.current.univerAPI.dispose() } catch { /* ignore */ }
      univerInstanceRef.current = null
    }

    if (univerContainerRef.current && univerContainerRef.current.parentNode) {
      univerContainerRef.current.parentNode.removeChild(univerContainerRef.current)
      univerContainerRef.current = null
    }

    const containerId = `univer-container-${++containerIdCounter}`
    const univerDiv = document.createElement('div')
    univerDiv.id = containerId
    univerDiv.style.width = '100%'
    univerDiv.style.height = '100%'
    wrapperRef.current.appendChild(univerDiv)
    univerContainerRef.current = univerDiv

    try {
      const { univerAPI } = createUniver({
        locale: LocaleType.EN_US,
        locales: { [LocaleType.EN_US]: mergeLocales(sheetsEnUS) },
        presets: [UniverSheetsCorePreset({ container: containerId })],
      })

      const defaultWorkbook = (workbookData || {
        id: 'workbook-1',
        name: 'New Workbook',
        sheetOrder: ['sheet-1'],
        sheets: { 'sheet-1': { id: 'sheet-1', name: 'Sheet 1', rowCount: 100, columnCount: 26 } },
      }) as IWorkbookData

      univerAPI.createWorkbook(defaultWorkbook)
      univerInstanceRef.current = { univerAPI }
    } catch (err) {
      console.error('Failed to initialize Univer:', err)
      setError(err instanceof Error ? err.message : 'Failed to initialize spreadsheet engine')
    }
  }, [])

  const loadXLSXFile = useCallback(async (file: File) => {
    setError('')
    setLoadingState({ isLoading: true, progress: 10, message: 'Reading file...' })
    try {
      const arrayBuffer = await file.arrayBuffer()
      setLoadingState({ isLoading: true, progress: 30, message: 'Parsing XLSX...' })

      const workbook = XLSX.read(arrayBuffer, { type: 'array', cellFormula: true, cellStyles: false, cellDates: true })
      setLoadingState({ isLoading: true, progress: 60, message: 'Converting to Univer format...' })

      const univerData = convertXLSXToUniver(workbook)
      setLoadingState({ isLoading: true, progress: 80, message: 'Rendering spreadsheet...' })

      initializeUniver(univerData)
      setFileName(file.name)
      setLoadingState({ isLoading: true, progress: 100, message: 'Complete!' })
      setTimeout(() => setLoadingState({ isLoading: false, progress: 0, message: '' }), 500)
    } catch (err) {
      console.error('Error loading XLSX file:', err)
      setError(err instanceof Error ? err.message : 'Failed to load file')
      setLoadingState({ isLoading: false, progress: 0, message: '' })
    }
  }, [initializeUniver])

  const handleFileChange = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) loadXLSXFile(file)
  }, [loadXLSXFile])

  const handleDrop = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const file = event.dataTransfer.files?.[0]
    if (file && (file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      loadXLSXFile(file)
    } else {
      setError('Please drop a valid Excel file (.xlsx or .xls)')
    }
  }, [loadXLSXFile])

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    event.stopPropagation()
  }, [])

  useEffect(() => {
    initializeUniver()
    return () => {
      if (univerInstanceRef.current) {
        try { univerInstanceRef.current.univerAPI.dispose() } catch { /* ignore */ }
        univerInstanceRef.current = null
      }
    }
  }, [initializeUniver])

  return (
    <MotionPage>
      <div
        className="flex h-[calc(100vh-8rem)] flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-[var(--card-glow)]"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {/* Toolbar */}
        <div className="border-b border-border px-5 py-3">
          <div className="mb-1 flex items-center gap-3">
            <h2 className="text-lg font-semibold text-foreground">Excel Viewer</h2>
            {fileName && (
              <span className="rounded bg-green-500/10 px-2 py-0.5 text-xs font-medium text-green-400" data-testid="loaded-file-name">
                {fileName}
              </span>
            )}
          </div>
          <p className="mb-3 text-xs text-muted-foreground">
            Powered by Univer — Edit cells, use formulas, and format your spreadsheet
          </p>

          <div className="flex flex-wrap items-center gap-3">
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="xlsx-file-input"
              data-testid="xlsx-file-input"
            />
            <label htmlFor="xlsx-file-input"
              className="flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90">
              <Upload size={14} />
              Upload XLSX File
            </label>
          </div>

          {loadingState.isLoading && (
            <div className="mt-3" data-testid="loading-indicator">
              <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-primary transition-[width] duration-300" style={{ width: `${loadingState.progress}%` }} />
              </div>
              <span className="mt-1 block text-xs text-muted-foreground">{loadingState.message}</span>
            </div>
          )}

          {error && (
            <div className="mt-3 rounded border-l-[3px] border-destructive bg-destructive/10 px-3 py-2 text-xs text-destructive" data-testid="error-message">
              {error}
            </div>
          )}
        </div>

        {/* Spreadsheet container */}
        <div ref={wrapperRef} className="flex-1 overflow-hidden" data-testid="excel-container" />
      </div>
    </MotionPage>
  )
}
