import { Camera } from 'lucide-react'
import { useViewerStore } from '../../store/viewerStore'
import { ViewpointCard } from './ViewpointCard'
import type { SavedViewpoint, CameraState } from './ifc/types'

interface ViewpointsPanelProps {
  onRestore: (viewpoint: SavedViewpoint) => void
}

export function ViewpointsPanel({ onRestore }: ViewpointsPanelProps) {
  const { savedViewpoints, activeViewpointId, deleteViewpoint, setActiveViewpointId } = useViewerStore()

  const handleRestore = (vp: SavedViewpoint) => {
    setActiveViewpointId(vp.id)
    onRestore(vp)
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Viewpoints</span>
        <span className="text-[10px] text-muted-foreground">{savedViewpoints.length}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {savedViewpoints.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Camera size={28} className="text-muted-foreground/30 mb-2" />
            <p className="text-xs text-muted-foreground/60">No viewpoints saved</p>
            <p className="text-[10px] text-muted-foreground/40 mt-1">Enter drawing mode and save a viewpoint</p>
          </div>
        ) : (
          savedViewpoints.map((vp) => (
            <ViewpointCard
              key={vp.id}
              name={vp.name}
              thumbnail={vp.thumbnail}
              createdAt={vp.createdAt}
              isActive={activeViewpointId === vp.id}
              onRestore={() => handleRestore(vp)}
              onDelete={() => deleteViewpoint(vp.id)}
            />
          ))
        )}
      </div>
    </div>
  )
}
