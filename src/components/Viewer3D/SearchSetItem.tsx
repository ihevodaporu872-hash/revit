import { useState } from 'react'
import { MoreVertical, Eye, Layers, Pencil, Trash2, Crosshair, Plus, Minus, Grid3x3 } from 'lucide-react'
import type { SavedSet, ActiveSetDisplay } from './ifc/types'

interface SearchSetItemProps {
  set: SavedSet
  isActive: boolean
  activeMode: ActiveSetDisplay['mode'] | null
  onDisplay: (mode: ActiveSetDisplay['mode']) => void
  onClearDisplay: () => void
  onRename: (name: string) => void
  onDelete: () => void
  selectedCount: number
  onAddSelected?: () => void
  onRemoveSelected?: () => void
}

export function SearchSetItem({ set, isActive, activeMode, onDisplay, onClearDisplay, onRename, onDelete, selectedCount, onAddSelected, onRemoveSelected }: SearchSetItemProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [newName, setNewName] = useState(set.name)

  const handleRename = () => {
    if (newName.trim()) {
      onRename(newName.trim())
      setRenaming(false)
    }
  }

  const isSelection = set.type === 'selection'

  return (
    <div className={`group flex flex-col gap-1 px-3 py-2 rounded-lg transition-colors ${isActive ? 'bg-primary/10' : 'hover:bg-muted'}`}>
      <div className="flex items-center gap-2">
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
            data-testid={`set-${set.id}-highlight`}
            onClick={() => isActive && activeMode === 'highlight' ? onClearDisplay() : onDisplay('highlight')}
            className={`p-1 rounded text-xs transition-colors ${activeMode === 'highlight' && isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Eye size={12} />
          </button>
          <button
            title="Isolate"
            data-testid={`set-${set.id}-isolate`}
            onClick={() => isActive && activeMode === 'isolate' ? onClearDisplay() : onDisplay('isolate')}
            className={`p-1 rounded text-xs transition-colors ${activeMode === 'isolate' && isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Crosshair size={12} />
          </button>
          <button
            title="Transparent"
            data-testid={`set-${set.id}-transparent`}
            onClick={() => isActive && activeMode === 'transparent' ? onClearDisplay() : onDisplay('transparent')}
            className={`p-1 rounded text-xs transition-colors ${activeMode === 'transparent' && isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Layers size={12} />
          </button>
          <button
            title="Wireframe"
            data-testid={`set-${set.id}-wireframe`}
            onClick={() => isActive && activeMode === 'wireframe' ? onClearDisplay() : onDisplay('wireframe')}
            className={`p-1 rounded text-xs transition-colors ${activeMode === 'wireframe' && isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}
          >
            <Grid3x3 size={12} />
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

      {/* Add/Remove selected buttons — only for selection sets when elements are selected */}
      {isSelection && selectedCount > 0 && (
        <div className="flex items-center gap-1 ml-5 opacity-0 group-hover:opacity-100 transition-opacity">
          {onAddSelected && (
            <button
              onClick={onAddSelected}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-primary bg-primary/10 rounded hover:bg-primary/20 transition-colors"
            >
              <Plus size={10} /> Add Selected
            </button>
          )}
          {onRemoveSelected && (
            <button
              onClick={onRemoveSelected}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium text-destructive bg-destructive/10 rounded hover:bg-destructive/20 transition-colors"
            >
              <Minus size={10} /> Remove
            </button>
          )}
        </div>
      )}
    </div>
  )
}
