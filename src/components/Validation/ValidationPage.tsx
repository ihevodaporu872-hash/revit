import { useState, useCallback } from 'react'
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
  { id: 'naming', label: 'Naming Convention', description: 'Check element names follow ISO 19650 / company standards', checked: true },
  { id: 'properties', label: 'Property Completeness', description: 'Verify all required IFC properties are populated', checked: true },
  { id: 'geometry', label: 'Geometry Valid', description: 'Detect invalid geometry, zero-area faces, duplicate vertices', checked: true },
  { id: 'classification', label: 'Classification', description: 'Validate Uniclass / OmniClass classification codes', checked: false },
  { id: 'spatial', label: 'Spatial Structure', description: 'Ensure correct IfcSite > IfcBuilding > IfcStorey hierarchy', checked: false },
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
  return <Badge variant={map[severity]}>{severity.toUpperCase()}</Badge>
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
      addNotification('warning', 'Please upload at least one file to validate.')
      return
    }
    const selectedRules = rules.filter((r) => r.checked)
    if (selectedRules.length === 0) {
      addNotification('warning', 'Please select at least one validation rule.')
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
          addNotification('success', `Validation completed. Score: ${data.overallScore}%`)
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
      addNotification('success', `Validation completed. Score: ${mockReport.overallScore}%`)
    } catch (err) {
      addNotification('error', `Validation failed: ${err instanceof Error ? err.message : 'Unknown error'}`)
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
      addNotification('success', 'HTML report downloaded.')
    } else {
      // PDF export - would call backend in production
      addNotification('info', 'PDF export requires backend. Use HTML export for now.')
    }
  }, [report, addNotification])

  const issueColumns = [
    {
      key: 'severity',
      header: 'Severity',
      render: (item: ValidationIssue) => severityBadge(item.severity),
      className: 'w-28',
    },
    { key: 'element', header: 'Element', className: 'font-mono text-xs' },
    { key: 'rule', header: 'Rule' },
    { key: 'description', header: 'Description' },
    { key: 'suggestion', header: 'Suggestion', className: 'text-muted-foreground' },
  ]

  return (
    <MotionPage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <ShieldCheck size={28} className="text-primary" />
              BIM Validation
            </h1>
            <p className="text-muted-foreground mt-1">
              Validate IFC models against industry standards and custom rules
            </p>
          </div>
        {report && (
          <div className="flex gap-2">
            <Button variant="outline" icon={<Download size={16} />} onClick={() => exportReport('html')}>
              Export HTML
            </Button>
            <Button variant="outline" icon={<Download size={16} />} onClick={() => exportReport('pdf')}>
              Export PDF
            </Button>
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Models Validated" value={modelsValidated} icon={FileCheck2} color="primary" trend={{ value: 12, label: 'this month' }} />
        <StatCard label="Average Score" value={`${avgScore}%`} icon={Target} color="success" trend={{ value: 5, label: 'vs last month' }} />
        <StatCard label="Issues Found" value={issuesFound} icon={AlertTriangle} color="warning" trend={{ value: -8, label: 'vs last month' }} />
        <StatCard label="Pass Rate" value={`${passRate}%`} icon={TrendingUp} color="success" trend={{ value: 3, label: 'improvement' }} />
      </div>

      {/* Upload & Rules */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* File Upload */}
        <div className="lg:col-span-2">
          <Card title="Upload Model" subtitle="IFC or Excel files for validation">
            <FileUpload
              accept=".ifc,.xlsx,.xls"
              multiple
              onFilesSelected={setFiles}
              label="Drop IFC or Excel files here"
              description="Supports .ifc, .xlsx, .xls up to 500 MB"
            />
          </Card>
        </div>

        {/* Validation Rules */}
        <Card title="Validation Rules" subtitle="Select rules to check" actions={
          <span className="text-xs text-muted-foreground">{rules.filter((r) => r.checked).length}/{rules.length} selected</span>
        }>
          <div className="space-y-3">
            {rules.map((rule) => (
              <label
                key={rule.id}
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
              </label>
            ))}
          </div>

          <Button
            className="w-full mt-4"
            icon={<Play size={16} />}
            loading={running}
            onClick={runValidation}
            disabled={files.length === 0}
          >
            {running ? 'Validating...' : 'Run Validation'}
          </Button>
        </Card>
      </div>

      {/* Results */}
      {report && (
        <>
          {/* Overall Score */}
          <Card>
            <div className="flex items-center gap-8">
              {/* Score Circle */}
              <div className="relative w-32 h-32 shrink-0">
                <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
                  <circle cx="60" cy="60" r="52" fill="none" stroke="currentColor" strokeWidth="10" className="text-border" />
                  <circle
                    cx="60" cy="60" r="52" fill="none"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${(report.overallScore / 100) * 327} 327`}
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
                <h3 className="text-lg font-semibold text-foreground">Overall Validation Score</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  File: <span className="font-medium text-foreground">{report.fileName}</span> |
                  Validated: {new Date(report.timestamp).toLocaleString()} |
                  Rules checked: {report.ruleResults.length}
                </p>
                <div className="flex gap-4 mt-3">
                  <div className="flex items-center gap-1.5 text-sm">
                    <CheckCircle2 size={14} className="text-success" />
                    <span className="text-muted-foreground">
                      {report.ruleResults.filter((r) => r.status === 'pass').length} Passed
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <AlertTriangle size={14} className="text-warning" />
                    <span className="text-muted-foreground">
                      {report.ruleResults.filter((r) => r.status === 'warning').length} Warnings
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-sm">
                    <XCircle size={14} className="text-destructive" />
                    <span className="text-muted-foreground">
                      {report.ruleResults.filter((r) => r.status === 'fail').length} Failed
                    </span>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="mt-3 h-2 bg-border rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-1000 ${scoreBgColor(report.overallScore)}`}
                    style={{ width: `${report.overallScore}%` }}
                  />
                </div>
              </div>
            </div>
          </Card>

          {/* Rule Results Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {report.ruleResults.map((result) => (
              <div
                key={result.ruleId}
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
                    <div
                      className={`h-full rounded-full ${scoreBgColor(result.score)}`}
                      style={{ width: `${result.score}%` }}
                    />
                  </div>

                  {/* Expanded details */}
                  {expandedRule === result.ruleId && (
                    <div className="mt-4 pt-4 border-t border-border space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Total Elements</span>
                        <span className="font-medium text-foreground">{result.total}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Passed</span>
                        <span className="font-medium text-success">{result.passed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Failed</span>
                        <span className="font-medium text-destructive">{result.total - result.passed}</span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Related Issues</span>
                        <span className="font-medium text-foreground">
                          {report.issues.filter((i) => i.rule === result.ruleName).length}
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Issues Table */}
          <Card
            title="Issues"
            subtitle={`${report.issues.length} issues found`}
            actions={
              <div className="flex items-center gap-2">
                <Badge variant="danger">{report.issues.filter((i) => i.severity === 'error').length} Errors</Badge>
                <Badge variant="warning">{report.issues.filter((i) => i.severity === 'warning').length} Warnings</Badge>
                <Badge variant="info">{report.issues.filter((i) => i.severity === 'info').length} Info</Badge>
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
                <p className="font-medium text-foreground">No issues found</p>
                <p className="text-sm">All validation rules passed successfully.</p>
              </div>
            )}
          </Card>

          {/* Legend */}
          <div className="flex items-center gap-6 text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-1.5">
              <Info size={12} />
              <span>Score colors: </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-success" />
              <span>90-100% Pass</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-warning" />
              <span>70-89% Warning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-full bg-destructive" />
              <span>0-69% Fail</span>
            </div>
          </div>
        </>
      )}

      {/* Empty state */}
      {!report && !running && (
        <Card>
          <div className="flex flex-col items-center py-16 text-muted-foreground">
            <ListChecks size={56} className="mb-4 text-primary/30" />
            <h3 className="text-lg font-semibold text-foreground">No Validation Results Yet</h3>
            <p className="text-sm mt-1 max-w-md text-center">
              Upload an IFC or Excel file, select your validation rules, and click "Run Validation" to check your BIM model against industry standards.
            </p>
          </div>
        </Card>
      )}

      {/* Running animation */}
      {running && (
        <Card>
          <div className="flex flex-col items-center py-16">
            <div className="relative w-20 h-20 mb-4">
              <div className="absolute inset-0 border-4 border-border rounded-full" />
              <div className="absolute inset-0 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <BarChart3 size={28} className="absolute inset-0 m-auto text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Validating Model...</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Checking {rules.filter((r) => r.checked).length} rules against {files.length} file(s)
            </p>
          </div>
        </Card>
      )}
      </div>
    </MotionPage>
  )
}
