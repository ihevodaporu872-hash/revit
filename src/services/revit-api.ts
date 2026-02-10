import type { IFCElementInfo, RevitProperties, CoverageSummary, MatchDiagnostic } from '../components/Viewer3D/ifc/types'

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api'

interface ApiErrorShape {
  error?: string
  message?: string
  code?: string
}

async function handleJson<T>(response: Response): Promise<T> {
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const err = json as ApiErrorShape
    const text = err?.error || err?.message || `Request failed with status ${response.status}`
    throw new Error(text)
  }
  return json as T
}

function snakeToCamelRevit(row: Record<string, unknown>): RevitProperties {
  return {
    projectId: (row.project_id as string | undefined) || undefined,
    modelVersion: (row.model_version as string | undefined) || undefined,
    sourceFile: (row.source_file as string | undefined) || undefined,
    globalId: String(row.global_id || ''),
    revitElementId: typeof row.revit_element_id === 'number' ? row.revit_element_id : undefined,
    revitUniqueId: (row.revit_unique_id as string | undefined) || undefined,
    typeIfcGuid: (row.type_ifc_guid as string | undefined) || undefined,
    elementName: (row.element_name as string | undefined) || undefined,
    elementType: (row.element_type as string | undefined) || undefined,
    category: (row.category as string | undefined) || undefined,
    family: (row.family as string | undefined) || undefined,
    familyType: (row.family_type as string | undefined) || undefined,
    level: (row.level as string | undefined) || undefined,
    phaseCreated: (row.phase_created as string | undefined) || undefined,
    phaseDemolished: (row.phase_demolished as string | undefined) || undefined,
    area: typeof row.area === 'number' ? row.area : undefined,
    volume: typeof row.volume === 'number' ? row.volume : undefined,
    length: typeof row.length === 'number' ? row.length : undefined,
    width: typeof row.width === 'number' ? row.width : undefined,
    height: typeof row.height === 'number' ? row.height : undefined,
    perimeter: typeof row.perimeter === 'number' ? row.perimeter : undefined,
    material: (row.material as string | undefined) || undefined,
    materialArea: typeof row.material_area === 'number' ? row.material_area : undefined,
    materialVolume: typeof row.material_volume === 'number' ? row.material_volume : undefined,
    structuralUsage: (row.structural_usage as string | undefined) || undefined,
    classification: (row.classification as string | undefined) || undefined,
    assemblyCode: (row.assembly_code as string | undefined) || undefined,
    mark: (row.mark as string | undefined) || undefined,
    comments: (row.comments as string | undefined) || undefined,
    customParams: (row.custom_params as Record<string, unknown> | undefined) || undefined,
  }
}

export interface RevitUploadResponse {
  status: string
  insertedCount: number
  parsedRows: number
  validRows: number
  errorCount: number
  coverage: CoverageSummary
  mappedColumns: string[]
  unmappedColumns: string[]
  errors: Array<Record<string, unknown>>
  projectId?: string
  modelVersion?: string
}

export interface RevitProcessModelResponse {
  status: string
  mode?: 'auto_rvt_converter' | 'manual_ifc_xlsx'
  reason?: string
  projectId?: string
  modelVersion?: string
  instructions?: string[]
  converterPath?: string
  outputs?: {
    ifcPath?: string | null
    xlsxPath?: string | null
    daePath?: string | null
    files?: string[]
  }
  xlsxImport?: {
    insertedCount: number
    parsedRows: number
    validRows: number
    errorCount: number
    coverage: CoverageSummary
  } | null
  matchSummary?: Record<string, unknown> | null
  converter?: {
    ifcSchemaRequested?: string
    ifcSchemaApplied?: string
    mode?: 'flag' | 'positional' | 'default'
  }
}

export async function uploadRevitXlsx(formData: FormData): Promise<RevitUploadResponse> {
  const response = await fetch(`${API_BASE}/revit/upload-xlsx`, {
    method: 'POST',
    body: formData,
  })
  return handleJson<RevitUploadResponse>(response)
}

export async function processRevitModel(formData: FormData): Promise<RevitProcessModelResponse> {
  const response = await fetch(`${API_BASE}/revit/process-model`, {
    method: 'POST',
    body: formData,
  })
  const json = await response.json().catch(() => ({}))
  if (!response.ok) {
    const fallback = json as RevitProcessModelResponse
    if (response.status === 503 && fallback?.status === 'fallback') {
      return fallback
    }
    const err = json as ApiErrorShape
    const text = err?.error || err?.message || `Request failed with status ${response.status}`
    throw new Error(text)
  }
  return json as RevitProcessModelResponse
}

