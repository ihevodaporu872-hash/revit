import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { fadeInUp, staggerContainer } from '../../lib/animations'

interface Column<T> {
  key: string
  header: string
  render?: (item: T) => React.ReactNode
  className?: string
}

interface TableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyField?: string
  className?: string
  emptyMessage?: string
  onRowClick?: (item: T) => void
}

export function Table<T extends Record<string, unknown>>({
  columns,
  data,
  keyField = 'id',
  className,
  emptyMessage,
  onRowClick,
}: TableProps<T>) {
  if (data.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="text-center py-12 text-text-secondary"
      >
        {emptyMessage || 'No data available'}
      </motion.div>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <motion.table className="w-full" variants={staggerContainer} initial="hidden" animate="visible">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(
                  'text-left text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3',
                  col.className,
                )}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <motion.tr
              key={String(item[keyField] ?? i)}
              variants={fadeInUp}
              className={cn(
                'border-b border-border/50 transition-colors duration-200',
                onRowClick && 'cursor-pointer hover:bg-surface-alt',
              )}
              onClick={() => onRowClick?.(item)}
              whileHover={onRowClick ? { scale: 1.01 } : undefined}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3 text-sm text-text', col.className)}>
                  {col.render ? col.render(item) : String(item[col.key] ?? '')}
                </td>
              ))}
            </motion.tr>
          ))}
        </tbody>
      </motion.table>
    </div>
  )
}
