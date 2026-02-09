import { cn } from '../../lib/utils'
import { cva } from 'class-variance-authority'
import { motion } from 'framer-motion'
import { badgePulse } from '../../lib/animations'

const badgeVariants = cva(
  'inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium',
  {
    variants: {
      variant: {
        default: 'bg-secondary text-secondary-foreground',
        primary: 'bg-primary/10 text-primary',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        danger: 'bg-destructive/10 text-destructive',
        info: 'bg-chart-3/10 text-chart-3',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  }
)

export function Badge({ children, variant = 'default', className, pulse }: {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
  pulse?: boolean
}) {
  const Wrapper = pulse ? motion.span : 'span'
  const motionProps = pulse ? { variants: badgePulse, initial: 'hidden', animate: 'visible' } : {}

  return (
    <Wrapper {...motionProps} className={cn(badgeVariants({ variant }), className)}>
      {pulse && (
        <span className="relative flex h-2 w-2 mr-1.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-current opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-current" />
        </span>
      )}
      {children}
    </Wrapper>
  )
}
