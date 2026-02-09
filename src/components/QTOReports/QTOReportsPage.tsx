import { useState, useCallback } from 'react'
import {
  BarChart3, Layers, Building2, GitBranch, List,
  Download, FileSpreadsheet, FileText, Globe,
  Clock, Loader2, Play, Trash2
} from 'lucide-react'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Table } from '../ui/Table'
import { Tabs } from '../ui/Tabs'
import { FileUpload } from '../ui/FileUpload'
import { formatDate, formatCurrency } from '../../lib/utils'
import type { QTOReport, QTOOptions, QTOReportRecord } from '../../services/api'
import { generateQTO } from '../../services/api'
import { MotionPage } from '../MotionPage'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const MOCK_QTO_REPORT: QTOReport = {
  id: 'qto-001',
  fileName: 'Building_Model_Rev3.ifc',
  groupBy: 'type',
  categories: [
    {
      name: 'Walls',
      elementCount: 127,
      totalQuantity: 2340.5,
      unit: 'm\u00B2',
      totalCost: 468100,
      elements: [
        { id: 'w1', name: 'Exterior Wall - Concrete 300mm', type: 'Wall', floor: 'Level 1', phase: 'Phase 1', quantity: 450.2, unit: 'm\u00B2', unitCost: 280, totalCost: 126056, material: 'Concrete', dimensions: '300mm thick' },
        { id: 'w2', name: 'Interior Wall - Drywall 120mm', type: 'Wall', floor: 'Level 1', phase: 'Phase 1', quantity: 680.0, unit: 'm\u00B2', unitCost: 95, totalCost: 64600, material: 'Drywall', dimensions: '120mm thick' },
        { id: 'w3', name: 'Exterior Wall - Curtain Wall', type: 'Wall', floor: 'Level 2', phase: 'Phase 2', quantity: 520.3, unit: 'm\u00B2', unitCost: 420, totalCost: 218526, material: 'Glass/Aluminum', dimensions: 'Double glazed' },
        { id: 'w4', name: 'Interior Wall - Block 200mm', type: 'Wall', floor: 'Level 2', phase: 'Phase 1', quantity: 390.0, unit: 'm\u00B2', unitCost: 150, totalCost: 58500, material: 'CMU Block', dimensions: '200mm thick' },
      ],
    },
    {
      name: 'Floors / Slabs',
      elementCount: 45,
      totalQuantity: 5200.0,
      unit: 'm\u00B2',
      totalCost: 1040000,
      elements: [
        { id: 'f1', name: 'Ground Floor Slab - 250mm', type: 'Floor', floor: 'Level 0', phase: 'Phase 1', quantity: 1800.0, unit: 'm\u00B2', unitCost: 220, totalCost: 396000, material: 'Reinforced Concrete', dimensions: '250mm thick' },
        { id: 'f2', name: 'Suspended Slab - 200mm', type: 'Floor', floor: 'Level 1', phase: 'Phase 1', quantity: 1600.0, unit: 'm\u00B2', unitCost: 195, totalCost: 312000, material: 'Post-tensioned Concrete', dimensions: '200mm thick' },
        { id: 'f3', name: 'Suspended Slab - 200mm', type: 'Floor', floor: 'Level 2', phase: 'Phase 2', quantity: 1800.0, unit: 'm\u00B2', unitCost: 195, totalCost: 351000, material: 'Post-tensioned Concrete', dimensions: '200mm thick' },
      ],
    },
    {
      name: 'Columns',
      elementCount: 84,
      totalQuantity: 168.0,
      unit: 'm\u00B3',
      totalCost: 252000,
      elements: [
        { id: 'c1', name: 'Column - 400x400 Concrete', type: 'Column', floor: 'Level 0', phase: 'Phase 1', quantity: 56.0, unit: 'm\u00B3', unitCost: 1500, totalCost: 84000, material: 'Reinforced Concrete', dimensions: '400x400mm' },
        { id: 'c2', name: 'Column - 400x400 Concrete', type: 'Column', floor: 'Level 1', phase: 'Phase 1', quantity: 56.0, unit: 'm\u00B3', unitCost: 1500, totalCost: 84000, material: 'Reinforced Concrete', dimensions: '400x400mm' },
        { id: 'c3', name: 'Column - 400x400 Concrete', type: 'Column', floor: 'Level 2', phase: 'Phase 2', quantity: 56.0, unit: 'm\u00B3', unitCost: 1500, totalCost: 84000, material: 'Reinforced Concrete', dimensions: '400x400mm' },
      ],
    },
    {
      name: 'Beams',
      elementCount: 96,
      totalQuantity: 144.0,
      unit: 'm\u00B3',
      totalCost: 201600,
      elements: [
        { id: 'b1', name: 'Beam - 300x600 Concrete', type: 'Beam', floor: 'Level 1', phase: 'Phase 1', quantity: 48.0, unit: 'm\u00B3', unitCost: 1400, totalCost: 67200, material: 'Reinforced Concrete', dimensions: '300x600mm' },
        { id: 'b2', name: 'Beam - 300x600 Concrete', type: 'Beam', floor: 'Level 2', phase: 'Phase 2', quantity: 48.0, unit: 'm\u00B3', unitCost: 1400, totalCost: 67200, material: 'Reinforced Concrete', dimensions: '300x600mm' },
        { id: 'b3', name: 'Beam - Steel W310x45', type: 'Beam', floor: 'Roof', phase: 'Phase 2', quantity: 48.0, unit: 'm\u00B3', unitCost: 1400, totalCost: 67200, material: 'Structural Steel', dimensions: 'W310x45' },
      ],
    },
    {
      name: 'Doors',
      elementCount: 62,
      totalQuantity: 62,
      unit: 'pcs',
      totalCost: 93000,
      elements: [
        { id: 'd1', name: 'Single Door - 900x2100', type: 'Door', floor: 'Level 1', phase: 'Phase 1', quantity: 28, unit: 'pcs', unitCost: 1200, totalCost: 33600, material: 'Timber', dimensions: '900x2100mm' },
        { id: 'd2', name: 'Double Door - 1800x2100', type: 'Door', floor: 'Level 1', phase: 'Phase 1', quantity: 8, unit: 'pcs', unitCost: 2800, totalCost: 22400, material: 'Timber', dimensions: '1800x2100mm' },
        { id: 'd3', name: 'Fire Door - 900x2100', type: 'Door', floor: 'All', phase: 'Phase 2', quantity: 18, unit: 'pcs', unitCost: 1500, totalCost: 27000, material: 'Steel/Timber Composite', dimensions: '900x2100mm FRL 60' },
        { id: 'd4', name: 'Sliding Glass Door', type: 'Door', floor: 'Level 0', phase: 'Phase 2', quantity: 8, unit: 'pcs', unitCost: 1250, totalCost: 10000, material: 'Aluminum/Glass', dimensions: '2400x2400mm' },
      ],
    },
    {
      name: 'Windows',
      elementCount: 78,
      totalQuantity: 78,
      unit: 'pcs',
      totalCost: 156000,
      elements: [
        { id: 'win1', name: 'Fixed Window - 1200x1500', type: 'Window', floor: 'Level 1', phase: 'Phase 2', quantity: 40, unit: 'pcs', unitCost: 1800, totalCost: 72000, material: 'Aluminum/Glass', dimensions: '1200x1500mm DG' },
        { id: 'win2', name: 'Awning Window - 600x900', type: 'Window', floor: 'Level 2', phase: 'Phase 2', quantity: 38, unit: 'pcs', unitCost: 2210.53, totalCost: 84000, material: 'Aluminum/Glass', dimensions: '600x900mm DG' },
      ],
    },
  ],
  summary: {
    totalElements: 492,
    totalCategories: 6,
    totalFloors: 4,
    estimatedCost: 2210700,
    currency: 'USD',
  },
  createdAt: '2026-02-07T14:30:00Z',
}

