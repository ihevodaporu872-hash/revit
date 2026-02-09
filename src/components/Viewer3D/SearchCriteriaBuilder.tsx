import { Plus, Trash2 } from 'lucide-react'
import type { SearchCriterion, SearchOperator, SearchLogic } from './ifc/types'

const FIELD_OPTIONS = [
  { value: 'type', label: 'IFC Type' },
  { value: 'name', label: 'Name' },
  { value: 'material', label: 'Material' },
  { value: 'level', label: 'Level' },
  { value: 'objecttype', label: 'Object Type' },
]

const OPERATOR_OPTIONS: { value: SearchOperator; label: string }[] = [
  { value: 'equals', label: '=' },
  { value: 'notEquals', label: '!=' },
  { value: 'contains', label: 'contains' },
  { value: 'startsWith', label: 'starts with' },
  { value: 'endsWith', label: 'ends with' },
  { value: 'greaterThan', label: '>' },
  { value: 'lessThan', label: '<' },
]

interface SearchCriteriaBuilderProps {
  criteria: SearchCriterion[]
  logic: SearchLogic
  onChange: (criteria: SearchCriterion[]) => void
  onLogicChange: (logic: SearchLogic) => void
}

export function SearchCriteriaBuilder({ criteria, logic, onChange, onLogicChange }: SearchCriteriaBuilderProps) {
  const addRow = () => {
    onChange([
      ...criteria,
      { id: Date.now().toString(), field: 'type', operator: 'equals', value: '' },
    ])
  }

  const updateRow = (id: string, updates: Partial<SearchCriterion>) => {
    onChange(criteria.map((c) => (c.id === id ? { ...c, ...updates } : c)))
  }

  const removeRow = (id: string) => {
    onChange(criteria.filter((c) => c.id !== id))
  }

  return (
    <div className="space-y-3">
      {criteria.length > 1 && (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">Match</span>
          <button
            onClick={() => onLogicChange(logic === 'AND' ? 'OR' : 'AND')}
            className="px-2 py-0.5 rounded bg-primary/20 text-primary font-medium hover:bg-primary/30 transition-colors"
          >
            {logic}
          </button>
          <span className="text-muted-foreground">of the following</span>
        </div>
      )}

      {criteria.map((c) => (
        <div key={c.id} className="flex items-center gap-2">
          <select
            value={c.field}
            onChange={(e) => updateRow(c.id, { field: e.target.value })}
            className="flex-1 h-8 text-xs bg-muted border border-border rounded px-2 text-foreground"
          >
            {FIELD_OPTIONS.map((f) => (
              <option key={f.value} value={f.value}>{f.label}</option>
            ))}
          </select>
          <select
            value={c.operator}
            onChange={(e) => updateRow(c.id, { operator: e.target.value as SearchOperator })}
            className="w-24 h-8 text-xs bg-muted border border-border rounded px-2 text-foreground"
          >
            {OPERATOR_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <input
            value={c.value}
            onChange={(e) => updateRow(c.id, { value: e.target.value })}
            placeholder="Value..."
            className="flex-1 h-8 text-xs bg-muted border border-border rounded px-2 text-foreground placeholder:text-muted-foreground"
          />
          <button
            onClick={() => removeRow(c.id)}
            className="p-1.5 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}

      <button
        onClick={addRow}
        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 transition-colors"
      >
        <Plus size={14} />
        Add condition
      </button>
    </div>
  )
}
