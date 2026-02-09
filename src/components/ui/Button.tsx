import { cn } from '../../lib/utils'
import { Loader2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { Button as ShadcnButton } from './shadcn/button'
import { interactiveScale } from '../../lib/animations'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'success'
  size?: 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  icon?: React.ReactNode
}

const variantMap = {
  primary: 'default',
  secondary: 'secondary',
  outline: 'outline',
  ghost: 'ghost',
  danger: 'destructive',
  success: 'default',
} as const

const sizeMap = {
  sm: 'sm',
  md: 'default',
  lg: 'lg',
  icon: 'icon',
} as const

export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...props }: ButtonProps) {
  return (
    <motion.div variants={interactiveScale} initial="rest" whileHover="hover" whileTap={disabled || loading ? undefined : "tap"} className="inline-flex">
      <ShadcnButton
        variant={variantMap[variant]}
        size={sizeMap[size]}
        className={cn(
          variant === 'success' && 'bg-success text-white hover:bg-success/90',
          className,
        )}
        disabled={disabled || loading}
        {...props}
      >
        {loading ? <Loader2 size={16} className="animate-spin" /> : icon}
        {children}
      </ShadcnButton>
    </motion.div>
  )
}
