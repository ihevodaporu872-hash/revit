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
  mode: 'highlight' | 'isolate' | 'transparent'
}
