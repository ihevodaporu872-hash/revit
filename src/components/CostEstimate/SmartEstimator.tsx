import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Sparkles,
  Camera,
  FileText,
  Loader2,
  ChevronRight,
  Trash2,
  Plus,
  Minus,
  Download,
  Check,
  AlertCircle,
  Edit3,
} from 'lucide-react'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { useAppStore } from '../../store/appStore'
import { formatCurrency } from '../../lib/utils'
import { fadeInUp, staggerContainer, listItem, springTransition } from '../../lib/animations'

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api'

// ── Types ──────────────────────────────────────────────────

interface ParsedWork {
  name: string
  quantity: number
  unit: string
  room: string
}

interface CostResult {
  work_name: string
  quantity: number
  unit: string
  rate_code: string
  rate_name: string
  unit_cost: number
  total_cost: number
  labor: number
  materials: number
  machines: number
  labor_hours: number
  matched: boolean
  error?: string
  rerank_score?: number
  room?: string
}

interface EstimateSummary {
  total_cost: number
  labor_total: number
  materials_total: number
  machines_total: number
  labor_hours: number
  matched_count: number
  unmatched_count: number
  total_items: number
}

type Step = 'input' | 'parsing' | 'editing' | 'calculating' | 'result'
type InputMode = 'text' | 'photo'
type LanguageCode = 'EN' | 'DE' | 'RU' | 'ZH' | 'AR' | 'ES' | 'FR' | 'PT' | 'HI'

const LANG_SYMBOLS: Record<string, string> = {
  DE: '€', EN: 'CAD $', RU: '₽', ES: '€', FR: '€', PT: 'R$', ZH: '¥', AR: 'د.إ', HI: '₹',
}

// ── Component ──────────────────────────────────────────────

interface SmartEstimatorProps {
  language: LanguageCode
}

