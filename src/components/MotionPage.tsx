import { motion } from 'framer-motion'
import { pageTransition } from '../lib/animations'

export function MotionPage({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      variants={pageTransition}
      initial="initial"
      animate="animate"
      exit="exit"
      className={className}
    >
      {children}
    </motion.div>
  )
}
