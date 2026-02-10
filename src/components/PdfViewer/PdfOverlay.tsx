import { useMemo, useCallback } from 'react'
import type { AnnotationItem, AnnotationLayer, AnnotationPoint } from './types'

interface PdfOverlayProps {
  pageIndex: number
  viewportWidth: number
  viewportHeight: number
  baseWidth: number
  baseHeight: number
  layers: AnnotationLayer[]
  selectedItemId: string | null
  onItemClick: (item: AnnotationItem) => void
}

function computeCentroid(points: AnnotationPoint[]): AnnotationPoint {
  if (points.length === 0) return { x: 0, y: 0 }
  if (points.length === 1) return points[0]
  let cx = 0, cy = 0
  for (const p of points) { cx += p.x; cy += p.y }
  return { x: cx / points.length, y: cy / points.length }
}

function computePolygonArea(points: AnnotationPoint[]): number {
  if (points.length < 3) return 0
  let area = 0
  const n = points.length
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n
    area += points[i].x * points[j].y
    area -= points[j].x * points[i].y
  }
  return Math.abs(area) / 2
}

function formatArea(area: number, scaleX?: number, scaleUnits?: string): string {
  if (scaleX && scaleX > 0 && scaleUnits) {
    const realArea = area / (scaleX * scaleX)
    if (realArea >= 1) return `${realArea.toFixed(2)} ${scaleUnits}\u00B2`
    return `${realArea.toFixed(4)} ${scaleUnits}\u00B2`
  }
  return `${area.toFixed(1)} px\u00B2`
}

export function PdfOverlay({
  pageIndex,
  viewportWidth,
  viewportHeight,
  baseWidth,
  baseHeight,
  layers,
  selectedItemId,
  onItemClick,
}: PdfOverlayProps) {
  const pageItems = useMemo(() => {
    const items: Array<{ item: AnnotationItem; layerColor: string; layerOpacity: number }> = []
    for (const layer of layers) {
      if (!layer.visible) continue
      for (const item of layer.items) {
        if (item.page === pageIndex) {
          items.push({ item, layerColor: layer.color, layerOpacity: layer.opacity })
        }
      }
    }
    return items
  }, [layers, pageIndex])

  const handleItemClick = useCallback(
    (e: React.MouseEvent, item: AnnotationItem) => {
      e.stopPropagation()
      onItemClick(item)
    },
    [onItemClick],
  )

  if (pageItems.length === 0) return null

  const scaleRatio = viewportWidth / baseWidth

  return (
    <svg
      width={viewportWidth}
      height={viewportHeight}
      viewBox={`0 0 ${baseWidth} ${baseHeight}`}
      preserveAspectRatio="none"
      style={{ position: 'absolute', top: 0, left: 0, pointerEvents: 'none' }}
    >
      {pageItems.map(({ item, layerColor, layerOpacity }) => {
        const color = item.color || layerColor
        const opacity = item.opacity ?? layerOpacity
        const isSelected = item.id === selectedItemId

        switch (item.kind) {
          case 'count_point':
            return (
              <CountPointMarker key={item.id} item={item} color={color} opacity={opacity}
                isSelected={isSelected} onClick={handleItemClick} scaleRatio={scaleRatio} />
            )
          case 'dimension_line':
            return (
              <DimensionLineMarker key={item.id} item={item} color={color} opacity={opacity}
                isSelected={isSelected} onClick={handleItemClick} scaleRatio={scaleRatio} />
            )
          case 'area_polygon':
            return (
              <AreaPolygonMarker key={item.id} item={item} color={color} opacity={opacity}
                isSelected={isSelected} onClick={handleItemClick} scaleRatio={scaleRatio} />
            )
          default:
            return null
        }
      })}
    </svg>
  )
}

interface MarkerProps {
  item: AnnotationItem
  color: string
  opacity: number
  isSelected: boolean
  onClick: (e: React.MouseEvent, item: AnnotationItem) => void
  scaleRatio: number
}

