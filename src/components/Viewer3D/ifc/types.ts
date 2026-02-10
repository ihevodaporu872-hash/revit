// ── IFC Viewer Types ──────────────────────────────────────────────────

export interface IFCSpatialNode {
  expressID: number
  type: string
  children: IFCSpatialNode[]
}

export interface IFCElementInfo {
  expressID: number
  type: string
  name: string
  properties: { name: string; value: string }[]
  material?: string
  volume?: string
  area?: string
  tag?: string      // Revit ElementId from IFC Tag attribute
  globalId?: string // IFC GlobalId extracted separately for easy access
}

export interface IFCModelStats {
  totalElements: number
  types: number
  stories: number
  materials: number
  ifcVersion: string
  fileSize: string
}

export interface LoadingProgress {
  stage: 'init' | 'parsing' | 'geometry' | 'building' | 'done'
  percent: number
  message: string
}

export interface IFCLoadResult {
  group: import('three').Group
  stats: IFCModelStats
  tree: IFCSpatialNode
  elementMap: Map<number, import('three').Mesh>
}

// Search Sets types
export type SearchOperator = 'equals' | 'notEquals' | 'contains' | 'startsWith' | 'endsWith' | 'greaterThan' | 'lessThan'
export type SearchLogic = 'AND' | 'OR'

export interface SearchCriterion {
  id: string
  field: string
  operator: SearchOperator
  value: string
}

export interface SavedSet {
  id: string
  name: string
  color: string
  type: 'selection' | 'search'
  expressIDs?: number[]
  criteria?: SearchCriterion[]
  logic?: SearchLogic
  createdAt: number
}

export interface ActiveSetDisplay {
  setId: string
  mode: 'highlight' | 'isolate' | 'transparent' | 'wireframe'
}

// ── Drawing / Annotations ────────────────────────────────────────────

export type DrawingToolType = 'pen' | 'line' | 'rectangle' | 'circle' | 'arrow' | 'text' | 'eraser'

export interface DrawingSettings {
  tool: DrawingToolType
  color: string
  lineWidth: number
  fontSize: number
}

export interface CameraState {
  position: { x: number; y: number; z: number }
  target: { x: number; y: number; z: number }
  zoom: number
  fov: number
}

export interface SavedViewpoint {
  id: string
  name: string
  thumbnail: string
  cameraState: CameraState
  annotationDataURL: string | null
  createdAt: number
  updatedAt: number
}

// ── Section Planes ───────────────────────────────────────────────────

export type ClipAxis = 'x' | 'y' | 'z'
export type SectionMode = 'planes' | 'box' | 'off'

export interface ClipPlaneState {
  axis: ClipAxis
  enabled: boolean
  position: number
  flipped: boolean
}

export interface ClipBoxState {
  enabled: boolean
  xMin: number; xMax: number
  yMin: number; yMax: number
  zMin: number; zMax: number
}

// ── Measure Tool ─────────────────────────────────────────────────────

export type MeasureMode = 'distance' | 'area'

export interface MeasurePoint {
  position: import('three').Vector3
  expressID: number | null
}

export interface Measurement {
  id: string
  pointA: MeasurePoint
  pointB: MeasurePoint
  distance: number
  visualGroup: import('three').Group
}

export interface AreaMeasurement {
  id: string
  points: MeasurePoint[]
  area: number
  visualGroup: import('three').Group
}

// ── Revit Properties (enriched from XLSX upload) ────────────────────

export interface RevitProperties {
  globalId: string
  projectId?: string
  modelVersion?: string
  sourceFile?: string
  revitElementId?: number
  revitUniqueId?: string
  typeIfcGuid?: string
  elementName?: string
  elementType?: string
  category?: string
  family?: string
  familyType?: string
  level?: string
  phaseCreated?: string
  phaseDemolished?: string
  area?: number
  volume?: number
  length?: number
  width?: number
  height?: number
  perimeter?: number
  material?: string
  materialArea?: number
  materialVolume?: number
  structuralUsage?: string
  classification?: string
  assemblyCode?: string
  mark?: string
  comments?: string
  customParams?: Record<string, unknown>
  matchConfidence?: number
  matchedBy?: 'globalId' | 'elementId' | 'typeIfcGuid' | 'mixed'
}

export interface MatchDiagnostic {
  expressID: number
  reason: string
  candidateCount: number
  topScore: number
}

export interface CoverageSummary {
  parsedRows: number
  validRows: number
  validRatio: number
  withGlobalId: number
  withElementId: number
  withTypeIfcGuid: number
}

// ── Revit Processing Job (async conversion) ─────────────

export interface RevitProcessingJob {
  jobId: string
  phase: 'uploading' | 'converting' | 'importing' | 'loading' | 'complete' | 'error'
  uploadPercent: number
  ifcReady: boolean
  xlsxReady: boolean
  daeReady: boolean
  elapsedMs: number
  result: import('../../../services/revit-api').RevitProcessModelResponse | null
  error: string | null
}

// ── Properties Summary ───────────────────────────────────────────────

export type SummaryGroupBy = 'type' | 'name' | 'material'

export interface SummaryElementData {
  expressID: number
  type: string
  name: string
  material: string
  length: number
  area: number
  volume: number
}

export interface SummaryGroup {
  key: string
  count: number
  expressIDs: number[]
  totalLength: number
  totalArea: number
  totalVolume: number
  elements: SummaryElementData[]
}

export interface SummaryData {
  groupBy: SummaryGroupBy
  groups: SummaryGroup[]
  totalElements: number
  scanProgress: number
  isScanning: boolean
}

// ── Appearance Profiler ──────────────────────────────────────────────

export interface ProfileLegendEntry {
  value: string
  color: string
  count: number
}
