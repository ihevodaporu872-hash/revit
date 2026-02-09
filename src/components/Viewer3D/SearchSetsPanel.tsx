import { useState } from 'react'
import { Plus, Bookmark, Search } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { SearchSetItem } from './SearchSetItem'
import { CreateSetDialog } from './CreateSetDialog'
import type { SavedSet } from './ifc/types'

interface SearchSetsPanelProps {
  selectedIds: number[]
}

export function SearchSetsPanel({ selectedIds }: SearchSetsPanelProps) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const { savedSets, activeDisplay, addSet, updateSet, deleteSet, setActiveDisplay, addElementsToSet, removeElementsFromSet } = useViewerStore()

  const selectionSets = savedSets.filter((s) => s.type === 'selection')
  const searchSets = savedSets.filter((s) => s.type === 'search')

  const handleCreate = (set: SavedSet) => {
    addSet(set)
  }

  const renderSetItem = (set: SavedSet) => (
    <SearchSetItem
      key={set.id}
      set={set}
      isActive={activeDisplay?.setId === set.id}
      activeMode={activeDisplay?.setId === set.id ? activeDisplay.mode : null}
      onDisplay={(mode) => setActiveDisplay({ setId: set.id, mode })}
      onClearDisplay={() => setActiveDisplay(null)}
      onRename={(name) => updateSet(set.id, { name })}
      onDelete={() => deleteSet(set.id)}
      selectedCount={selectedIds.length}
      onAddSelected={set.type === 'selection' ? () => addElementsToSet(set.id, selectedIds) : undefined}
      onRemoveSelected={set.type === 'selection' ? () => removeElementsFromSet(set.id, selectedIds) : undefined}
    />
  )

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Search Sets</span>
        <button
          onClick={() => setDialogOpen(true)}
          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
          title="Create Set"
        >
          <Plus size={14} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto py-2 px-1 space-y-4">
        {/* Selection Sets */}
        <div>
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Bookmark size={12} className="text-primary" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Selection Sets</span>
          </div>
          {selectionSets.length === 0 ? (
            <p className="px-3 py-2 text-[10px] text-muted-foreground/60">
              Select elements and save as a set
            </p>
          ) : (
            selectionSets.map(renderSetItem)
          )}
        </div>

        {/* Search Sets */}
        <div>
          <div className="flex items-center gap-1.5 px-2 py-1">
            <Search size={12} className="text-warning" />
            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Search Sets</span>
          </div>
          {searchSets.length === 0 ? (
            <p className="px-3 py-2 text-[10px] text-muted-foreground/60">
              Create search criteria to find elements
            </p>
          ) : (
            searchSets.map(renderSetItem)
          )}
        </div>
      </div>

      {/* Quick action */}
      {selectedIds.length > 0 && (
        <div className="border-t border-border px-3 py-2">
          <button
            onClick={() => setDialogOpen(true)}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
          >
            <Bookmark size={12} />
            Save Selection ({selectedIds.length})
          </button>
        </div>
      )}

      <CreateSetDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        onCreate={handleCreate}
        selectedIds={selectedIds}
      />
    </div>
  )
}
