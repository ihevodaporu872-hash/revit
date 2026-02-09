import { useState } from 'react'
import { MoreVertical, Eye, EyeOff, Layers, Pencil, Trash2, Crosshair } from 'lucide-react'
import type { SavedSet, ActiveSetDisplay } from './ifc/types'

interface SearchSetItemProps {
  set: SavedSet
  isActive: boolean
  activeMode: ActiveSetDisplay['mode'] | null
  onDisplay: (mode: ActiveSetDisplay['mode']) => void
  onClearDisplay: () => void
  onRename: (name: string) => void
  onDelete: () => void
}

export function SearchSetItem({ set, isActive, activeMode, onDisplay, onClearDisplay, onRename, onDelete }: SearchSetItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(set.name)

  const handleRename = () => {
    if (newName.trim()) {
      onRename(newName.trim())
      setRenaming(false)
    }
  }

  return (
    <div className={`group flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-muted'}`}>
      <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: set.color }} />

      {renaming ? (
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onBlur={handleRename}
          onKeyDown={(e) => e.key === 'Enter' && handleRename()}
          className="flex-1 h-6 text-xs bg-muted border border-border rounded px-2 text-foreground"
          autoFocus
        />
      ) : (
        <div className="flex-1 min-w-0">
          <p className="text-xs font-medium text-foreground truncate">{set.name}</p>
          <p className="text-[10px] text-muted-foreground">
            {set.type === 'selection'
              ? `${set.expressIDs?.length || 0} elements`
              : `${set.criteria?.length || 0} criteria`}
          </p>
        </div>
      )}

      {/* Quick action buttons */}
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          title="Highlight"
          onClick={() => isActive && activeMode === 'highlight' ? onClearDisplay() : onDisplay('highlight')}
          className={`p-1 rounded text-xs transition-colors ${activeMode === 'highlight' && isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Eye size={12} />
        </button>
        <button
          title="Isolate"
          onClick={() => isActive && activeMode === 'isolate' ? onClearDisplay() : onDisplay('isolate')}
          className={`p-1 rounded text-xs transition-colors ${activeMode === 'isolate' && isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Crosshair size={12} />
        </button>
        <button
          title="Transparent"
          onClick={() => isActive && activeMode === 'transparent' ? onClearDisplay() : onDisplay('transparent')}
          className={`p-1 rounded text-xs transition-colors ${activeMode === 'transparent' && isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
        >
          <Layers size={12} />
        </button>
      </div>

      {/* Menu */}
      <div className="relative">
        <button
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1 rounded text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-all"
        >
          <MoreVertical size={12} />
        </button>
        {menuOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setMenuOpen(false)} />
            <div className="absolute right-0 top-6 z-50 w-36 bg-card border border-border rounded-lg shadow-lg py-1">
              <button
                onClick={() => { setRenaming(true); setMenuOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted"
              >
                <Pencil size={12} /> Rename
              </button>
              <button
                onClick={() => { onDelete(); setMenuOpen(false) }}
                className="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-destructive hover:bg-muted"
              >
                <Trash2 size={12} /> Delete
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
