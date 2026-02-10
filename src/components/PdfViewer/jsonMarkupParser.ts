import type { AnnotationModel, AnnotationLayer, AnnotationItem } from './types'

export function parseJsonMarkup(jsonText: string): AnnotationModel {
  let data: unknown
  try {
    data = JSON.parse(jsonText)
  } catch {
    throw new Error('Invalid JSON format')
  }

  if (!data || typeof data !== 'object') {
    throw new Error('JSON markup must be an object')
  }

  const obj = data as Record<string, unknown>

  if (!Array.isArray(obj.layers)) {
    throw new Error('JSON markup must have a "layers" array')
  }

  const layers: AnnotationLayer[] = obj.layers.map((layer: unknown, i: number) => {
    if (!layer || typeof layer !== 'object') {
      throw new Error(`Layer at index ${i} must be an object`)
    }

    const l = layer as Record<string, unknown>

    if (!Array.isArray(l.items)) {
      throw new Error(`Layer "${l.name ?? i}" must have an "items" array`)
    }

    const items: AnnotationItem[] = l.items.map((item: unknown, j: number) => {
      if (!item || typeof item !== 'object') {
        throw new Error(`Item at index ${j} in layer "${l.name ?? i}" must be an object`)
      }

      const it = item as Record<string, unknown>

      if (!Array.isArray(it.points) || it.points.length === 0) {
        throw new Error(`Item "${it.id ?? j}" must have a non-empty "points" array`)
      }

      return {
        id: String(it.id ?? `item-${i}-${j}`),
        page: typeof it.page === 'number' ? it.page : 1,
        kind: it.kind === 'area_polygon' ? 'area_polygon'
          : it.kind === 'dimension_line' ? 'dimension_line'
          : 'count_point',
        color: typeof it.color === 'string' ? it.color : undefined,
        opacity: typeof it.opacity === 'number' ? it.opacity : undefined,
        label: typeof it.label === 'string' ? it.label : undefined,
        points: (it.points as Array<Record<string, unknown>>).map(p => ({
          x: Number(p.x ?? 0),
          y: Number(p.y ?? 0),
        })),
        closed: typeof it.closed === 'boolean' ? it.closed : it.kind === 'area_polygon',
        meta: typeof it.meta === 'object' && it.meta !== null
          ? it.meta as Record<string, unknown>
          : undefined,
      } as AnnotationItem
    })

    return {
      id: String(l.id ?? `layer-${i}`),
      name: String(l.name ?? `Layer ${i + 1}`),
      color: typeof l.color === 'string' ? l.color : '#646cff',
      opacity: typeof l.opacity === 'number' ? l.opacity : 1,
      visible: typeof l.visible === 'boolean' ? l.visible : true,
      items,
    }
  })

  return {
    version: typeof obj.version === 'string' ? obj.version : '1.0',
    docId: typeof obj.docId === 'string' ? obj.docId : undefined,
    pageCount: typeof obj.pageCount === 'number' ? obj.pageCount : undefined,
    layers,
  }
}