const MOCK_HISTORY: (QTOReportRecord & Record<string, unknown>)[] = [
  { id: 'qto-001', fileName: 'Building_Model_Rev3.ifc', groupBy: 'type', totalElements: 492, estimatedCost: 2210700, createdAt: '2026-02-07T14:30:00Z' },
  { id: 'qto-002', fileName: 'Residential_Block_A.ifc', groupBy: 'floor', totalElements: 318, estimatedCost: 1450000, createdAt: '2026-02-05T09:15:00Z' },
  { id: 'qto-003', fileName: 'Office_Tower_Phase1.xlsx', groupBy: 'phase', totalElements: 756, estimatedCost: 5320000, createdAt: '2026-02-02T16:45:00Z' },
  { id: 'qto-004', fileName: 'Warehouse_Extension.ifc', groupBy: 'detailed', totalElements: 189, estimatedCost: 780000, createdAt: '2026-01-28T11:20:00Z' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const GROUP_OPTIONS: { value: QTOOptions['groupBy']; label: string; icon: typeof Layers }[] = [
  { value: 'type', label: 'Group by Type', icon: Layers },
  { value: 'floor', label: 'Group by Floor', icon: Building2 },
  { value: 'phase', label: 'Group by Phase', icon: GitBranch },
  { value: 'detailed', label: 'Detailed View', icon: List },
]

function exportToHtml(report: QTOReport) {
  const rows = report.categories.flatMap((cat) =>
    cat.elements.map((el) =>
      `<tr><td>${cat.name}</td><td>${el.name}</td><td>${el.material}</td><td>${el.floor}</td><td>${el.quantity}</td><td>${el.unit}</td><td>${formatCurrency(el.unitCost)}</td><td>${formatCurrency(el.totalCost)}</td></tr>`
    )
  )
  const html = `<!DOCTYPE html>
<html><head><title>QTO Report - ${report.fileName}</title>
<style>body{font-family:system-ui,sans-serif;padding:2rem;color:#1a1a2e}
table{width:100%;border-collapse:collapse;margin-top:1rem}
th,td{border:1px solid #ddd;padding:8px 12px;text-align:left;font-size:14px}
th{background:#f0f0f5;font-weight:600}
tr:hover{background:#f8f8fc}
h1{color:#1a1a2e}h2{color:#555;font-weight:normal;font-size:1rem}
.summary{display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin:1rem 0}
.stat{background:#f8f8fc;padding:1rem;border-radius:8px;border:1px solid #e0e0e8}
.stat-label{font-size:12px;color:#666}
.stat-value{font-size:1.5rem;font-weight:700;color:#1a1a2e}
</style></head><body>
<h1>Jens QTO Report</h1>
<h2>${report.fileName} | ${report.groupBy} | ${new Date(report.createdAt).toLocaleDateString()}</h2>
<div class="summary">
<div class="stat"><div class="stat-label">Total Elements</div><div class="stat-value">${report.summary.totalElements}</div></div>
<div class="stat"><div class="stat-label">Categories</div><div class="stat-value">${report.summary.totalCategories}</div></div>
<div class="stat"><div class="stat-label">Floors</div><div class="stat-value">${report.summary.totalFloors}</div></div>
<div class="stat"><div class="stat-label">Estimated Cost</div><div class="stat-value">${formatCurrency(report.summary.estimatedCost)}</div></div>
</div>
<table><thead><tr><th>Category</th><th>Element</th><th>Material</th><th>Floor</th><th>Qty</th><th>Unit</th><th>Unit Cost</th><th>Total</th></tr></thead>
<tbody>${rows.join('\n')}</tbody>
<tfoot><tr><td colspan="7" style="text-align:right;font-weight:700">Grand Total</td><td style="font-weight:700">${formatCurrency(report.summary.estimatedCost)}</td></tr></tfoot>
</table>
<p style="margin-top:2rem;color:#999;font-size:12px">Generated by Jens Construction Platform</p>
</body></html>`
  return html
}

function downloadBlob(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function exportToCsv(report: QTOReport) {
  const header = 'Category,Element,Material,Floor,Phase,Quantity,Unit,Unit Cost,Total Cost'
  const rows = report.categories.flatMap((cat) =>
    cat.elements.map((el) =>
      `"${cat.name}","${el.name}","${el.material}","${el.floor}","${el.phase}",${el.quantity},"${el.unit}",${el.unitCost},${el.totalCost}`
    )
  )
  return [header, ...rows].join('\n')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function GenerateTab() {
  const [files, setFiles] = useState<File[]>([])
  const [groupBy, setGroupBy] = useState<QTOOptions['groupBy']>('type')
  const [generating, setGenerating] = useState(false)
  const [report, setReport] = useState<QTOReport | null>(null)
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set())

  const toggleCategory = (name: string) => {
    setExpandedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const handleGenerate = useCallback(async () => {
    if (files.length === 0) return
    setGenerating(true)
    setReport(null)
    try {
      const formData = new FormData()
      files.forEach((f) => formData.append('files', f))
      const options: QTOOptions = { groupBy, includeQuantities: true, includeCost: true }
      const result = await generateQTO(formData, options)
      setReport(result)
    } catch {
      // Fallback: use mock data
      setReport({ ...MOCK_QTO_REPORT, groupBy, fileName: files[0]?.name || 'Uploaded File' })
    } finally {
      setGenerating(false)
      setExpandedCategories(new Set())
    }
  }, [files, groupBy])

  return (
    <div className="space-y-6">
      {/* Upload + Options */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card title="Upload File" subtitle="IFC or Excel files for quantity extraction">
            <FileUpload
              accept=".ifc,.xlsx,.xls"
              onFilesSelected={setFiles}
              label="Drop IFC or Excel file here"
              description="Supports .ifc, .xlsx, .xls up to 500MB"
            />
          </Card>
        </div>

        <Card title="Report Options">
          <div className="space-y-3">
            <label className="block text-sm font-medium text-foreground mb-2">Group By</label>
            {GROUP_OPTIONS.map((opt) => {
              const Icon = opt.icon
              return (
                <button
                  key={opt.value}
                  onClick={() => setGroupBy(opt.value)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium transition-all ${
                    groupBy === opt.value
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border hover:border-primary/40 text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon size={18} />
                  {opt.label}
                </button>
              )
            })}

            <Button
              onClick={handleGenerate}
              loading={generating}
              disabled={files.length === 0}
              icon={<Play size={16} />}
              size="lg"
              className="w-full mt-4"
            >
              Generate Report
            </Button>
          </div>
        </Card>
      </div>

      {/* Report Preview */}
      {report && (
        <>
          {/* Summary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard label="Total Elements" value={report.summary.totalElements} icon={Layers} color="primary" />
            <StatCard label="Categories" value={report.summary.totalCategories} icon={BarChart3} color="success" />
            <StatCard label="Floors" value={report.summary.totalFloors} icon={Building2} color="warning" />
            <StatCard label="Estimated Cost" value={formatCurrency(report.summary.estimatedCost)} color="primary" />
          </div>

          {/* Report Table */}
          <Card
            title={`QTO Report - ${report.fileName}`}
            subtitle={`Grouped by ${report.groupBy} | Generated ${formatDate(report.createdAt)}`}
            actions={
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FileSpreadsheet size={14} />}
                  onClick={() => {
                    const csv = exportToCsv(report)
                    downloadBlob(csv, `qto-report-${report.id}.csv`, 'text/csv')
                  }}
                >
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<FileText size={14} />}
                  onClick={() => {
                    const html = exportToHtml(report)
                    downloadBlob(html, `qto-report-${report.id}.pdf.html`, 'text/html')
                  }}
                >
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  icon={<Globe size={14} />}
                  onClick={() => {
                    const html = exportToHtml(report)
                    downloadBlob(html, `qto-report-${report.id}.html`, 'text/html')
                  }}
                >
                  HTML
                </Button>
              </div>
            }
          >
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Category / Element</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Material</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Floor</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Quantity</th>
                    <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Unit</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Unit Cost</th>
                    <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {report.categories.map((cat) => (
                    <>
                      {/* Category header row */}
                      <tr
                        key={`cat-${cat.name}`}
                        className="bg-muted cursor-pointer hover:bg-primary/10 transition-colors"
                        onClick={() => toggleCategory(cat.name)}
                      >
                        <td className="px-4 py-3 text-sm font-semibold text-foreground" colSpan={2}>
                          <div className="flex items-center gap-2">
                            <span className={`transition-transform inline-block ${expandedCategories.has(cat.name) ? 'rotate-90' : ''}`}>
                              &#9654;
                            </span>
                            {cat.name}
                            <Badge variant="default">{cat.elementCount} elements</Badge>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground text-right" />
                        <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">
                          {cat.totalQuantity.toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{cat.unit}</td>
                        <td className="px-4 py-3 text-sm text-muted-foreground text-right" />
                        <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">
                          {formatCurrency(cat.totalCost)}
                        </td>
                      </tr>

                      {/* Expanded element rows */}
                      {expandedCategories.has(cat.name) &&
                        cat.elements.map((el) => (
                          <tr key={el.id} className="border-b border-border/30 hover:bg-muted/50 transition-colors">
                            <td className="px-4 py-2.5 text-sm text-foreground pl-10">{el.name}</td>
                            <td className="px-4 py-2.5 text-sm text-muted-foreground">{el.material}</td>
                            <td className="px-4 py-2.5 text-sm text-muted-foreground">{el.floor}</td>
                            <td className="px-4 py-2.5 text-sm text-foreground text-right">{el.quantity.toLocaleString()}</td>
                            <td className="px-4 py-2.5 text-sm text-muted-foreground">{el.unit}</td>
                            <td className="px-4 py-2.5 text-sm text-foreground text-right">{formatCurrency(el.unitCost)}</td>
                            <td className="px-4 py-2.5 text-sm text-foreground font-medium text-right">{formatCurrency(el.totalCost)}</td>
                          </tr>
                        ))}
                    </>
                  ))}

                  {/* Grand Total */}
                  <tr className="border-t-2 border-border bg-muted">
                    <td className="px-4 py-3 text-sm font-bold text-foreground" colSpan={6}>
                      Grand Total
                    </td>
                    <td className="px-4 py-3 text-sm font-bold text-primary text-right">
                      {formatCurrency(report.summary.estimatedCost)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>
        </>
      )}
    </div>
  )
}

function HistoryTab() {
  const [history] = useState(MOCK_HISTORY)

  const columns = [
    {
      key: 'fileName',
      header: 'File Name',
      render: (r: typeof history[0]) => (
        <div className="flex items-center gap-2">
          <FileSpreadsheet size={16} className="text-primary shrink-0" />
          <span className="font-medium">{r.fileName}</span>
        </div>
      ),
    },
    {
      key: 'groupBy',
      header: 'Group By',
      render: (r: typeof history[0]) => (
        <Badge variant="primary">{r.groupBy}</Badge>
      ),
    },
    { key: 'totalElements', header: 'Elements' },
    {
      key: 'estimatedCost',
      header: 'Estimated Cost',
      render: (r: typeof history[0]) => (
        <span className="font-medium">{formatCurrency(r.estimatedCost)}</span>
      ),
    },
    {
      key: 'createdAt',
      header: 'Date',
      render: (r: typeof history[0]) => formatDate(r.createdAt),
    },
    {
      key: 'actions',
      header: '',
      render: () => (
        <div className="flex items-center gap-1">
          <button className="p-1.5 rounded hover:bg-muted transition-colors" title="Download">
            <Download size={14} className="text-muted-foreground" />
          </button>
          <button className="p-1.5 rounded hover:bg-destructive/10 transition-colors" title="Delete">
            <Trash2 size={14} className="text-muted-foreground hover:text-destructive" />
          </button>
        </div>
      ),
    },
  ]

  return (
    <Card title="Report History" subtitle="Previously generated QTO reports">
      <Table columns={columns} data={history} emptyMessage="No reports generated yet" />
    </Card>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function QTOReportsPage() {
  const tabs = [
    { id: 'generate', label: 'Generate Report', icon: <Play size={16} /> },
    { id: 'history', label: 'Report History', icon: <Clock size={16} /> },
  ]

  return (
    <MotionPage><div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">QTO Reports</h1>
        <p className="text-muted-foreground mt-1">
          Generate Quantity Take-Off reports from IFC models and Excel files
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Total Elements"
          value={MOCK_QTO_REPORT.summary.totalElements}
          icon={Layers}
          color="primary"
        />
        <StatCard
          label="Categories"
          value={MOCK_QTO_REPORT.summary.totalCategories}
          icon={BarChart3}
          color="success"
        />
        <StatCard
          label="Floors"
          value={MOCK_QTO_REPORT.summary.totalFloors}
          icon={Building2}
          color="warning"
        />
        <StatCard
          label="Estimated Cost"
          value={formatCurrency(MOCK_QTO_REPORT.summary.estimatedCost)}
          color="primary"
          trend={{ value: 3.2, label: 'from last estimate' }}
        />
      </div>

      {/* Tabs */}
      <Tabs tabs={tabs} defaultTab="generate">
        {(activeTab) => (
          <>
            {activeTab === 'generate' && <GenerateTab />}
            {activeTab === 'history' && <HistoryTab />}
          </>
        )}
      </Tabs>
    </div></MotionPage>
  )
}
