import { useState } from 'react'
import { X, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import type { SavedSet } from './ifc/types'

interface ExportDialogProps {
  open: boolean
  onClose: () => void
  onExport: (scope: 'all' | 'selected' | 'set', setId?: string) => void
  selectedCount: number
  savedSets: SavedSet[]
  isExporting: boolean
  exportProgress: number
}

export function ExportDialog({ open, onClose, onExport, selectedCount, savedSets, isExporting, exportProgress }: ExportDialogProps) {
  const [scope, setScope] = useState<'all' | 'selected' | 'set'>('all')
  const [selectedSetId, setSelectedSetId] = useState<string>('')

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[420px] bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <FileSpreadsheet size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Export to Excel</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded" disabled={isExporting}>
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-3">
          {/* Scope options */}
          <div className="space-y-2">
            <button
              onClick={() => setScope('all')}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                scope === 'all' ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Export All Elements
            </button>
            <button
              onClick={() => setScope('selected')}
              disabled={selectedCount === 0}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                scope === 'selected' ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Export Selected ({selectedCount})
            </button>
            <button
              onClick={() => setScope('set')}
              disabled={savedSets.length === 0}
              className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-colors disabled:opacity-50 ${
                scope === 'set' ? 'bg-primary/10 text-primary ring-1 ring-primary/30' : 'bg-muted text-muted-foreground hover:text-foreground'
              }`}
            >
              Export Search Set
            </button>
          </div>

          {scope === 'set' && savedSets.length > 0 && (
            <select
              value={selectedSetId}
              onChange={(e) => setSelectedSetId(e.target.value)}
              className="w-full h-8 text-xs bg-muted border border-border rounded-lg px-2 text-foreground"
            >
              <option value="">Select a set...</option>
              {savedSets.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}

          {/* Progress */}
          {isExporting && (
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Loader2 size={12} className="animate-spin text-primary" />
                <span className="text-xs text-muted-foreground">Exporting... {exportProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${exportProgress}%` }} />
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            disabled={isExporting}
            className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={() => onExport(scope, scope === 'set' ? selectedSetId : undefined)}
            disabled={isExporting || (scope === 'set' && !selectedSetId)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Download size={12} />
            Export
          </button>
        </div>
      </div>
    </div>
  )
}
