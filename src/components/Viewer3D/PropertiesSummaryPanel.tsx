import { useState, useMemo } from 'react'
import { ChevronRight, ChevronDown, Loader2, BarChart3, Search } from 'lucide-react'
import type { SummaryGroupBy, SummaryGroup, SummaryData } from './ifc/types'

const GROUP_OPTIONS: { value: SummaryGroupBy; label: string }[] = [
  { value: 'type', label: 'IFC Тип' },
  { value: 'name', label: 'Имя' },
  { value: 'material', label: 'Материал' },
]

type SortField = 'key' | 'count' | 'totalLength' | 'totalArea' | 'totalVolume'
type SortDir = 'asc' | 'desc'

function formatValue(v: number): string {
  if (!v || v === 0) return '--'
  if (v >= 1000) return v.toLocaleString('ru-RU', { maximumFractionDigits: 1 })
  return v.toLocaleString('ru-RU', { maximumFractionDigits: 2 })
}

function formatUnit(v: number, unit: string): string {
  if (!v || v === 0) return '--'
  return `${formatValue(v)} ${unit}`
}

interface PropertiesSummaryPanelProps {
  summary: SummaryData | null
  groupBy: SummaryGroupBy
  onGroupByChange: (g: SummaryGroupBy) => void
  onScan: () => void
  onHighlightGroup: (expressIDs: number[]) => void
  onClearHighlight: () => void
  activeGroupKey: string | null
  scanProgress: number
  isScanning: boolean
  scannedCount: number
}

