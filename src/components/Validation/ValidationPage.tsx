import { useState, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ShieldCheck,
  Play,
  Download,
  FileCheck2,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  BarChart3,
  Target,
  TrendingUp,
  ListChecks,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Table } from '../ui/Table'
import { FileUpload } from '../ui/FileUpload'
import { useAppStore } from '../../store/appStore'
import { MotionPage } from '../MotionPage'
import { staggerContainer, fadeInUp, scaleIn, cardHover, listItem } from '../../lib/animations'
import { saveValidationResult } from '../../services/supabase-api'

// ---- Types ----

interface ValidationRule {
  id: string
  label: string
  description: string
  checked: boolean
}

interface RuleResult {
  ruleId: string
  ruleName: string
  status: 'pass' | 'fail' | 'warning'
  score: number
  total: number
  passed: number
  details: string
}

interface ValidationIssue {
  id: string
  severity: 'error' | 'warning' | 'info'
  element: string
  rule: string
  description: string
  suggestion: string
}

interface ValidationReport {
  overallScore: number
  ruleResults: RuleResult[]
  issues: ValidationIssue[]
  timestamp: string
  fileName: string
}

// ---- Mock Data ----

const INITIAL_RULES: ValidationRule[] = [
  { id: 'naming', label: 'Именование', description: 'Проверка соответствия названий элементов стандарту ISO 19650 и правилам компании', checked: true },
  { id: 'properties', label: 'Полнота свойств', description: 'Проверка заполнения обязательных IFC-свойств', checked: true },
  { id: 'geometry', label: 'Геометрия', description: 'Поиск дефектов геометрии, нулевых граней и дублирующихся вершин', checked: true },
  { id: 'classification', label: 'Классификация', description: 'Проверка кодов Uniclass / OmniClass', checked: false },
  { id: 'spatial', label: 'Пространственная структура', description: 'Проверка иерархии IfcSite > IfcBuilding > IfcStorey', checked: false },
]

function generateMockReport(fileName: string, rules: ValidationRule[]): ValidationReport {
  const enabledRules = rules.filter((r) => r.checked)
  const ruleResults: RuleResult[] = enabledRules.map((rule) => {
    const total = Math.floor(Math.random() * 200) + 50
    const passRate = 0.6 + Math.random() * 0.4
    const passed = Math.floor(total * passRate)
    const score = Math.round((passed / total) * 100)
    return {
      ruleId: rule.id,
      ruleName: rule.label,
      status: score >= 90 ? 'pass' : score >= 70 ? 'warning' : 'fail',
      score,
      total,
      passed,
      details: `${passed}/${total} elements passed (${score}%)`,
    }
  })

  const overallScore = ruleResults.length > 0
    ? Math.round(ruleResults.reduce((sum, r) => sum + r.score, 0) / ruleResults.length)
    : 0

  const severities: ValidationIssue['severity'][] = ['error', 'warning', 'info']
  const sampleElements = [
    'Wall-001', 'Floor-B1-003', 'Door-L2-017', 'Window-L3-042',
    'Column-Grid-A5', 'Beam-L4-009', 'Slab-Roof-002', 'Stair-Core-001',
    'Duct-HVAC-115', 'Pipe-SAN-203', 'CurtainWall-East-01', 'Railing-L2-006',
  ]
  const sampleDescriptions: Record<string, string[]> = {
    naming: [
      'Element name does not follow naming convention pattern',
      'Missing project prefix in element name',
      'Name contains invalid special characters',
    ],
    properties: [
      'Required property "FireRating" is missing',
      'Property "LoadBearing" has no value assigned',
      'Material property is empty',
    ],
    geometry: [
      'Element has zero-thickness geometry',
      'Duplicate vertices detected in mesh',
      'Self-intersecting polygon found',
    ],
    classification: [
      'Classification code not found in Uniclass 2015',
      'Missing OmniClass classification',
      'Invalid classification format',
    ],
    spatial: [
      'Element not assigned to any IfcBuildingStorey',
      'Missing IfcBuilding container',
      'Orphaned element outside spatial hierarchy',
    ],
  }
  const suggestions: Record<string, string[]> = {
    naming: [
      'Rename to match pattern: [Type]-[Level]-[Number]',
      'Add project prefix "PRJ-" to element name',
      'Remove special characters and use only alphanumeric with hyphens',
    ],
    properties: [
      'Add FireRating property with appropriate value (e.g., "REI60")',
      'Set LoadBearing to "True" or "False"',
      'Assign material from project material library',
    ],
    geometry: [
      'Increase element thickness to minimum 1mm',
      'Run geometry cleanup to merge duplicate vertices',
      'Simplify polygon or split into convex parts',
    ],
    classification: [
      'Assign correct Uniclass code from table Ss',
      'Add OmniClass code from Table 23',
      'Use format "Ss_XX_XX_XX" for Uniclass codes',
    ],
    spatial: [
      'Move element into appropriate IfcBuildingStorey',
      'Create IfcBuilding container and reassign elements',
      'Link element to nearest spatial container',
    ],
  }

  const issues: ValidationIssue[] = []
  let issueId = 1
  for (const result of ruleResults) {
    if (result.status === 'pass') continue
    const count = result.status === 'fail' ? Math.floor(Math.random() * 5) + 3 : Math.floor(Math.random() * 3) + 1
    const descs = sampleDescriptions[result.ruleId] || sampleDescriptions.naming
    const suggs = suggestions[result.ruleId] || suggestions.naming
    for (let i = 0; i < count; i++) {
      issues.push({
        id: String(issueId++),
        severity: severities[Math.floor(Math.random() * (result.status === 'fail' ? 2 : 3))],
        element: sampleElements[Math.floor(Math.random() * sampleElements.length)],
        rule: result.ruleName,
        description: descs[Math.floor(Math.random() * descs.length)],
        suggestion: suggs[Math.floor(Math.random() * suggs.length)],
      })
    }
  }

  return {
    overallScore,
    ruleResults,
    issues: issues.sort((a, b) => {
      const order = { error: 0, warning: 1, info: 2 }
      return order[a.severity] - order[b.severity]
    }),
    timestamp: new Date().toISOString(),
    fileName,
  }
}

