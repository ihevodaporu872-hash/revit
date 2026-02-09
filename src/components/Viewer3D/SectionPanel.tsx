import { useState, useEffect, useCallback } from 'react'
import { RotateCcw } from 'lucide-react'
import type { SectionMode, ClipAxis, ClipPlaneState, ClipBoxState } from './ifc/types'

interface SectionPanelProps {
  onUpdate: (mode: SectionMode, planes: ClipPlaneState[], box: ClipBoxState) => void
}

const defaultPlanes: ClipPlaneState[] = [
  { axis: 'x', enabled: false, position: 0.5, flipped: false },
  { axis: 'y', enabled: false, position: 0.5, flipped: false },
  { axis: 'z', enabled: false, position: 0.5, flipped: false },
]

const defaultBox: ClipBoxState = {
  enabled: true,
  xMin: 0, xMax: 1, yMin: 0, yMax: 1, zMin: 0, zMax: 1,
}

const AXIS_COLORS: Record<ClipAxis, string> = { x: 'text-red-400', y: 'text-green-400', z: 'text-blue-400' }
const AXIS_ACCENT: Record<ClipAxis, string> = { x: 'accent-red-400', y: 'accent-green-400', z: 'accent-blue-400' }

export function SectionPanel({ onUpdate }: SectionPanelProps) {
  const [mode, setMode] = useState<SectionMode>('planes')
  const [planes, setPlanes] = useState<ClipPlaneState[]>(defaultPlanes)
  const [box, setBox] = useState<ClipBoxState>(defaultBox)

  const notify = useCallback((m: SectionMode, p: ClipPlaneState[], b: ClipBoxState) => {
    onUpdate(m, p, b)
  }, [onUpdate])

  useEffect(() => {
    notify(mode, planes, box)
  }, [mode, planes, box, notify])

  const updatePlane = (axis: ClipAxis, updates: Partial<ClipPlaneState>) => {
    setPlanes((prev) => prev.map((p) => p.axis === axis ? { ...p, ...updates } : p))
  }

  const reset = () => {
    setPlanes(defaultPlanes)
    setBox(defaultBox)
    setMode('off')
  }

  return (
    <div className="absolute bottom-4 right-4 z-10 w-64 backdrop-blur-md bg-card/90 ring-1 ring-border rounded-xl shadow-2xl overflow-hidden">
      {/* Mode tabs */}
      <div className="flex border-b border-border">
        {(['planes', 'box', 'off'] as SectionMode[]).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`flex-1 px-2 py-2 text-xs font-medium transition-colors ${
              mode === m ? 'text-foreground border-b-2 border-primary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {m === 'planes' ? 'Planes' : m === 'box' ? 'Box' : 'Off'}
          </button>
        ))}
      </div>

      <div className="p-3 space-y-3 max-h-64 overflow-y-auto">
        {mode === 'planes' && planes.map((p) => (
          <div key={p.axis} className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={p.enabled}
                  onChange={(e) => updatePlane(p.axis, { enabled: e.target.checked })}
                  className="rounded border-border"
                />
                <span className={`text-xs font-medium uppercase ${AXIS_COLORS[p.axis]}`}>{p.axis}-Axis</span>
              </label>
              <button
                onClick={() => updatePlane(p.axis, { flipped: !p.flipped })}
                className="text-[10px] text-muted-foreground hover:text-foreground px-1.5 py-0.5 rounded bg-muted"
                title="Flip direction"
              >
                Flip
              </button>
            </div>
            {p.enabled && (
              <input
                type="range"
                min={0} max={1} step={0.01}
                value={p.position}
                onChange={(e) => updatePlane(p.axis, { position: parseFloat(e.target.value) })}
                className={`w-full h-1.5 rounded-full appearance-none bg-muted cursor-pointer ${AXIS_ACCENT[p.axis]}`}
              />
            )}
          </div>
        ))}

        {mode === 'box' && (
          <div className="space-y-2">
            {(['x', 'y', 'z'] as ClipAxis[]).map((axis) => (
              <div key={axis} className="space-y-1">
                <span className={`text-xs font-medium uppercase ${AXIS_COLORS[axis]}`}>{axis}-Axis</span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-6">Min</span>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={box[`${axis}Min` as keyof ClipBoxState] as number}
                    onChange={(e) => setBox((prev) => ({ ...prev, [`${axis}Min`]: parseFloat(e.target.value) }))}
                    className={`flex-1 h-1.5 rounded-full appearance-none bg-muted cursor-pointer ${AXIS_ACCENT[axis]}`}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-muted-foreground w-6">Max</span>
                  <input
                    type="range" min={0} max={1} step={0.01}
                    value={box[`${axis}Max` as keyof ClipBoxState] as number}
                    onChange={(e) => setBox((prev) => ({ ...prev, [`${axis}Max`]: parseFloat(e.target.value) }))}
                    className={`flex-1 h-1.5 rounded-full appearance-none bg-muted cursor-pointer ${AXIS_ACCENT[axis]}`}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {mode === 'off' && (
          <p className="text-xs text-muted-foreground/60 text-center py-4">Section clipping disabled</p>
        )}
      </div>

      <div className="px-3 py-2 border-t border-border">
        <button
          onClick={reset}
          className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors"
        >
          <RotateCcw size={12} />
          Reset
        </button>
      </div>
    </div>
  )
}
