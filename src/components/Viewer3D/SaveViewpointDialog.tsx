import { useState } from 'react'
import { X, Camera } from 'lucide-react'

interface SaveViewpointDialogProps {
  open: boolean
  onClose: () => void
  onSave: (name: string) => void
}

export function SaveViewpointDialog({ open, onClose, onSave }: SaveViewpointDialogProps) {
  const [name, setName] = useState('')

  if (!open) return null

  const handleSave = () => {
    if (!name.trim()) return
    onSave(name.trim())
    setName('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-[360px] bg-card border border-border rounded-xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Camera size={16} className="text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Save Viewpoint</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-muted rounded">
            <X size={14} className="text-muted-foreground" />
          </button>
        </div>
        <div className="px-5 py-4">
          <label className="text-xs text-muted-foreground block mb-1.5">Viewpoint Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
            placeholder="e.g. North Elevation"
            className="w-full h-9 text-sm bg-muted border border-border rounded-lg px-3 text-foreground placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 px-5 py-4 border-t border-border">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs font-medium text-muted-foreground hover:text-foreground bg-muted rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            className="px-4 py-2 text-xs font-medium text-white bg-primary rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Save
          </button>
        </div>
      </div>
    </div>
  )
}