// ── Async RVT Processing (SSE-based) ──────────────────────────────────

export interface AsyncRevitStartResponse {
  jobId: string
  outputDir: string
}

export interface RevitSSEProgress {
  ifc: boolean
  xlsx: boolean
  dae: boolean
  elapsedMs: number
}

export interface RevitSSEXlsxImport {
  insertedCount: number
  parsedRows: number
  validRows: number
  coverage: CoverageSummary
}

export interface RevitSSEMatchSummary {
  totalMatched: number
  totalIfcElements: number
  matchRate: number
}

export function startRevitProcessing(
  formData: FormData,
  onUploadProgress?: (percent: number) => void,
): Promise<AsyncRevitStartResponse> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${API_BASE}/revit/process-model-async`)

    if (onUploadProgress) {
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          onUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
      }
    }

    xhr.onload = () => {
      try {
        const json = JSON.parse(xhr.responseText)
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(json as AsyncRevitStartResponse)
        } else {
          reject(new Error(json?.error || json?.message || `Request failed with status ${xhr.status}`))
        }
      } catch {
        reject(new Error(`Failed to parse response (status ${xhr.status})`))
      }
    }

    xhr.onerror = () => reject(new Error('Network error during upload'))
    xhr.ontimeout = () => reject(new Error('Upload timed out'))
    xhr.timeout = 600000 // 10 min

    xhr.send(formData)
  })
}

export interface RevitSSECallbacks {
  onProgress?: (data: RevitSSEProgress) => void
  onXlsxImport?: (data: RevitSSEXlsxImport) => void
  onMatchSummary?: (data: RevitSSEMatchSummary) => void
  onComplete?: (data: RevitProcessModelResponse) => void
  onError?: (data: { code: string; message: string }) => void
}

export function subscribeToProcessingProgress(
  jobId: string,
  callbacks: RevitSSECallbacks,
): () => void {
  const url = `${API_BASE}/revit/process-status-stream/${encodeURIComponent(jobId)}`
  const es = new EventSource(url)

  es.addEventListener('progress', (e) => {
    callbacks.onProgress?.(JSON.parse((e as MessageEvent).data))
  })

  es.addEventListener('xlsx_import', (e) => {
    callbacks.onXlsxImport?.(JSON.parse((e as MessageEvent).data))
  })

  es.addEventListener('match_summary', (e) => {
    callbacks.onMatchSummary?.(JSON.parse((e as MessageEvent).data))
  })

  es.addEventListener('complete', (e) => {
    callbacks.onComplete?.(JSON.parse((e as MessageEvent).data))
    es.close()
  })

  es.addEventListener('error', (e) => {
    if ((e as MessageEvent).data) {
      try {
        callbacks.onError?.(JSON.parse((e as MessageEvent).data))
      } catch {
        callbacks.onError?.({ code: 'SSE_ERROR', message: 'Connection lost' })
      }
    }
    es.close()
  })

  return () => es.close()
}

export async function fetchRevitPropertiesBulk(params: {
  globalIds?: string[]
  elementIds?: number[]
  projectId?: string
  modelVersion?: string
  limit?: number
}): Promise<{
  results: RevitProperties[]
  unresolved: { globalIds: string[]; elementIds: number[] }
}> {
  const response = await fetch(`${API_BASE}/revit/properties/bulk`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await handleJson<{
    results: Record<string, unknown>[]
    unresolved?: { globalIds?: string[]; elementIds?: number[] }
  }>(response)

  return {
    results: (data.results || []).map(snakeToCamelRevit),
    unresolved: {
      globalIds: data.unresolved?.globalIds || [],
      elementIds: data.unresolved?.elementIds || [],
    },
  }
}

export interface RevitMatchReportResponse {
  projectId: string
  modelVersion: string
  matchRate: number
  matchedByKey: Record<string, number>
  ambiguous: Array<Record<string, unknown>>
  missingInIfc: RevitProperties[]
  missingInRevit: IFCElementInfo[]
  byCategory: Array<Record<string, unknown>>
  diagnostics: MatchDiagnostic[]
  totals: {
    totalIfcElements: number
    totalRevitRows: number
    totalMatched: number
  }
}

export async function requestRevitMatchReport(params: {
  projectId?: string
  modelVersion?: string
  ifcElements: IFCElementInfo[]
}): Promise<RevitMatchReportResponse> {
  const response = await fetch(`${API_BASE}/revit/match-report`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  })
  const data = await handleJson<RevitMatchReportResponse>(response)
  return {
    ...data,
    missingInIfc: (data.missingInIfc || []).map((row) => snakeToCamelRevit(row as unknown as Record<string, unknown>)),
  }
}
