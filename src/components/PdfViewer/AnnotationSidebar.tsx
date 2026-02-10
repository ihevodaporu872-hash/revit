import { useCallback } from 'react'
import { X } from 'lucide-react'
import type { AnnotationLayer, AnnotationItem } from './types'

interface AnnotationSidebarProps {
  layers: AnnotationLayer[]
  selectedItemId: string | null
  onToggleLayer: (layerId: string) => void
  onChangeLayerColor: (layerId: string, color: string) => void
  onChangeLayerOpacity: (layerId: string, opacity: number) => void
  onSelectItem: (item: AnnotationItem) => void
  onClose: () => void
}

export function AnnotationSidebar({
  layers,
  selectedItemId,
  onToggleLayer,
  onChangeLayerColor,
  onChangeLayerOpacity,
  onSelectItem,
  onClose,
}: AnnotationSidebarProps) {
  const totalPoints = layers.reduce((sum, l) => sum + l.items.filter(i => i.kind === 'count_point').length, 0)
  const totalPolygons = layers.reduce((sum, l) => sum + l.items.filter(i => i.kind === 'area_polygon').length, 0)
  const totalDimensions = layers.reduce((sum, l) => sum + l.items.filter(i => i.kind === 'dimension_line').length, 0)

  return (
    <div className="flex w-72 min-w-[280px] flex-col border-l border-border bg-card">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <h3 className="text-sm font-semibold text-foreground">Markup Layers</h3>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground transition-colors hover:text-foreground" title="Close sidebar">
          <X size={16} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2 px-4 py-2">
        {totalPoints > 0 && <span className="rounded-full bg-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">{totalPoints} points</span>}
        {totalDimensions > 0 && <span className="rounded-full bg-green-500/20 px-2 py-0.5 text-[11px] font-medium text-green-400">{totalDimensions} dimensions</span>}
        {totalPolygons > 0 && <span className="rounded-full bg-orange-500/20 px-2 py-0.5 text-[11px] font-medium text-orange-400">{totalPolygons} polygons</span>}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {layers.map(layer => (
          <LayerControl
            key={layer.id}
            layer={layer}
            selectedItemId={selectedItemId}
            onToggle={onToggleLayer}
            onChangeColor={onChangeLayerColor}
            onChangeOpacity={onChangeLayerOpacity}
            onSelectItem={onSelectItem}
          />
        ))}
      </div>
    </div>
  )
}

interface LayerControlProps {
  layer: AnnotationLayer
  selectedItemId: string | null
  onToggle: (layerId: string) => void
  onChangeColor: (layerId: string, color: string) => void
  onChangeOpacity: (layerId: string, opacity: number) => void
  onSelectItem: (item: AnnotationItem) => void
}

function LayerControl({ layer, selectedItemId, onToggle, onChangeColor, onChangeOpacity, onSelectItem }: LayerControlProps) {
  const handleToggle = useCallback(() => onToggle(layer.id), [layer.id, onToggle])
  const handleColorChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChangeColor(layer.id, e.target.value),
    [layer.id, onChangeColor],
  )
  const handleOpacityChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChangeOpacity(layer.id, parseFloat(e.target.value)),
    [layer.id, onChangeOpacity],
  )

  const pointCount = layer.items.filter(i => i.kind === 'count_point').length
  const polygonCount = layer.items.filter(i => i.kind === 'area_polygon').length
  const dimensionCount = layer.items.filter(i => i.kind === 'dimension_line').length

  return (
    <div className={`mb-2 rounded-lg bg-muted/40 p-2 transition-opacity ${!layer.visible ? 'opacity-50' : ''}`}>
      <div className="mb-1 flex items-center justify-between">
        <label className="flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={layer.visible} onChange={handleToggle}
            className="h-3.5 w-3.5 cursor-pointer accent-primary" />
          <span className="text-xs font-medium text-foreground">{layer.name}</span>
        </label>
        <input type="color" value={layer.color} onChange={handleColorChange}
          className="h-6 w-6 cursor-pointer rounded border border-border bg-transparent p-0"
          title="Layer color" />
      </div>

      <div className="mb-1 flex items-center gap-2">
        <span className="min-w-[40px] text-[11px] text-muted-foreground">Opacity</span>
        <input type="range" min="0" max="1" step="0.05" value={layer.opacity} onChange={handleOpacityChange}
          className="h-1 flex-1 appearance-none rounded-full bg-muted accent-primary" />
        <span className="min-w-[30px] text-right text-[11px] text-muted-foreground">{Math.round(layer.opacity * 100)}%</span>
      </div>

      <div className="mb-1 flex gap-2">
        {pointCount > 0 && <span className="text-[10px] text-muted-foreground">{pointCount} pt</span>}
        {dimensionCount > 0 && <span className="text-[10px] text-muted-foreground">{dimensionCount} dim</span>}
        {polygonCount > 0 && <span className="text-[10px] text-muted-foreground">{polygonCount} poly</span>}
      </div>

      <div className="max-h-48 overflow-y-auto">
        {layer.items.map(item => (
          <button
            key={item.id}
            className={`flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs transition-colors ${
              item.id === selectedItemId
                ? 'bg-primary/30 text-foreground'
                : 'text-muted-foreground hover:bg-primary/15'
            }`}
            onClick={() => onSelectItem(item)}
            title={`Page ${item.page} — ${item.kind}`}
          >
            <span className="w-4 shrink-0 text-center text-[11px]">
              {item.kind === 'count_point' ? '\u25CF' : item.kind === 'dimension_line' ? '\u2194' : '\u2B21'}
            </span>
            <span className="flex-1 truncate">{item.label || item.id.slice(0, 8)}</span>
            <span className="shrink-0 text-[10px] text-muted-foreground">p.{item.page}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