export function PropertiesSummaryPanel({
  summary,
  groupBy,
  onGroupByChange,
  onScan,
  onHighlightGroup,
  onClearHighlight,
  activeGroupKey,
  scanProgress,
  isScanning,
  scannedCount,
}: PropertiesSummaryPanelProps) {
  const [sortField, setSortField] = useState<SortField>('count')
  const [sortDir, setSortDir] = useState<SortDir>('desc')
  const [expandedKeys, setExpandedKeys] = useState<Set<string>>(new Set())

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortField(field)
      setSortDir('desc')
    }
  }

  const sortedGroups = useMemo(() => {
    if (!summary) return []
    const groups = [...summary.groups]
    groups.sort((a, b) => {
      const aVal = a[sortField]
      const bVal = b[sortField]
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal)
      }
      return sortDir === 'asc'
        ? (aVal as number) - (bVal as number)
        : (bVal as number) - (aVal as number)
    })
    return groups
  }, [summary, sortField, sortDir])

  const toggleExpand = (key: string) => {
    setExpandedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const handleRowClick = (group: SummaryGroup) => {
    if (activeGroupKey === group.key) {
      onClearHighlight()
    } else {
      onHighlightGroup(group.expressIDs)
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return null
    return <span className="ml-0.5 text-[9px]">{sortDir === 'asc' ? '▲' : '▼'}</span>
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border">
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
          <BarChart3 size={12} />
          Сводка
        </span>
        <button
          onClick={onScan}
          disabled={isScanning}
          className="flex items-center gap-1 px-2 py-1 text-[10px] font-medium text-white bg-primary rounded-md hover:bg-primary/90 disabled:opacity-50 transition-colors"
        >
          {isScanning ? <Loader2 size={10} className="animate-spin" /> : <Search size={10} />}
          Сканировать
        </button>
      </div>

      {/* Group selector */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center gap-2">
          <label className="text-[10px] text-muted-foreground shrink-0">Группа:</label>
          <select
            value={groupBy}
            onChange={(e) => onGroupByChange(e.target.value as SummaryGroupBy)}
            className="flex-1 h-7 text-[11px] bg-muted border border-border rounded-md px-1.5 text-foreground"
          >
            {GROUP_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Scanning progress */}
      {isScanning && (
        <div className="px-3 py-2 border-b border-border">
          <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
            <span>Сканирование...</span>
            <span>{scannedCount} элементов · {scanProgress}%</span>
          </div>
          <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-300"
              style={{ width: `${scanProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Summary stats */}
      {summary && !isScanning && (
        <div className="px-3 py-1.5 border-b border-border text-[10px] text-muted-foreground">
          {summary.groups.length} групп · {summary.totalElements.toLocaleString()} элементов
        </div>
      )}

      {/* Table */}
      {summary && !isScanning && (
        <div className="flex-1 overflow-y-auto">
          {/* Header row */}
          <div className="sticky top-0 z-[1] bg-card border-b border-border">
            <div className="grid grid-cols-[1fr_50px_60px_64px_60px] px-3 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <button onClick={() => handleSort('key')} className="text-left hover:text-foreground transition-colors">
                {groupBy === 'type' ? 'Тип' : groupBy === 'name' ? 'Имя' : 'Материал'}
                <SortIcon field="key" />
              </button>
              <button onClick={() => handleSort('count')} className="text-right hover:text-foreground transition-colors">
                Кол
                <SortIcon field="count" />
              </button>
              <button onClick={() => handleSort('totalLength')} className="text-right hover:text-foreground transition-colors">
                Длина
                <SortIcon field="totalLength" />
              </button>
              <button onClick={() => handleSort('totalArea')} className="text-right hover:text-foreground transition-colors">
                Площадь
                <SortIcon field="totalArea" />
              </button>
              <button onClick={() => handleSort('totalVolume')} className="text-right hover:text-foreground transition-colors">
                Объём
                <SortIcon field="totalVolume" />
              </button>
            </div>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border/50">
            {sortedGroups.map((group) => {
              const isActive = activeGroupKey === group.key
              const isExpanded = expandedKeys.has(group.key)

              return (
                <div key={group.key}>
                  {/* Group row */}
                  <button
                    onClick={() => handleRowClick(group)}
                    className={`w-full grid grid-cols-[1fr_50px_60px_64px_60px] px-3 py-2 text-left text-[11px] transition-colors hover:bg-muted/50 ${
                      isActive ? 'border-l-2 border-primary bg-primary/10' : 'border-l-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-1 min-w-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleExpand(group.key)
                        }}
                        className="shrink-0 p-0.5 hover:bg-muted rounded"
                      >
                        {isExpanded
                          ? <ChevronDown size={11} className="text-muted-foreground" />
                          : <ChevronRight size={11} className="text-muted-foreground" />
                        }
                      </button>
                      <span className="truncate text-foreground font-medium">{group.key}</span>
                    </div>
                    <span className="text-right text-foreground tabular-nums">{group.count}</span>
                    <span className="text-right text-muted-foreground tabular-nums">{formatUnit(group.totalLength, 'м')}</span>
                    <span className="text-right text-muted-foreground tabular-nums">{formatUnit(group.totalArea, 'м²')}</span>
                    <span className="text-right text-muted-foreground tabular-nums">{formatUnit(group.totalVolume, 'м³')}</span>
                  </button>

                  {/* Expanded elements */}
                  {isExpanded && (
                    <div className="bg-muted/30">
                      {group.elements.map((el) => (
                        <div
                          key={el.expressID}
                          className="grid grid-cols-[1fr_50px_60px_64px_60px] px-3 py-1.5 text-[10px] text-muted-foreground border-t border-border/30"
                        >
                          <span className="pl-5 truncate">{el.name}</span>
                          <span className="text-right tabular-nums">1</span>
                          <span className="text-right tabular-nums">{formatUnit(el.length, 'м')}</span>
                          <span className="text-right tabular-nums">{formatUnit(el.area, 'м²')}</span>
                          <span className="text-right tabular-nums">{formatUnit(el.volume, 'м³')}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {sortedGroups.length === 0 && (
            <p className="px-4 py-6 text-xs text-muted-foreground/60 text-center">
              Нажмите «Сканировать» для анализа элементов
            </p>
          )}
        </div>
      )}

      {!summary && !isScanning && (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-xs text-muted-foreground/60 text-center px-4">
            Нажмите «Сканировать» для анализа элементов модели
          </p>
        </div>
      )}
    </div>
  )
}
