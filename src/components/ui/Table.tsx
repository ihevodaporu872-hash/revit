import { cn } from '../../lib/utils'
import { motion } from 'framer-motion'
import { staggerContainer, tableRow } from '../../lib/animations'
import { Inbox } from 'lucide-react'

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

export function Table<T extends Record<string, unknown>>({ columns, data, keyField = 'id', className, emptyMessage, onRowClick }: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <Inbox size={48} className="mb-3 opacity-30" />
        <p className="text-sm">{emptyMessage || 'No data available'}</p>
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        <thead className="sticky top-0 z-10 bg-card">
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th key={col.key} className={cn('text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <motion.tbody variants={staggerContainer} initial="hidden" animate="visible">
          {data.map((item, i) => (
            <motion.tr
              key={String(item[keyField] ?? i)}
              variants={tableRow}
              className={cn(
                'border-b border-border/50 transition-colors',
                i % 2 === 1 && 'bg-muted/30',
                'hover:bg-muted/60',
                onRowClick && 'cursor-pointer',
              )}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3 text-sm text-foreground', col.className)}>
                  {col.render ? col.render(item) : String(item[col.key] ?? '')}
                </td>
              ))}
            </motion.tr>
          ))}
        </motion.tbody>
      </table>
    </div>
  )
}
