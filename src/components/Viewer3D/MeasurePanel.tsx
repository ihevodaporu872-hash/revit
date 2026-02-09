import { useState, useEffect } from 'react'
import { Trash2, X } from 'lucide-react'

interface MeasureEntry {
  id: string
  distance: number
}

interface MeasurePanelProps {
  getMeasurements: () => MeasureEntry[]
  hasPendingPoint: () => boolean
  onDelete: (id: string) => void
  onClearAll: () => void
}

export function MeasurePanel({ getMeasurements, hasPendingPoint, onDelete, onClearAll }: MeasurePanelProps) {
  const [, setTick] = useState(0)

  // Re-render periodically to pick up new measurements
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(interval)
  }, [])

  const measurements = getMeasurements()
  const total = measurements.reduce((sum, m) => sum + m.distance, 0)
  const pending = hasPendingPoint()

  return (
    <div className="absolute bottom-4 right-4 z-10 w-56 backdrop-blur-md bg-card/90 ring-1 ring-border rounded-xl shadow-2xl overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-foreground">Measurements</span>
        {measurements.length > 0 && (
          <button
            onClick={onClearAll}
            className="text-[10px] text-muted-foreground hover:text-destructive transition-colors"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
        {/* Status */}
        <p className="text-[10px] text-muted-foreground px-1 mb-1">
          {pending ? 'Click to place point B' : 'Click to place point A'}
        </p>

        {measurements.length === 0 ? (
          <p className="text-xs text-muted-foreground/60 text-center py-3">No measurements</p>
        ) : (
          measurements.map((m, i) => (
            <div
              key={m.id}
              className="flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-muted group"
            >
              <span className="text-xs text-foreground">
                <span className="text-muted-foreground">#{i + 1}</span>{' '}
                <span className="font-medium">{m.distance.toFixed(3)} m</span>
              </span>
              <button
                onClick={() => onDelete(m.id)}
                className="opacity-0 group-hover:opacity-100 p-0.5 text-muted-foreground hover:text-destructive transition-all"
              >
                <X size={12} />
              </button>
            </div>
          ))
        )}
      </div>

      {measurements.length > 1 && (
        <div className="px-3 py-2 border-t border-border">
          <div className="flex justify-between text-xs">
            <span className="text-muted-foreground">Total</span>
            <span className="font-semibold text-foreground">{total.toFixed(3)} m</span>
          </div>
        </div>
      )}
    </div>
  )
}
