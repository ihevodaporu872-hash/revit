import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { MeasureMode } from './ifc/types'

interface MeasureEntry {
  id: string
  distance: number
  type: 'distance' | 'area'
}

interface MeasurePanelProps {
  getMeasurements: () => MeasureEntry[]
  hasPendingPoint: () => boolean
  onDelete: (id: string) => void
  onClearAll: () => void
  mode: MeasureMode
  onModeChange: (mode: MeasureMode) => void
}

export function MeasurePanel({ getMeasurements, hasPendingPoint, onDelete, onClearAll, mode, onModeChange }: MeasurePanelProps) {
  const [, setTick] = useState(0)

  // Re-render periodically to pick up new measurements
  useEffect(() => {
    const interval = setInterval(() => setTick((t) => t + 1), 500)
    return () => clearInterval(interval)
  }, [])

  const measurements = getMeasurements()
  const distanceMeasurements = measurements.filter(m => m.type === 'distance')
  const areaMeasurements = measurements.filter(m => m.type === 'area')
  const totalDistance = distanceMeasurements.reduce((sum, m) => sum + m.distance, 0)
  const totalArea = areaMeasurements.reduce((sum, m) => sum + m.distance, 0)
  const pending = hasPendingPoint()

  const getStatusText = () => {
    if (mode === 'distance') {
      return pending ? 'Click to place point B' : 'Click to place point A'
    }
    return pending ? 'Click to add vertex, double-click or click near first point to close' : 'Click to start polygon'
  }

  return (
    <div className="absolute bottom-4 right-4 z-10 w-64 backdrop-blur-md bg-card/90 ring-1 ring-border rounded-xl shadow-2xl overflow-hidden">
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

      {/* Mode toggle */}
      <div className="flex mx-2 mt-2 bg-muted rounded-lg p-0.5">
        <button
          onClick={() => onModeChange('distance')}
          className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${
            mode === 'distance' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Distance
        </button>
        <button
          onClick={() => onModeChange('area')}
          className={`flex-1 text-[10px] font-medium py-1.5 rounded-md transition-colors ${
            mode === 'area' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Area
        </button>
      </div>

      <div className="p-2 space-y-1 max-h-48 overflow-y-auto">
        {/* Status */}
        <p className="text-[10px] text-muted-foreground px-1 mb-1">
          {getStatusText()}
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
                <span className="font-medium">
                  {m.type === 'area' ? `${m.distance.toFixed(3)} m²` : `${m.distance.toFixed(3)} m`}
                </span>
                {m.type === 'area' && (
                  <span className="text-[9px] text-muted-foreground ml-1">area</span>
                )}
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

      {(distanceMeasurements.length > 1 || areaMeasurements.length > 1) && (
        <div className="px-3 py-2 border-t border-border space-y-0.5">
          {distanceMeasurements.length > 1 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total dist.</span>
              <span className="font-semibold text-foreground">{totalDistance.toFixed(3)} m</span>
            </div>
          )}
          {areaMeasurements.length > 1 && (
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">Total area</span>
              <span className="font-semibold text-foreground">{totalArea.toFixed(3)} m²</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
