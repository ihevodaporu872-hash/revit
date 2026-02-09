import { cn } from '../../lib/utils'

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
      <div className="text-center py-12 text-muted-foreground">
        {emptyMessage || 'No data available'}
      </div>
    )
  }

  return (
    <div className={cn('overflow-x-auto', className)}>
      <table className="w-full">
        <thead>
          <tr className="border-b border-border">
            {columns.map((col) => (
              <th key={col.key} className={cn('text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3', col.className)}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item, i) => (
            <tr
              key={String(item[keyField] ?? i)}
              className={cn('border-b border-border/50 hover:bg-muted/50 transition-colors', onRowClick && 'cursor-pointer')}
              onClick={() => onRowClick?.(item)}
            >
              {columns.map((col) => (
                <td key={col.key} className={cn('px-4 py-3 text-sm text-foreground', col.className)}>
                  {col.render ? col.render(item) : String(item[col.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
