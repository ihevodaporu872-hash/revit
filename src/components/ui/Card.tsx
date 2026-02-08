import { cn } from '../../lib/utils'

interface CardProps {
  children: React.ReactNode
  className?: string
  title?: string
  subtitle?: string
  actions?: React.ReactNode
}

export function Card({ children, className, title, subtitle, actions }: CardProps) {
  return (
    <div className={cn('bg-surface rounded-xl border border-border shadow-sm', className)}>
      {(title || actions) && (
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div>
            {title && <h3 className="font-semibold text-text">{title}</h3>}
            {subtitle && <p className="text-sm text-text-secondary mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
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
    primary: 'bg-blue-50 text-blue-600',
    success: 'bg-green-50 text-green-600',
    warning: 'bg-amber-50 text-amber-600',
    danger: 'bg-red-50 text-red-600',
  }

  return (
    <div className="bg-surface rounded-xl border border-border shadow-sm p-5">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-text-secondary">{label}</p>
          <p className="text-2xl font-bold text-text mt-1">{value}</p>
          {trend && (
            <p className={`text-xs mt-1 ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
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
    </div>
  )
}
