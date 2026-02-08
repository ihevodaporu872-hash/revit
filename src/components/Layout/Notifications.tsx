import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { useAppStore } from '../../store/appStore'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const colors = {
  success: 'bg-green-50 border-green-200 text-green-800',
  error: 'bg-red-50 border-red-200 text-red-800',
  info: 'bg-blue-50 border-blue-200 text-blue-800',
  warning: 'bg-amber-50 border-amber-200 text-amber-800',
}

export default function Notifications() {
  const { notifications, removeNotification } = useAppStore()

  useEffect(() => {
    notifications.forEach((n) => {
      const timer = setTimeout(() => removeNotification(n.id), 5000)
      return () => clearTimeout(timer)
    })
  }, [notifications, removeNotification])

  if (notifications.length === 0) return null

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      {notifications.map((n) => {
        const Icon = icons[n.type]
        return (
          <div key={n.id} className={`flex items-start gap-3 p-3 rounded-lg border shadow-lg ${colors[n.type]} animate-in slide-in-from-right`}>
            <Icon size={18} className="shrink-0 mt-0.5" />
            <p className="text-sm flex-1">{n.message}</p>
            <button onClick={() => removeNotification(n.id)} className="shrink-0">
              <X size={14} />
            </button>
          </div>
        )
      })}
    </div>
  )
}
