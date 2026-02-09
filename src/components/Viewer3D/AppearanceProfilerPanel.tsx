import { useState } from 'react'
import { Palette, Loader2 } from 'lucide-react'
import type { ProfileLegendEntry } from './ifc/types'

const FIELDS = [
  { value: 'type', label: 'IFC Type' },
  { value: 'name', label: 'Name' },
  { value: 'material', label: 'Material' },
  { value: 'objectType', label: 'Object Type' },
]

interface AppearanceProfilerPanelProps {
  activeProfile: { field: string; legend: ProfileLegendEntry[] } | null
  onApply: (field: string) => void
  onClear: () => void
  isProcessing: boolean
}

export function AppearanceProfilerPanel({ activeProfile, onApply, onClear, isProcessing }: AppearanceProfilerPanelProps) {
  const [selectedField, setSelectedField] = useState('type')

  const totalElements = activeProfile?.legend.reduce((sum, e) => sum + e.count, 0) ?? 0

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Profiler</span>
      </div>

      <div className="px-3 py-3 space-y-3">
        {/* Field selector */}
        <div>
          <label className="text-[10px] text-muted-foreground block mb-1">Color By</label>
          <select
            value={selectedField}
            onChange={(e) => setSelectedField(e.target.value)}
            className="w-full h-8 text-xs bg-muted border border-border rounded-lg px-2 text-foreground"
          >
            {FIELDS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
        </div>

        {/* Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => onApply(selectedField)}
            disabled={isProcessing}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            {isProcessing ? <Loader2 size={12} className="animate-spin" /> : <Palette size={12} />}
            Apply
          </button>
          {activeProfile && (
            <button
              onClick={onClear}
              className="px-3 py-1.5 text-xs font-medium text-muted-foreground bg-muted rounded-lg hover:text-foreground transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Legend */}
      {activeProfile && (
        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <p className="text-[10px] text-muted-foreground mb-2">
            {activeProfile.legend.length} groups · {totalElements} elements
          </p>
          <div className="space-y-1">
            {activeProfile.legend.map((entry) => (
              <div key={entry.value} className="flex items-center gap-2 py-1">
                <div
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: entry.color }}
                />
                <span className="text-xs text-foreground truncate flex-1">{entry.value}</span>
                <span className="text-[10px] text-muted-foreground">{entry.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
