import { Camera, Trash2 } from 'lucide-react'

interface ViewpointCardProps {
  name: string
  thumbnail: string
  createdAt: number
  isActive: boolean
  onRestore: () => void
  onDelete: () => void
}

export function ViewpointCard({ name, thumbnail, createdAt, isActive, onRestore, onDelete }: ViewpointCardProps) {
  return (
    <div
      className={`group relative rounded-lg border overflow-hidden cursor-pointer transition-all ${
        isActive ? 'border-primary ring-1 ring-primary/30' : 'border-border hover:border-muted-foreground/30'
      }`}
      onClick={onRestore}
    >
      {thumbnail ? (
        <img src={thumbnail} alt={name} className="w-full h-20 object-cover bg-muted" />
      ) : (
        <div className="w-full h-20 bg-muted flex items-center justify-center">
          <Camera size={20} className="text-muted-foreground/40" />
        </div>
      )}
      <div className="px-2 py-1.5 bg-card">
        <p className="text-xs font-medium text-foreground truncate">{name}</p>
        <p className="text-[10px] text-muted-foreground">
          {new Date(createdAt).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-1 right-1 p-1 rounded bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-500"
      >
        <Trash2 size={12} />
      </button>
    </div>
  )
}
