import { useState } from 'react'
import { X } from 'lucide-react'

const PRESET_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899',
  '#f43f5e', '#14b8a6', '#6366f1', '#a855f7',
]

interface ColorPickerPopoverProps {
  currentColor?: string
  onApply: (color: string) => void
  onClear: () => void
  onClose: () => void
}

export function ColorPickerPopover({ currentColor, onApply, onClear, onClose }: ColorPickerPopoverProps) {
  const [hex, setHex] = useState(currentColor || '#3b82f6')

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute right-0 top-8 z-50 w-52 bg-card border border-border rounded-xl shadow-2xl p-3 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-foreground">Pick Color</span>
          <button onClick={onClose} className="p-0.5 text-muted-foreground hover:text-foreground">
            <X size={12} />
          </button>
        </div>

        {/* Preset colors grid */}
        <div className="grid grid-cols-6 gap-1.5">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setHex(c)}
              className={`w-6 h-6 rounded-md border-2 transition-all ${
                hex === c ? 'border-foreground scale-110' : 'border-transparent hover:border-muted-foreground'
              }`}
              style={{ backgroundColor: c }}
            />
          ))}
        </div>

        {/* Hex input */}
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded border border-border shrink-0" style={{ backgroundColor: hex }} />
          <input
            type="text"
            value={hex}
            onChange={(e) => setHex(e.target.value)}
            placeholder="#000000"
            className="flex-1 h-7 text-xs bg-muted border border-border rounded px-2 text-foreground font-mono"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => { onApply(hex); onClose() }}
            className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            Apply
          </button>
          {currentColor && (
            <button
              onClick={() => { onClear(); onClose() }}
              className="px-3 py-1.5 text-xs font-medium text-destructive bg-destructive/10 rounded-lg hover:bg-destructive/20 transition-colors"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </>
  )
}
