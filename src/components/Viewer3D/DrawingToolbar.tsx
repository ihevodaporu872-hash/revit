import { motion } from 'framer-motion'
import {
  Pen,
  Minus,
  Square,
  Circle,
  ArrowRight,
  Type,
  Eraser,
  Undo2,
  Trash2,
  Save,
} from 'lucide-react'
import type { DrawingToolType, DrawingSettings } from './ifc/types'

const TOOLS: { id: DrawingToolType; icon: React.ReactNode; label: string; key: string }[] = [
  { id: 'pen', icon: <Pen size={16} />, label: 'Pen', key: 'P' },
  { id: 'line', icon: <Minus size={16} />, label: 'Line', key: 'L' },
  { id: 'rectangle', icon: <Square size={16} />, label: 'Rectangle', key: 'R' },
  { id: 'circle', icon: <Circle size={16} />, label: 'Circle', key: 'C' },
  { id: 'arrow', icon: <ArrowRight size={16} />, label: 'Arrow', key: 'A' },
  { id: 'text', icon: <Type size={16} />, label: 'Text', key: 'T' },
  { id: 'eraser', icon: <Eraser size={16} />, label: 'Eraser', key: 'E' },
]

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#a855f7', '#ec4899', '#ffffff']
const LINE_WIDTHS = [2, 4, 6, 8]

interface DrawingToolbarProps {
  settings: DrawingSettings
  onSettingsChange: (s: Partial<DrawingSettings>) => void
  onUndo: () => void
  onClear: () => void
  onSaveViewpoint: () => void
}

export function DrawingToolbar({ settings, onSettingsChange, onUndo, onClear, onSaveViewpoint }: DrawingToolbarProps) {
  return (
    <motion.div
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      exit={{ y: 20, opacity: 0 }}
      className="absolute bottom-4 left-1/2 -translate-x-1/2 z-20 flex items-center gap-2 backdrop-blur-md bg-card/90 ring-1 ring-border rounded-xl shadow-2xl px-3 py-2"
    >
      {/* Drawing tools */}
      <div className="flex items-center gap-1">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            title={`${t.label} (${t.key})`}
            onClick={() => onSettingsChange({ tool: t.id })}
            className={`p-2 rounded-lg transition-colors ${
              settings.tool === t.id
                ? 'bg-primary text-white'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            }`}
          >
            {t.icon}
          </button>
        ))}
      </div>

      <div className="w-px h-7 bg-border" />

      {/* Colors */}
      <div className="flex items-center gap-1">
        {COLORS.map((c) => (
          <button
            key={c}
            onClick={() => onSettingsChange({ color: c })}
            className={`w-5 h-5 rounded-full transition-all border ${
              settings.color === c ? 'ring-2 ring-primary ring-offset-1 ring-offset-card scale-110' : 'border-border hover:scale-110'
            }`}
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      <div className="w-px h-7 bg-border" />

      {/* Line width */}
      <div className="flex items-center gap-1">
        {LINE_WIDTHS.map((w) => (
          <button
            key={w}
            title={`${w}px`}
            onClick={() => onSettingsChange({ lineWidth: w })}
            className={`w-7 h-7 flex items-center justify-center rounded-lg transition-colors ${
              settings.lineWidth === w
                ? 'bg-primary/20 text-primary'
                : 'text-muted-foreground hover:bg-muted'
            }`}
          >
            <div
              className="rounded-full bg-current"
              style={{ width: w + 2, height: w + 2 }}
            />
          </button>
        ))}
      </div>

      <div className="w-px h-7 bg-border" />

      {/* Actions */}
      <div className="flex items-center gap-1">
        <button
          title="Undo (Ctrl+Z)"
          onClick={onUndo}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Undo2 size={16} />
        </button>
        <button
          title="Clear All (Delete)"
          onClick={onClear}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-destructive transition-colors"
        >
          <Trash2 size={16} />
        </button>
        <button
          title="Save Viewpoint"
          onClick={onSaveViewpoint}
          className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
        >
          <Save size={16} />
        </button>
      </div>
    </motion.div>
  )
}
