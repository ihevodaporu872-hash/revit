import { cn } from '../../lib/utils'
import { motion } from 'framer-motion'
import { fadeInUp, scaleIn, cardHover } from '../../lib/animations'
import { Card as ShadcnCard, CardContent, CardHeader, CardTitle, CardDescription } from './shadcn/card'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  glass?: boolean
  hover?: boolean
}

export function Card({ children, className, title, subtitle, actions, glass, hover }: CardProps) {
  return (
    <motion.div
      variants={hover ? cardHover : fadeInUp}
      initial={hover ? "rest" : "hidden"}
      animate={hover ? "rest" : "visible"}
      whileHover={hover ? "hover" : undefined}
    >
      <ShadcnCard className={cn(
        'glow-card glass-panel overflow-hidden rounded-2xl border-border/80 shadow-[var(--card-glow)]',
        glass && 'bg-card/85',
        hover && 'transition-all hover:border-primary/35 hover:shadow-[var(--shadow-glow)]',
        className,
      )}>
        {(title || actions) && (
          <CardHeader className="flex flex-row items-center justify-between space-y-0 border-b border-border/50 px-6 py-4">
            <div className="min-w-0">
              {title && <CardTitle className="truncate text-[16px] font-semibold leading-snug">{title}</CardTitle>}
              {subtitle && <CardDescription className="mt-1.5 text-[13px] leading-relaxed">{subtitle}</CardDescription>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </CardHeader>
        )}
        <CardContent className="px-6 pb-6 pt-5">{children}</CardContent>
      </ShadcnCard>
    </motion.div>
  )
}

export function StatCard({ label, value, icon: Icon, trend, color = 'primary', className }: {
  label: string
  value: string | number
  icon?: React.ComponentType<{ size?: number; className?: string }>
  trend?: { value: number; label: string }
  color?: 'primary' | 'success' | 'warning' | 'danger'
  className?: string
}) {
  const colorMap = {
    primary: 'text-primary',
    success: 'text-success',
    warning: 'text-warning',
    danger: 'text-destructive',
  }

  return (
    <motion.div variants={scaleIn} initial="hidden" animate="visible">
      <ShadcnCard className={cn(
        "glow-card glass-panel statcard-shell overflow-hidden rounded-2xl border-border/80 p-0 transition-all hover:border-primary/35 hover:shadow-[var(--shadow-glow)]",
        className,
      )}>
        <div className="relative px-5 pb-4 pt-5">
          <div className="statcard-top-row flex items-start justify-between gap-4">
            <div className="statcard-main min-w-0">
              <p className="statcard-label truncate text-[11px] font-medium leading-[1.25] text-muted-foreground">{label}</p>
              <p className="statcard-value mt-2 text-[34px] font-extrabold leading-[0.92] tracking-tight text-foreground">{value}</p>
            </div>
            {Icon && (
              <div className={`statcard-icon-shell rounded-xl border border-border/60 bg-card/60 p-2.5 ${colorMap[color]}`}>
                <Icon size={17} />
              </div>
            )}
          </div>
          <div className="pointer-events-none absolute inset-x-5 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/55 to-transparent" />
          {trend && (
            <p className={`statcard-trend mt-3 text-[11px] font-medium ${trend.value >= 0 ? 'text-success' : 'text-destructive'}`}>
              {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
            </p>
          )}
        </div>
        {!trend && (
          <div className="h-7 border-t border-border/55 bg-gradient-to-r from-primary/10 via-transparent to-primary/5" />
        )}
        {trend && (
          <div className="h-2 border-t border-border/55 bg-gradient-to-r from-primary/20 via-transparent to-primary/10" />
        )}
      </ShadcnCard>
    </motion.div>
  )
}
