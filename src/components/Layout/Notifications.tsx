import { useEffect } from 'react'
import { X, CheckCircle, AlertCircle, Info, AlertTriangle } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { notificationVariants } from '../../lib/animations'

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  info: Info,
  warning: AlertTriangle,
}

const colors = {
  success: 'bg-success/10 border-success/20 text-success',
  error: 'bg-destructive/10 border-destructive/20 text-destructive',
  info: 'bg-primary/10 border-primary/20 text-primary',
  warning: 'bg-warning/10 border-warning/20 text-warning',
}

export default function Notifications() {
  const { notifications, removeNotification } = useAppStore()

  useEffect(() => {
    notifications.forEach((n) => {
      const timer = setTimeout(() => removeNotification(n.id), 5000)
      return () => clearTimeout(timer)
    })
  }, [notifications, removeNotification])

  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 max-w-sm">
      <AnimatePresence>
        {notifications.map((n) => {
          const Icon = icons[n.type]
          return (
            <motion.div
              key={n.id}
              variants={notificationVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              className={`flex items-start gap-3 p-3 rounded-lg border shadow-lg backdrop-blur-sm ${colors[n.type]}`}
            >
              <Icon size={18} className="shrink-0 mt-0.5" />
              <p className="text-sm flex-1">{n.message}</p>
              <button onClick={() => removeNotification(n.id)} className="shrink-0 hover:opacity-70 transition-opacity">
                <X size={14} />
              </button>
            </motion.div>
          )
        })}
      </AnimatePresence>
    </div>
  )
}