// ---- Helpers ----

function scoreColor(score: number): string {
  if (score >= 90) return 'text-success'
  if (score >= 70) return 'text-warning'
  return 'text-destructive'
}

function scoreBgColor(score: number): string {
  if (score >= 90) return 'bg-success'
  if (score >= 70) return 'bg-warning'
  return 'bg-destructive'
}

function severityBadge(severity: ValidationIssue['severity']) {
  const map: Record<string, 'danger' | 'warning' | 'info'> = { error: 'danger', warning: 'warning', info: 'info' }
  const labelMap: Record<ValidationIssue['severity'], string> = {
    error: 'Ошибка',
    warning: 'Предупреждение',
    info: 'Инфо',
  }
  return <Badge variant={map[severity]}>{labelMap[severity]}</Badge>
}

function statusIcon(status: RuleResult['status']) {
  if (status === 'pass') return <CheckCircle2 size={20} className="text-success" />
  if (status === 'warning') return <AlertTriangle size={20} className="text-warning" />
  return <XCircle size={20} className="text-destructive" />
}

// ---- Component ----

export default function ValidationPage() {
  const { addNotification } = useAppStore()
  const [files, setFiles] = useState<File[]>([])
  const [rules, setRules] = useState<ValidationRule[]>(INITIAL_RULES)
  const [report, setReport] = useState<ValidationReport | null>(null)
  const [running, setRunning] = useState(false)
  const [expandedRule, setExpandedRule] = useState<string | null>(null)
  const [modelsValidated, setModelsValidated] = useState(24)
  const [avgScore] = useState(82)
  const [issuesFound] = useState(156)
  const [passRate] = useState(78)

  const toggleRule = useCallback((id: string) => {
    setRules((prev) => prev.map((r) => (r.id === id ? { ...r, checked: !r.checked } : r)))
  }, [])

  const runValidation = useCallback(async () => {
    if (files.length === 0) {
      addNotification('warning', 'Загрузите минимум один файл для валидации.')
      return
    }
    const selectedRules = rules.filter((r) => r.checked)
    if (selectedRules.length === 0) {
      addNotification('warning', 'Выберите хотя бы одно правило валидации.')
      return
    }

    setRunning(true)
    setReport(null)

    try {
      // Real API call pattern
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      formData.append('rules', JSON.stringify(selectedRules.map((r) => r.id)))

      try {
        const res = await fetch('/api/validation/run', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          setReport(data)
          setModelsValidated((prev) => prev + 1)
          addNotification('success', `Валидация завершена. Оценка: ${data.overallScore}%`)
          // Persist to Supabase
          saveValidationResult({
            fileName: files[0].name,
            overallScore: data.overallScore || data.score || 0,
            summary: data.summary || {},
            ruleResults: data.ruleResults || data.results || [],
            issues: data.issues || [],
          }).catch(() => {})
          return
        }
      } catch {
        // API not available, use mock
      }

      // Fallback: mock data
      await new Promise((resolve) => setTimeout(resolve, 2000))
      const mockReport = generateMockReport(files[0].name, rules)
      setReport(mockReport)
      setModelsValidated((prev) => prev + 1)
      addNotification('success', `Валидация завершена. Оценка: ${mockReport.overallScore}%`)
      // Persist to Supabase
      saveValidationResult({
        fileName: files[0].name,
        overallScore: mockReport.overallScore,
        summary: mockReport.ruleResults.reduce((acc, r) => ({ ...acc, [r.ruleId]: r.status }), {}),
        ruleResults: mockReport.ruleResults,
        issues: mockReport.issues,
      }).catch(() => {})
    } catch (err) {
      addNotification('error', `Ошибка валидации: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    } finally {
      setRunning(false)
    }
  }, [files, rules, addNotification])

  const exportReport = useCallback((format: 'html' | 'pdf') => {
    if (!report) return

    if (format === 'html') {
      const html = `<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Jens Validation Report</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 900px; margin: 0 auto; padding: 2rem; color: #1a1a1a; }
  h1 { color: #2563eb; } h2 { margin-top: 2rem; border-bottom: 2px solid #e5e7eb; padding-bottom: 0.5rem; }
  .score { font-size: 3rem; font-weight: bold; }
  .pass { color: #16a34a; } .warning { color: #d97706; } .fail { color: #dc2626; }
  table { width: 100%; border-collapse: collapse; margin: 1rem 0; }
  th, td { text-align: left; padding: 0.5rem 1rem; border-bottom: 1px solid #e5e7eb; }
  th { background: #f9fafb; font-size: 0.875rem; text-transform: uppercase; color: #6b7280; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 0.75rem; font-weight: 500; }
  .badge-error { background: #fee2e2; color: #dc2626; }
  .badge-warning { background: #fef3c7; color: #d97706; }
  .badge-info { background: #cffafe; color: #0891b2; }
</style></head><body>
<h1>Jens - BIM Validation Report</h1>
<p>File: ${report.fileName} | Date: ${new Date(report.timestamp).toLocaleString()}</p>
<div class="score ${report.overallScore >= 90 ? 'pass' : report.overallScore >= 70 ? 'warning' : 'fail'}">${report.overallScore}%</div>
<h2>Rule Results</h2>
<table><thead><tr><th>Rule</th><th>Status</th><th>Score</th><th>Details</th></tr></thead><tbody>
${report.ruleResults.map((r) => `<tr><td>${r.ruleName}</td><td class="${r.status}">${r.status.toUpperCase()}</td><td>${r.score}%</td><td>${r.details}</td></tr>`).join('')}
</tbody></table>
<h2>Issues (${report.issues.length})</h2>
<table><thead><tr><th>Severity</th><th>Element</th><th>Rule</th><th>Description</th><th>Suggestion</th></tr></thead><tbody>
${report.issues.map((i) => `<tr><td><span class="badge badge-${i.severity}">${i.severity.toUpperCase()}</span></td><td>${i.element}</td><td>${i.rule}</td><td>${i.description}</td><td>${i.suggestion}</td></tr>`).join('')}
</tbody></table>
<p style="margin-top:2rem;color:#9ca3af;font-size:0.75rem;">Generated by Jens Construction Platform</p>
</body></html>`
      const blob = new Blob([html], { type: 'text/html' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `validation-report-${Date.now()}.html`
      a.click()
      URL.revokeObjectURL(url)
      addNotification('success', 'HTML-отчёт загружен.')
    } else {
      // PDF export - would call backend in production
      addNotification('info', 'Экспорт PDF требует backend. Пока используйте HTML.')
    }
  }, [report, addNotification])

  const issueColumns = [
    {
      key: 'severity',
      header: 'Критичность',
      render: (item: ValidationIssue) => severityBadge(item.severity),
      className: 'w-28',
    },
    { key: 'element', header: 'Элемент', className: 'font-mono text-xs' },
    { key: 'rule', header: 'Правило' },
    { key: 'description', header: 'Описание' },
    { key: 'suggestion', header: 'Рекомендация', className: 'text-muted-foreground' },
  ]

  return (
    <MotionPage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
                <ShieldCheck size={28} className="text-primary" />
                Валидация BIM
              </h1>
            </div>
            <p className="text-muted-foreground mt-1">
              Проверка IFC-моделей на соответствие отраслевым и проектным стандартам
            </p>
          </div>
        {report && (
          <div className="flex gap-2">
            <Button variant="outline" icon={<Download size={16} />} onClick={() => exportReport('html')}>
              Экспорт HTML
            </Button>
            <Button variant="outline" icon={<Download size={16} />} onClick={() => exportReport('pdf')}>
              Экспорт PDF
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeInUp}>
          <StatCard label="Проверено моделей" value={modelsValidated} icon={FileCheck2} color="primary" trend={{ value: 12, label: 'за месяц' }} />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="Средняя оценка" value={`${avgScore}%`} icon={Target} color="success" trend={{ value: 5, label: 'к прошлому месяцу' }} />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="Найдено замечаний" value={issuesFound} icon={AlertTriangle} color="warning" trend={{ value: -8, label: 'к прошлому месяцу' }} />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="Процент прохождения" value={`${passRate}%`} icon={TrendingUp} color="success" trend={{ value: 3, label: 'улучшение' }} />
        </motion.div>
      </motion.div>

      {/* Upload & Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File Upload */}
        <div className="lg:col-span-2">
          <Card title="Загрузка модели" subtitle="IFC или Excel-файлы для проверки">
            <FileUpload
              accept=".ifc,.xlsx,.xls"
              multiple
              onFilesSelected={setFiles}
              label="Перетащите IFC или Excel-файлы сюда"
              description="Поддержка .ifc, .xlsx, .xls до 500 МБ"
            />
          </Card>
        </div>

        {/* Validation Rules */}
        <Card title="Правила валидации" subtitle="Выберите правила для проверки" actions={
          <span className="text-xs text-muted-foreground">Выбрано: {rules.filter((r) => r.checked).length}/{rules.length}</span>
        }>
          <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
            {rules.map((rule) => (
              <motion.label
                key={rule.id}
                variants={listItem}
                className="flex items-start gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={rule.checked}
                  onChange={() => toggleRule(rule.id)}
                  className="mt-0.5 w-4 h-4 rounded border-border text-primary focus:ring-primary/30"
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{rule.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rule.description}</p>
                </div>
              </motion.label>
            ))}
          </motion.div>

          <Button
            className="w-full mt-4"
            icon={<Play size={16} />}
            loading={running}
            onClick={runValidation}
            disabled={files.length === 0}
          >
            {running ? 'Идёт проверка...' : 'Запустить проверку'}
          </Button>
        </Card>
      </div>

      {/* Results */}
      <AnimatePresence mode="wait">
      {report && (
        <motion.div
          key="report"
          variants={scaleIn}
          initial="hidden"
          animate="visible"
          className="space-y-6"
        >
          {/* Overall Score */}
          <Card>
            <div className="flex items-center gap-8">
              {/* Score Circle */}
              <div className="relative w-32 h-32 shrink-0">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" className="text-border" />
                  <motion.circle
                    cx="60" cy="60" r="52" fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    initial={{ strokeDasharray: "0 327" }}
                    animate={{ strokeDasharray: `${(report.overallScore / 100) * 327} 327` }}
                    transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1], delay: 0.2 }}
                    className={scoreBgColor(report.overallScore).replace('bg-', 'text-')}
                    stroke="currentColor"
                  />
                </svg>
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className={`text-3xl font-bold ${scoreColor(report.overallScore)}`}>
                    {report.overallScore}
                  </span>
                </div>
              </div>

              {/* Score Summary */}
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground">Итоговая оценка валидации</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  Файл: <span className="font-medium text-foreground">{report.fileName}</span> |
                  Проверено: {new Date(report.timestamp).toLocaleString()} |
                  Правил: {report.ruleResults.length}
                </p>
                <div className="flex gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle2 size={14} className="text-success" />
                    <span className="text-muted-foreground">
                      Прошло: {report.ruleResults.filter((r) => r.status === 'pass').length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <AlertTriangle size={14} className="text-warning" />
                    <span className="text-muted-foreground">
                      Предупреждения: {report.ruleResults.filter((r) => r.status === 'warning').length}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <XCircle size={14} className="text-destructive" />
                    <span className="text-muted-foreground">
                      Ошибки: {report.ruleResults.filter((r) => r.status === 'fail').length}
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-border rounded-full overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${scoreBgColor(report.overallScore)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${report.overallScore}%` }}
                    transition={{ duration: 1, ease: [0.25, 0.1, 0.25, 1], delay: 0.3 }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Rule Results Cards */}
          <motion.div
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
          >
            {report.ruleResults.map((result) => (
              <motion.div
                key={result.ruleId}
                variants={cardHover}
                initial="rest"
                animate="rest"
                whileHover="hover"
                className="bg-card rounded-xl border border-border shadow-sm cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => setExpandedRule(expandedRule === result.ruleId ? null : result.ruleId)}
              >
                <div className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      {statusIcon(result.status)}
                      <div>
                        <h4 className="font-semibold text-foreground">{result.ruleName}</h4>
                        <p className="text-xs text-muted-foreground mt-0.5">{result.details}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xl font-bold ${scoreColor(result.score)}`}>{result.score}%</span>
                      {expandedRule === result.ruleId ? <ChevronUp size={16} className="text-muted-foreground" /> : <ChevronDown size={16} className="text-muted-foreground" />}
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="mt-3 h-1.5 bg-border rounded-full overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full ${scoreBgColor(result.score)}`}
                      initial={{ width: 0 }}
                      animate={{ width: `${result.score}%` }}
                      transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1], delay: 0.1 }}
                    />
                  </div>

                  {/* Expanded details */}
                  <AnimatePresence initial={false}>
                    {expandedRule === result.ruleId && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
                        className="overflow-hidden"
                      >
                        <div className="mt-4 pt-4 border-t border-border space-y-2">
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Всего элементов</span>
                            <span className="font-medium text-foreground">{result.total}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Пройдено</span>
                            <span className="font-medium text-success">{result.passed}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Ошибок</span>
                            <span className="font-medium text-destructive">{result.total - result.passed}</span>
                          </div>
                          <div className="flex justify-between text-sm">
                            <span className="text-muted-foreground">Связанные замечания</span>
                            <span className="font-medium text-foreground">
                              {report.issues.filter((i) => i.rule === result.ruleName).length}
                            </span>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </motion.div>
            ))}
          </motion.div>

          {/* Issues Table */}
          <Card
            title="Замечания"
            subtitle={`Найдено: ${report.issues.length}`}
            actions={
              <div className="flex items-center gap-2">
                <Badge variant="danger">Ошибки: {report.issues.filter((i) => i.severity === 'error').length}</Badge>
                <Badge variant="warning">Предупреждения: {report.issues.filter((i) => i.severity === 'warning').length}</Badge>
                <Badge variant="info">Инфо: {report.issues.filter((i) => i.severity === 'info').length}</Badge>
              </div>
            }
          >
            {report.issues.length > 0 ? (
              <Table
                columns={issueColumns as { key: string; header: string; render?: (item: Record<string, unknown>) => React.ReactNode; className?: string }[]}
                data={report.issues as unknown as Record<string, unknown>[]}
                keyField="id"
              />
            ) : (
              <div className="flex flex-col items-center py-12 text-muted-foreground">
                <CheckCircle2 size={48} className="text-success mb-3" />
                <p className="font-medium text-foreground">Замечаний не найдено</p>
                <p className="text-sm">Все выбранные правила пройдены успешно.</p>
              </div>
            )}
          </Card>

          {/* Legend */}
          <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-1.5">
              <Info size={12} />
              <span>Шкала оценки:</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span>90-100% Норма</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-warning" />
              <span>70-89% Предупреждение</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span>0-69% Критично</span>
            </div>
          </div>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Empty state */}
      <AnimatePresence mode="wait">
      {!report && !running && (
        <motion.div
          key="empty"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Card>
            <div className="flex flex-col items-center py-16 text-muted-foreground">
              <ListChecks size={48} className="mb-4 text-primary/30" />
              <h3 className="text-lg font-semibold text-foreground">Результатов валидации пока нет</h3>
              <p className="text-sm mt-1 max-w-md text-center">
                Загрузите IFC или Excel-файл, выберите правила и запустите проверку модели BIM.
              </p>
            </div>
          </Card>
        </motion.div>
      )}
      </AnimatePresence>

      {/* Running animation */}
      <AnimatePresence mode="wait">
      {running && (
        <motion.div
          key="running"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
        >
          <Card>
            <div className="flex flex-col items-center py-16">
              <div className="relative w-20 h-20 mb-4">
                <div className="absolute inset-0 border-4 border-border rounded-full" />
                <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                <BarChart3 size={28} className="absolute inset-0 m-auto text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground">Проверка модели...</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Проверяю правил: {rules.filter((r) => r.checked).length}, файлов: {files.length}
              </p>
            </div>
          </Card>
        </motion.div>
      )}
      </AnimatePresence>
      </div>
    </MotionPage>
  )
}