export default function SmartEstimator({ language }: SmartEstimatorProps) {
  const { addNotification } = useAppStore()
  const [step, setStep] = useState<Step>('input')
  const [inputMode, setInputMode] = useState<InputMode>('text')
  const [textInput, setTextInput] = useState('')
  const [photoBase64, setPhotoBase64] = useState<string | null>(null)
  const [parsedWorks, setParsedWorks] = useState<ParsedWork[]>([])
  const [results, setResults] = useState<CostResult[]>([])
  const [summary, setSummary] = useState<EstimateSummary | null>(null)
  const [estimateId, setEstimateId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const sym = LANG_SYMBOLS[language] || '€'

  // ── Step 1: Parse input ──

  const handleParse = async () => {
    setIsLoading(true)
    setStep('parsing')

    try {
      let works: ParsedWork[]

      if (inputMode === 'photo' && photoBase64) {
        const res = await fetch(`${API_BASE}/cwicr/parse-photo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: photoBase64, language }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Parse failed')
        works = await res.json()
      } else {
        const res = await fetch(`${API_BASE}/cwicr/parse-text`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: textInput, language }),
        })
        if (!res.ok) throw new Error((await res.json()).error || 'Parse failed')
        works = await res.json()
      }

      setParsedWorks(works)
      setStep('editing')
      addNotification('success', `Распознано ${works.length} работ`)
    } catch (err: any) {
      addNotification('error', err.message || 'Ошибка парсинга')
      setStep('input')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 2: Calculate costs ──

  const handleCalculate = async () => {
    setIsLoading(true)
    setStep('calculating')

    try {
      const endpoint = inputMode === 'photo'
        ? `${API_BASE}/cost/estimate-photo`
        : `${API_BASE}/cost/estimate-text`

      const body = inputMode === 'photo'
        ? { image: photoBase64, language }
        : { text: textInput, language }

      // If user edited works, use direct works endpoint
      const res = await fetch(`${API_BASE}/cost/estimate-works`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ works: parsedWorks, language }),
      })

      if (!res.ok) throw new Error((await res.json()).error || 'Estimation failed')
      const data = await res.json()

      setResults(data.results || [])
      setSummary(data.summary || null)
      setEstimateId(data.id || null)
      setStep('result')
      addNotification('success', `Смета рассчитана: ${data.summary?.matched_count || 0} позиций`)
    } catch (err: any) {
      addNotification('error', err.message || 'Ошибка расчёта')
      setStep('editing')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Work item editing ──

  const updateWork = (index: number, field: keyof ParsedWork, value: string | number) => {
    setParsedWorks(prev => prev.map((w, i) => i === index ? { ...w, [field]: value } : w))
  }

  const removeWork = (index: number) => {
    setParsedWorks(prev => prev.filter((_, i) => i !== index))
  }

  const addWork = () => {
    setParsedWorks(prev => [...prev, { name: '', quantity: 1, unit: 'm²', room: '' }])
  }

  // ── Photo handler ──

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const base64 = (reader.result as string).split(',')[1]
      setPhotoBase64(base64)
    }
    reader.readAsDataURL(file)
  }

  // ── Export ──

  const handleExport = async (format: 'csv' | 'html') => {
    if (!estimateId) {
      addNotification('warning', 'Сначала рассчитайте смету')
      return
    }
    try {
      const res = await fetch(`${API_BASE}/cost/export/${estimateId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ format }),
      })
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `estimate-${estimateId}.${format === 'csv' ? 'csv' : 'html'}`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      addNotification('error', 'Ошибка экспорта')
    }
  }

  // ── Reset ──

  const handleReset = () => {
    setStep('input')
    setParsedWorks([])
    setResults([])
    setSummary(null)
    setEstimateId(null)
    setPhotoBase64(null)
    setTextInput('')
  }

  // ── Render ──

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        {['Ввод', 'Парсинг', 'Редактирование', 'Расчёт', 'Результат'].map((label, i) => {
          const steps: Step[] = ['input', 'parsing', 'editing', 'calculating', 'result']
          const isActive = steps.indexOf(step) >= i
          return (
            <div key={label} className="flex items-center gap-2">
              {i > 0 && <ChevronRight size={12} className="text-muted-foreground/30" />}
              <span className={isActive ? 'text-primary font-medium' : ''}>{label}</span>
            </div>
          )
        })}
      </div>

      {/* Step 1: Input */}
      {step === 'input' && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card title="Умная смета" subtitle="Опишите объём работ текстом или загрузите фото" hover>
            {/* Mode toggle */}
            <div className="flex gap-2 mb-4">
              <button
                onClick={() => setInputMode('text')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'text' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <FileText size={16} /> Текст
              </button>
              <button
                onClick={() => setInputMode('photo')}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  inputMode === 'photo' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'
                }`}
              >
                <Camera size={16} /> Фото
              </button>
            </div>

            {inputMode === 'text' ? (
              <textarea
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder="Опишите объём работ, например: ванная комната 8м², плитка на пол и стены, установка унитаза и раковины, штукатурка потолка..."
                className="w-full h-40 p-4 border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none text-sm"
              />
            ) : (
              <div className="space-y-3">
                <input
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="block w-full text-sm text-muted-foreground file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
                {photoBase64 && (
                  <img
                    src={`data:image/jpeg;base64,${photoBase64}`}
                    alt="Preview"
                    className="max-h-48 rounded-lg border border-border"
                  />
                )}
              </div>
            )}

            <div className="mt-4 flex justify-end">
              <Button
                onClick={handleParse}
                disabled={inputMode === 'text' ? !textInput.trim() : !photoBase64}
                icon={<Sparkles size={16} />}
              >
                Распознать работы
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Step 2: Parsing (loading) */}
      {step === 'parsing' && (
        <Card>
          <div className="text-center py-16">
            <Loader2 size={48} className="mx-auto text-primary animate-spin mb-3" />
            <p className="text-foreground font-medium">ИИ анализирует {inputMode === 'photo' ? 'фото' : 'текст'}...</p>
            <p className="text-muted-foreground text-xs mt-1">Распознавание конструктивных элементов и работ</p>
          </div>
        </Card>
      )}

      {/* Step 3: Edit parsed works */}
      {step === 'editing' && (
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <Card
            title="Редактирование работ"
            subtitle={`Распознано ${parsedWorks.length} работ — проверьте и отредактируйте перед расчётом`}
            hover
            actions={
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={handleReset}>Назад</Button>
                <Button size="sm" icon={<Plus size={14} />} onClick={addWork}>Добавить</Button>
              </div>
            }
          >
            <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
              {parsedWorks.map((work, i) => (
                <motion.div
                  key={i}
                  variants={listItem}
                  className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border"
                >
                  <span className="text-xs text-muted-foreground w-6 text-center">{i + 1}</span>
                  <input
                    value={work.name}
                    onChange={(e) => updateWork(i, 'name', e.target.value)}
                    className="flex-1 bg-card border border-border rounded px-3 py-1.5 text-sm text-foreground"
                    placeholder="Наименование работы"
                  />
                  <input
                    type="number"
                    value={work.quantity}
                    onChange={(e) => updateWork(i, 'quantity', parseFloat(e.target.value) || 0)}
                    className="w-20 bg-card border border-border rounded px-2 py-1.5 text-sm text-foreground text-center"
                  />
                  <input
                    value={work.unit}
                    onChange={(e) => updateWork(i, 'unit', e.target.value)}
                    className="w-16 bg-card border border-border rounded px-2 py-1.5 text-sm text-foreground text-center"
                  />
                  <input
                    value={work.room}
                    onChange={(e) => updateWork(i, 'room', e.target.value)}
                    className="w-28 bg-card border border-border rounded px-2 py-1.5 text-sm text-foreground text-center"
                    placeholder="Помещение"
                  />
                  <button onClick={() => removeWork(i)} className="p-1 hover:bg-destructive/10 rounded text-muted-foreground hover:text-destructive">
                    <Trash2 size={14} />
                  </button>
                </motion.div>
              ))}
            </motion.div>

            <div className="mt-4 pt-4 border-t border-border flex justify-end">
              <Button onClick={handleCalculate} disabled={parsedWorks.length === 0} icon={<Sparkles size={16} />}>
                Рассчитать смету
              </Button>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Step 4: Calculating (loading) */}
      {step === 'calculating' && (
        <Card>
          <div className="text-center py-16">
            <Loader2 size={48} className="mx-auto text-primary animate-spin mb-3" />
            <p className="text-foreground font-medium">Расчёт сметы...</p>
            <p className="text-muted-foreground text-xs mt-1">Семантический поиск + расчёт ресурсов для каждой позиции</p>
          </div>
        </Card>
      )}

      {/* Step 5: Results */}
      {step === 'result' && summary && (
        <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
          {/* Summary cards */}
          <motion.div variants={fadeInUp} className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="p-4 bg-card rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Общая стоимость</p>
              <p className="text-xl font-bold text-foreground">{sym} {summary.total_cost.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-card rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Работа</p>
              <p className="text-lg font-bold text-foreground">{sym} {summary.labor_total.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-card rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Материалы</p>
              <p className="text-lg font-bold text-foreground">{sym} {summary.materials_total.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-card rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Механизмы</p>
              <p className="text-lg font-bold text-foreground">{sym} {summary.machines_total.toFixed(2)}</p>
            </div>
            <div className="p-4 bg-card rounded-lg border border-border">
              <p className="text-xs text-muted-foreground">Трудозатраты</p>
              <p className="text-lg font-bold text-foreground">{summary.labor_hours.toFixed(1)} ч</p>
            </div>
          </motion.div>

          {/* Results table */}
          <motion.div variants={fadeInUp}>
            <Card
              title="Позиции сметы"
              subtitle={`${summary.matched_count} найдено, ${summary.unmatched_count} не найдено`}
              hover
              actions={
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={() => handleExport('csv')}>CSV</Button>
                  <Button variant="outline" size="sm" icon={<Download size={14} />} onClick={() => handleExport('html')}>HTML</Button>
                  <Button variant="ghost" size="sm" icon={<Edit3 size={14} />} onClick={() => setStep('editing')}>Редактировать</Button>
                  <Button variant="ghost" size="sm" onClick={handleReset}>Новая смета</Button>
                </div>
              }
            >
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">#</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Работа</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Код</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Кол-во</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Цена/ед</th>
                      <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Итого</th>
                      <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-2">Помещение</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((r, i) => (
                      <tr key={i} className={`border-b border-border/50 ${!r.matched ? 'opacity-50' : ''}`}>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{i + 1}</td>
                        <td className="px-3 py-2 text-sm text-foreground">
                          {r.work_name}
                          {!r.matched && (
                            <span className="ml-2"><Badge variant="danger">Не найдено</Badge></span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs font-mono text-primary">{r.rate_code || '—'}</td>
                        <td className="px-3 py-2 text-sm text-foreground text-right">{r.quantity} {r.unit}</td>
                        <td className="px-3 py-2 text-sm text-foreground text-right">
                          {r.matched ? `${sym} ${(r.unit_cost || 0).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-sm font-medium text-foreground text-right">
                          {r.matched ? `${sym} ${(r.total_cost || 0).toFixed(2)}` : '—'}
                        </td>
                        <td className="px-3 py-2 text-xs text-muted-foreground">{r.room || ''}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t-2 border-border">
                      <td colSpan={5} className="px-3 py-3 text-sm font-semibold text-foreground text-right">Итого:</td>
                      <td className="px-3 py-3 text-lg font-bold text-foreground text-right">
                        {sym} {summary.total_cost.toFixed(2)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </Card>
          </motion.div>
        </motion.div>
      )}
    </div>
  )
}
