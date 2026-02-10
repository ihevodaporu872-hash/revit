import { motion, AnimatePresence } from 'framer-motion'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'
import { scaleIn } from '../../lib/animations'

type CardStatus = 'waiting' | 'converting' | 'done' | 'error'

interface Props {
  label: string
  icon: React.ReactNode
  status: CardStatus
  fileSize?: string
}

const statusStyles: Record<CardStatus, string> = {
  waiting: 'bg-muted/30 border-border/30',
  converting: 'bg-primary/5 ring-1 ring-primary/20 border-primary/20',
  done: 'bg-emerald-500/5 ring-1 ring-emerald-500/20 border-emerald-500/20',
  error: 'bg-destructive/5 ring-1 ring-destructive/20 border-destructive/20',
}

export function ConversionProgressCard({ label, icon, status, fileSize }: Props) {
  return (
    <div
      className={`relative overflow-hidden rounded-xl border p-3 transition-all duration-300 ${statusStyles[status]}`}
    >
      {status === 'converting' && (
        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/5 to-transparent animate-pulse" />
      )}

      <div className="relative flex items-center gap-2.5">
        <AnimatePresence mode="wait">
          {status === 'waiting' && (
            <motion.div
              key="waiting"
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="text-muted-foreground/50"
            >
              {icon}
            </motion.div>
          )}
          {status === 'converting' && (
            <motion.div
              key="converting"
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <Loader2 size={18} className="text-primary animate-spin" />
            </motion.div>
          )}
          {status === 'done' && (
            <motion.div
              key="done"
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <CheckCircle2 size={18} className="text-emerald-500" />
            </motion.div>
          )}
          {status === 'error' && (
            <motion.div
              key="error"
              variants={scaleIn}
              initial="hidden"
              animate="visible"
              exit="hidden"
            >
              <XCircle size={18} className="text-destructive" />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 min-w-0">
          <p className={`text-xs font-semibold ${
            status === 'waiting' ? 'text-muted-foreground/60'
              : status === 'converting' ? 'text-foreground'
                : status === 'done' ? 'text-emerald-500'
                  : 'text-destructive'
          }`}>
            {label}
          </p>
          <p className="text-[10px] text-muted-foreground truncate">
            {status === 'waiting' && 'Waiting...'}
            {status === 'converting' && 'Converting...'}
            {status === 'done' && (fileSize || 'Ready')}
            {status === 'error' && 'Failed'}
          </p>
        </div>
      </div>
    </div>
  )
}
