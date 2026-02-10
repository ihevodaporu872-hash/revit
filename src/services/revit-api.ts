import type { IFCElementInfo, RevitProperties, CoverageSummary, MatchDiagnostic } from '../components/Viewer3D/ifc/types'

function normalizeApiRoot(base: string): string {
  const trimmed = String(base || '').trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  return trimmed.replace(/\/api$/i, '')
}

function buildApiBases(): string[] {
  const envRoot = normalizeApiRoot(import.meta.env.VITE_API_URL || '')
  const candidates = [
    envRoot ? `${envRoot}/api` : '/api',
    'http://127.0.0.1:3101/api',
    'http://localhost:3101/api',
    'http://127.0.0.1:3001/api',
    'http://localhost:3001/api',
  ]
  const seen = new Set<string>()
  return candidates.filter((candidate) => {
    const key = candidate.toLowerCase()
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
}

const API_BASES = buildApiBases()

async function fetchWithFallback(endpoint: string, init: RequestInit): Promise<Response> {
  let lastResponse: Response | null = null
  let lastError: unknown = null

  for (let i = 0; i < API_BASES.length; i += 1) {
    const base = API_BASES[i]
    try {
      const response = await fetch(`${base}${endpoint}`, init)
      // 404 often means wrong backend target (e.g. another app on same port).
      if (response.status === 404 && i < API_BASES.length - 1) {
        lastResponse = response
        continue
      }
      return response
    } catch (err) {
      lastError = err
    }
  }

  if (lastResponse) return lastResponse
  throw lastError instanceof Error ? lastError : new Error('API request failed')
}

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
  const response = await fetchWithFallback('/revit/upload-xlsx', {
    method: 'POST',
    body: formData,
  })
  return handleJson<RevitUploadResponse>(response)
}

export async function processRevitModel(formData: FormData): Promise<RevitProcessModelResponse> {
  const response = await fetchWithFallback('/revit/process-model', {
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
  const response = await fetchWithFallback('/revit/properties/bulk', {
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
  const response = await fetchWithFallback('/revit/match-report', {
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
