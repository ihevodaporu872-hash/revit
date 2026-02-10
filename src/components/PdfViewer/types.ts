export type AnnotationKind = 'count_point' | 'area_polygon' | 'dimension_line'

export interface AnnotationPoint {
  x: number
  y: number
}

export interface AnnotationItem {
  id: string
  page: number
  kind: AnnotationKind
  color?: string
  opacity?: number
  label?: string
  points: AnnotationPoint[]
  closed?: boolean
  meta?: Record<string, unknown>
}

export interface AnnotationLayer {
  id: string
  name: string
  color: string
  opacity: number
  visible: boolean
  items: AnnotationItem[]
}

export interface AnnotationModel {
  version: string
  docId?: string
  pageCount?: number
  layers: AnnotationLayer[]
}
