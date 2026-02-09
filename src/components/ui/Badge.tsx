import { cn } from '../../lib/utils'
import { cva } from 'class-variance-authority'

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

export function Badge({ children, variant = 'default', className }: {
  children: React.ReactNode
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'danger' | 'info'
  className?: string
}) {
  return (
    <span className={cn(badgeVariants({ variant }), className)}>
      {children}
    </span>
  )
}
