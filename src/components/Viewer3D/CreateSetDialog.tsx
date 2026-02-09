import { useState } from 'react'
import { X, Bookmark, Search } from 'lucide-react'
import type { SavedSet, SearchCriterion, SearchLogic } from './ifc/types'
import { SearchCriteriaBuilder } from './SearchCriteriaBuilder'

const COLORS = ['#3b82f6', '#ef4444', '#22c55e', '#eab308', '#a855f7', '#ec4899', '#06b6d4', '#f97316']

interface CreateSetDialogProps {
  open: boolean
  onClose: () => void
  onCreate: (set: SavedSet) => void
  selectedIds: number[]
}

export function CreateSetDialog({ open, onClose, onCreate, selectedIds }: CreateSetDialogProps) {
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [type, setType] = useState<'selection' | 'search'>(selectedIds.length > 0 ? 'selection' : 'search')
  const [criteria, setCriteria] = useState<SearchCriterion[]>([
    { id: '1', field: 'type', operator: 'equals', value: '' },
  ])
  const [logic, setLogic] = useState<SearchLogic>('AND')

  if (!open) return null

  const handleCreate = () => {
    if (!name.trim()) return
    const set: SavedSet = {
      id: Date.now().toString(),
      name: name.trim(),
      color,
      type,
      createdAt: Date.now(),
      ...(type === 'selection'
        ? { expressIDs: selectedIds }
        : { criteria, logic }),
    }
    onCreate(set)
    setName('')
    setCriteria([{ id: '1', field: 'type', operator: 'equals', value: '' }])
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[480px] bg-card border border-border rounded-xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Create Set</h3>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Type tabs */}
          <div className="flex gap-2">
            <button
              onClick={() => setType('selection')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                type === 'selection' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Bookmark size={14} />
              Selection Set ({selectedIds.length})
            </button>
            <button
              onClick={() => setType('search')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                type === 'search' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              <Search size={14} />
              Search Set
            </button>
          </div>

          {/* Name */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Exterior Walls"
              className="w-full h-9 text-sm bg-muted border border-border rounded-lg px-3 text-foreground placeholder:text-muted-foreground"
              autoFocus
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-xs text-muted-foreground block mb-1.5">Color</label>
            <div className="flex gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-6 h-6 rounded-full transition-all ${
                    color === c ? 'ring-2 ring-offset-2 ring-offset-card ring-primary scale-110' : 'hover:scale-110'
                  }`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>

          {/* Criteria (search set only) */}
          {type === 'search' && (
            <div>
              <label className="text-xs text-muted-foreground block mb-1.5">Search Criteria</label>
              <SearchCriteriaBuilder
                criteria={criteria}
                logic={logic}
                onChange={setCriteria}
                onLogicChange={setLogic}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="px-4 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Create Set
          </button>
        </div>
      </div>
    </div>
  )
}
