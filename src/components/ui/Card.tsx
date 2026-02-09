import { cn } from '../../lib/utils'
import { motion } from 'framer-motion'
import { fadeInUp, scaleIn } from '../../lib/animations'
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
      variants={fadeInUp}
      initial="hidden"
      animate="visible"
      whileHover={hover ? { y: -2 } : undefined}
    >
      <ShadcnCard className={cn(
        glass && 'backdrop-blur-sm bg-card/80',
        hover && 'transition-shadow hover:shadow-lg hover:border-primary/20',
        className,
      )}>
        {(title || actions) && (
          <CardHeader className="flex flex-row items-center justify-between space-y-0 px-6 py-4">
            <div>
              {title && <CardTitle className="text-base">{title}</CardTitle>}
              {subtitle && <CardDescription className="mt-0.5">{subtitle}</CardDescription>}
            </div>
            {actions && <div className="flex items-center gap-2">{actions}</div>}
          </CardHeader>
        )}
        <CardContent className="px-6 py-6">{children}</CardContent>
      </ShadcnCard>
    </motion.div>
  )
}

export function StatCard({ label, value, icon: Icon, trend, color = 'primary' }: {
  label: string
  value: string | number
  icon?: React.ComponentType<{ size?: number; className?: string }>
  trend?: { value: number; label: string }
  color?: 'primary' | 'success' | 'warning' | 'danger'
}) {
  const colorMap = {
    primary: 'bg-primary/10 text-primary',
    success: 'bg-success/10 text-success',
    warning: 'bg-warning/10 text-warning',
    danger: 'bg-destructive/10 text-destructive',
  }

  return (
    <motion.div variants={scaleIn} initial="hidden" animate="visible">
      <ShadcnCard className="p-5 transition-shadow hover:shadow-md hover:border-primary/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
            {trend && (
              <p className={`text-xs mt-1 ${trend.value >= 0 ? 'text-success' : 'text-destructive'}`}>
                {trend.value >= 0 ? '+' : ''}{trend.value}% {trend.label}
              </p>
            )}
          </div>
          {Icon && (
            <div className={`p-2.5 rounded-lg ${colorMap[color]}`}>
              <Icon size={20} />
            </div>
          )}
        </div>
      </ShadcnCard>
    </motion.div>
  )
}
