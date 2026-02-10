import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Download,
  BarChart3,
  Eye,
} from 'lucide-react'
import type { MatchResult } from './useElementMatcher'

interface Props {
  result: MatchResult
  onClose: () => void
  onHighlightMatchStatus?: () => void
  onExportReport?: () => void
}

export function MatchingReport({ result, onClose, onHighlightMatchStatus, onExportReport }: Props) {
  const [showMissing, setShowMissing] = useState<'none' | 'ifc' | 'excel' | 'ambiguous'>('none')
  const [showCategories, setShowCategories] = useState(true)

  const matchPercent = result.totalIfcElements > 0
    ? ((result.totalMatched / result.totalIfcElements) * 100).toFixed(1)
    : '0'
  const ambiguousPercent = result.totalIfcElements > 0
    ? ((result.ambiguous.length / result.totalIfcElements) * 100).toFixed(1)
    : '0'

  // Sort categories by IFC count descending
  const categories = Array.from(result.byCategory.entries())
    .sort((a, b) => b[1].ifcCount - a[1].ifcCount)
    .filter(([, v]) => v.ifcCount > 0 || v.revitCount > 0)

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        data-testid="match-report-dialog"
        className="bg-card border border-border rounded-2xl shadow-2xl w-[560px] max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <BarChart3 size={20} className="text-primary" />
            <h2 className="text-lg font-bold text-foreground">Element Matching Report</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {/* Summary stats */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="IFC Elements" value={result.totalIfcElements.toLocaleString()} />
            <StatCard label="Revit Elements" value={result.totalExcelRows.toLocaleString()} />
          </div>

          {/* Match result */}
          <div className="bg-muted/30 rounded-xl p-4 border border-border/50 space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={16} className="text-emerald-500" />
              <span className="text-sm font-semibold text-foreground">
                Matched: {result.totalMatched.toLocaleString()} ({matchPercent}%)
              </span>
            </div>
            <div className="pl-6 space-y-1 text-xs text-muted-foreground">
              <p>By ElementId (Tag): <span className="font-medium text-foreground">{result.matchedByElementId.toLocaleString()}</span></p>
              <p>By GlobalId: <span className="font-medium text-foreground">{result.matchedByGlobalId.toLocaleString()}</span></p>
              <p>By Type IfcGUID: <span className="font-medium text-foreground">{result.matchedByTypeIfcGuid.toLocaleString()}</span></p>
              <p>Mixed: <span className="font-medium text-foreground">{result.matchedMixed.toLocaleString()}</span></p>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-muted rounded-full overflow-hidden flex">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all"
                style={{ width: `${matchPercent}%` }}
              />
              <div
                className="h-full bg-amber-500 transition-all"
                style={{ width: `${ambiguousPercent}%` }}
              />
            </div>

            <div className="flex items-center gap-4 text-xs">
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-500" />
                <span className="text-muted-foreground">
                  Ambiguous: <span className="font-medium text-foreground">{result.ambiguous.length.toLocaleString()}</span>
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <XCircle size={12} className="text-red-500" />
                <span className="text-muted-foreground">
                  Missing in IFC: <span className="font-medium text-foreground">{result.missingInIfc.length.toLocaleString()}</span> (Revit-only)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <AlertTriangle size={12} className="text-amber-500" />
                <span className="text-muted-foreground">
                  Missing in Excel: <span className="font-medium text-foreground">{result.missingInExcel.length.toLocaleString()}</span> (IFC-only)
                </span>
              </div>
            </div>
          </div>

          {/* Category breakdown */}
          <div>
            <button
              onClick={() => setShowCategories(!showCategories)}
              className="flex items-center gap-2 text-sm font-semibold text-foreground mb-2"
            >
              {showCategories ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
              By Category / Type
            </button>
            <AnimatePresence>
              {showCategories && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="rounded-lg border border-border overflow-hidden">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Category</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">IFC</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Revit</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">Match</th>
                          <th className="text-right px-3 py-2 font-medium text-muted-foreground">%</th>
                        </tr>
                      </thead>
                      <tbody>
                        {categories.slice(0, 20).map(([cat, data], i) => {
                          const pct = data.ifcCount > 0 ? ((data.matchedCount / data.ifcCount) * 100).toFixed(0) : '—'
                          return (
                            <tr key={cat} className={i % 2 === 0 ? 'bg-muted/20' : ''}>
                              <td className="px-3 py-1.5 text-foreground font-medium truncate max-w-[200px]">{cat}</td>
                              <td className="px-3 py-1.5 text-right text-foreground">{data.ifcCount}</td>
                              <td className="px-3 py-1.5 text-right text-foreground">{data.revitCount}</td>
                              <td className="px-3 py-1.5 text-right text-foreground">{data.matchedCount}</td>
                              <td className="px-3 py-1.5 text-right">
                                <span className={pct === '100' ? 'text-emerald-500' : pct === '—' ? 'text-muted-foreground' : 'text-amber-500'}>
                                  {pct}%
                                </span>
                              </td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Missing elements lists */}
          {result.ambiguous.length > 0 && (
            <div>
              <button
                onClick={() => setShowMissing(showMissing === 'ambiguous' ? 'none' : 'ambiguous')}
                className="flex items-center gap-2 text-xs font-medium text-amber-500 mb-1"
              >
                {showMissing === 'ambiguous' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Ambiguous matches ({result.ambiguous.length})
              </button>
              {showMissing === 'ambiguous' && (
                <div className="max-h-32 overflow-y-auto bg-muted/20 rounded-lg p-2 space-y-0.5">
                  {result.ambiguous.slice(0, 50).map((item, i) => (
                    <div key={`${item.expressID}-${i}`} className="text-[11px] text-muted-foreground px-2 py-0.5">
                      <span className="font-mono text-foreground">#{item.expressID}</span>
                      {item.globalId ? ` — ${item.globalId}` : ''}
                      {item.candidates[0] ? ` (top=${(item.candidates[0].score * 100).toFixed(1)}%)` : ''}
                    </div>
                  ))}
                  {result.ambiguous.length > 50 && (
                    <p className="text-[10px] text-muted-foreground px-2">...and {result.ambiguous.length - 50} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          {result.missingInExcel.length > 0 && (
            <div>
              <button
                onClick={() => setShowMissing(showMissing === 'excel' ? 'none' : 'excel')}
                className="flex items-center gap-2 text-xs font-medium text-amber-500 mb-1"
              >
                {showMissing === 'excel' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                IFC-only elements ({result.missingInExcel.length})
              </button>
              {showMissing === 'excel' && (
                <div className="max-h-32 overflow-y-auto bg-muted/20 rounded-lg p-2 space-y-0.5">
                  {result.missingInExcel.slice(0, 50).map((el) => (
                    <div key={el.expressID} className="text-[11px] text-muted-foreground px-2 py-0.5">
                      <span className="font-mono text-foreground">{el.expressID}</span> — {el.type}: {el.name}
                    </div>
                  ))}
                  {result.missingInExcel.length > 50 && (
                    <p className="text-[10px] text-muted-foreground px-2">...and {result.missingInExcel.length - 50} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          {result.missingInIfc.length > 0 && (
            <div>
              <button
                onClick={() => setShowMissing(showMissing === 'ifc' ? 'none' : 'ifc')}
                className="flex items-center gap-2 text-xs font-medium text-red-500 mb-1"
              >
                {showMissing === 'ifc' ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
                Revit-only elements ({result.missingInIfc.length})
              </button>
              {showMissing === 'ifc' && (
                <div className="max-h-32 overflow-y-auto bg-muted/20 rounded-lg p-2 space-y-0.5">
                  {result.missingInIfc.slice(0, 50).map((row, i) => (
                    <div key={i} className="text-[11px] text-muted-foreground px-2 py-0.5">
                      <span className="font-mono text-foreground">{row.revitElementId || row.globalId}</span> — {row.category}: {row.elementName}
                    </div>
                  ))}
                  {result.missingInIfc.length > 50 && (
                    <p className="text-[10px] text-muted-foreground px-2">...and {result.missingInIfc.length - 50} more</p>
                  )}
                </div>
              )}
            </div>
          )}

          {result.diagnostics.length > 0 && (
            <div>
              <p className="text-xs font-medium text-muted-foreground mb-1">Top unmatched reasons</p>
              <div className="rounded-lg border border-border p-2 text-[11px] text-muted-foreground space-y-0.5">
                {Object.entries(
                  result.diagnostics.reduce<Record<string, number>>((acc, d) => {
                    acc[d.reason] = (acc[d.reason] || 0) + 1
                    return acc
                  }, {}),
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([reason, count]) => (
                    <div key={reason} className="flex justify-between">
                      <span>{reason}</span>
                      <span className="font-medium text-foreground">{count}</span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center gap-2 px-6 py-3 border-t border-border bg-muted/20">
          {onHighlightMatchStatus && (
            <button
              onClick={onHighlightMatchStatus}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
            >
              <Eye size={12} />
              Show Match Status in 3D
            </button>
          )}
          {onExportReport && (
            <button
              onClick={onExportReport}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-muted text-foreground rounded-lg hover:bg-muted/80 transition-colors"
            >
              <Download size={12} />
              Export Report
            </button>
          )}
          <div className="flex-1" />
          <button
            onClick={onClose}
            className="px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </motion.div>
  )
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-muted/30 rounded-xl p-3 border border-border/50">
      <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-0.5">{label}</p>
      <p className="text-xl font-bold text-foreground">{value}</p>
    </div>
  )
}