function CountPointMarker({ item, color, opacity, isSelected, onClick, scaleRatio }: MarkerProps) {
  const point = item.points[0]
  if (!point) return null
  const radius = (isSelected ? 8 : 6) / scaleRatio
  const hitRadius = 14 / scaleRatio
  const strokeW = (isSelected ? 3 : 2) / scaleRatio
  const fontSize = 12 / scaleRatio

  return (
    <g style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={(e) => onClick(e, item)}>
      <circle cx={point.x} cy={point.y} r={hitRadius} fill="transparent" />
      <circle cx={point.x} cy={point.y} r={radius}
        fill={color} fillOpacity={opacity * 0.6}
        stroke={isSelected ? '#ffffff' : color} strokeWidth={strokeW} strokeOpacity={opacity} />
      {isSelected && (
        <circle cx={point.x} cy={point.y} r={radius + 4 / scaleRatio}
          fill="none" stroke="#ffffff" strokeWidth={1.5 / scaleRatio}
          strokeDasharray={`${3 / scaleRatio} ${3 / scaleRatio}`} opacity={0.8} />
      )}
      {item.label && (
        <text x={point.x + radius + 4 / scaleRatio} y={point.y + fontSize / 3}
          fill={color} fontSize={fontSize} fontFamily="Arial, sans-serif"
          fontWeight={isSelected ? 'bold' : 'normal'} opacity={opacity}
          style={{ pointerEvents: 'none' }}>
          {item.label}
        </text>
      )}
    </g>
  )
}

function DimensionLineMarker({ item, color, opacity, isSelected, onClick, scaleRatio }: MarkerProps) {
  if (item.points.length < 2) {
    return <CountPointMarker item={item} color={color} opacity={opacity} isSelected={isSelected} onClick={onClick} scaleRatio={scaleRatio} />
  }
  const [p1, p2] = item.points
  const midX = (p1.x + p2.x) / 2
  const midY = (p1.y + p2.y) / 2
  const strokeW = (isSelected ? 3 : 2) / scaleRatio
  const dotR = 4 / scaleRatio
  const fontSize = 12 / scaleRatio

  return (
    <g style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={(e) => onClick(e, item)}>
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y} stroke="transparent" strokeWidth={14 / scaleRatio} />
      <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
        stroke={isSelected ? '#ffffff' : color} strokeWidth={strokeW} strokeOpacity={opacity} />
      <circle cx={p1.x} cy={p1.y} r={dotR} fill={color} fillOpacity={opacity} />
      <circle cx={p2.x} cy={p2.y} r={dotR} fill={color} fillOpacity={opacity} />
      {isSelected && (
        <line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
          stroke="#ffffff" strokeWidth={1 / scaleRatio}
          strokeDasharray={`${4 / scaleRatio} ${4 / scaleRatio}`} opacity={0.6} />
      )}
      {item.label && (
        <text x={midX} y={midY - 8 / scaleRatio}
          fill={color} fontSize={fontSize} fontFamily="Arial, sans-serif"
          fontWeight={isSelected ? 'bold' : 'normal'} textAnchor="middle" opacity={opacity}
          style={{ pointerEvents: 'none' }}>
          {item.label}
        </text>
      )}
    </g>
  )
}

function AreaPolygonMarker({ item, color, opacity, isSelected, onClick, scaleRatio }: MarkerProps) {
  if (item.points.length < 3) {
    return <DimensionLineMarker item={item} color={color} opacity={opacity} isSelected={isSelected} onClick={onClick} scaleRatio={scaleRatio} />
  }
  const pathData = item.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ') + ' Z'
  const centroid = computeCentroid(item.points)
  const area = computePolygonArea(item.points)
  const meta = item.meta as Record<string, unknown> | undefined
  const scaleX = meta?.scaleX as number | undefined
  const scaleUnits = meta?.scaleUnits as string | undefined
  const areaLabel = item.label || formatArea(area, scaleX, scaleUnits)
  const strokeW = (isSelected ? 3 : 2) / scaleRatio
  const dotR = 3 / scaleRatio
  const fontSize = 13 / scaleRatio

  return (
    <g style={{ pointerEvents: 'all', cursor: 'pointer' }} onClick={(e) => onClick(e, item)}>
      <path d={pathData} fill={color} fillOpacity={opacity * 0.25}
        stroke={isSelected ? '#ffffff' : color} strokeWidth={strokeW}
        strokeOpacity={opacity} strokeLinejoin="round" />
      {isSelected && (
        <path d={pathData} fill="none" stroke="#ffffff"
          strokeWidth={1.5 / scaleRatio}
          strokeDasharray={`${5 / scaleRatio} ${5 / scaleRatio}`} opacity={0.7} />
      )}
      {item.points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r={dotR} fill={color} fillOpacity={opacity} />
      ))}
      <text x={centroid.x} y={centroid.y}
        fill={isSelected ? '#ffffff' : color} fontSize={fontSize}
        fontFamily="Arial, sans-serif" fontWeight="bold" textAnchor="middle"
        dominantBaseline="central" opacity={Math.min(opacity + 0.2, 1)}
        style={{ pointerEvents: 'none' }}>
        {areaLabel}
      </text>
    </g>
  )
}
