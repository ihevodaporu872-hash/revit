import { useState, useCallback } from 'react'
import {
  FileOutput,
  CheckCircle2,
  Clock,
  BarChart3,
  Download,
  Eye,
  Calculator,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  Box,
  FileText,
  AlertCircle,
  Loader2,
} from 'lucide-react'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Tabs } from '../ui/Tabs'
import { Table } from '../ui/Table'
import { FileUpload } from '../ui/FileUpload'
import { useAppStore } from '../../store/appStore'
import { formatDate } from '../../lib/utils'

// ── Types ──────────────────────────────────────────────────────────────

type OutputFormat = 'excel' | 'dae' | 'pdf'
type ConversionStatus = 'queued' | 'converting' | 'completed' | 'failed'

interface ConversionJob {
  id: string
  fileName: string
  inputFormat: string
  outputFormat: OutputFormat
  status: ConversionStatus
  progress: number
  fileSize: string
  outputUrl?: string
  error?: string
  createdAt: string
  completedAt?: string
  duration?: string
}

interface ConversionHistoryEntry {
  id: string
  fileName: string
  inputFormat: string
  outputFormat: OutputFormat
  status: ConversionStatus
  createdAt: string
  duration: string
  fileSize: string
}

// ── Mock Data ──────────────────────────────────────────────────────────

const MOCK_HISTORY: ConversionHistoryEntry[] = [
  { id: 'h1', fileName: 'Hospital_Phase2.rvt', inputFormat: 'RVT', outputFormat: 'excel', status: 'completed', createdAt: '2026-02-07T14:30:00Z', duration: '2m 14s', fileSize: '45.2 MB' },
  { id: 'h2', fileName: 'Bridge_Design.ifc', inputFormat: 'IFC', outputFormat: 'dae', status: 'completed', createdAt: '2026-02-07T11:15:00Z', duration: '1m 42s', fileSize: '28.7 MB' },
  { id: 'h3', fileName: 'Office_MEP.dwg', inputFormat: 'DWG', outputFormat: 'pdf', status: 'completed', createdAt: '2026-02-06T16:45:00Z', duration: '0m 38s', fileSize: '12.1 MB' },
  { id: 'h4', fileName: 'Parking_Structure.dgn', inputFormat: 'DGN', outputFormat: 'excel', status: 'failed', createdAt: '2026-02-06T09:20:00Z', duration: '—', fileSize: '67.3 MB' },
  { id: 'h5', fileName: 'Residential_Block_A.rvt', inputFormat: 'RVT', outputFormat: 'dae', status: 'completed', createdAt: '2026-02-05T13:10:00Z', duration: '3m 05s', fileSize: '89.4 MB' },
  { id: 'h6', fileName: 'HVAC_Layout.ifc', inputFormat: 'IFC', outputFormat: 'excel', status: 'completed', createdAt: '2026-02-05T08:55:00Z', duration: '1m 18s', fileSize: '19.6 MB' },
]

const FORMAT_OPTIONS: { id: OutputFormat; label: string; description: string; icon: React.ReactNode }[] = [
  { id: 'excel', label: 'Excel (.xlsx)', description: 'Property tables, quantities, schedules', icon: <FileSpreadsheet size={20} /> },
  { id: 'dae', label: 'DAE 3D (.dae)', description: '3D geometry for viewers and engines', icon: <Box size={20} /> },
  { id: 'pdf', label: 'PDF Report', description: 'Formatted property reports', icon: <FileText size={20} /> },
]

// ── Helpers ─────────────────────────────────────────────────────────────

function statusBadge(status: ConversionStatus) {
  const map: Record<ConversionStatus, { variant: 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
    queued: { variant: 'info', label: 'Queued' },
    converting: { variant: 'warning', label: 'Converting' },
    completed: { variant: 'success', label: 'Completed' },
    failed: { variant: 'danger', label: 'Failed' },
  }
  const { variant, label } = map[status]
  return <Badge variant={variant}>{label}</Badge>
}

function getFileExtension(name: string): string {
  return name.split('.').pop()?.toUpperCase() || ''
}

// ── Component ──────────────────────────────────────────────────────────

export default function ConverterPage() {
  const { addNotification } = useAppStore()

  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [outputFormat, setOutputFormat] = useState<OutputFormat>('excel')
  const [jobs, setJobs] = useState<ConversionJob[]>([])
  const [isConverting, setIsConverting] = useState(false)
  const [history] = useState<ConversionHistoryEntry[]>(MOCK_HISTORY)

  // ── Stats (derived from mock + active jobs) ────────────

  const totalConverted = history.filter((h) => h.status === 'completed').length + jobs.filter((j) => j.status === 'completed').length
  const successRate = history.length > 0
    ? Math.round((history.filter((h) => h.status === 'completed').length / history.length) * 100)
    : 100
  const formatsUsed = new Set([...history.map((h) => h.outputFormat), ...jobs.map((j) => j.outputFormat)]).size

  // ── Handlers ───────────────────────────────────────────

  const handleFilesSelected = useCallback((files: File[]) => {
    setSelectedFiles(files)
  }, [])

  const startConversion = async () => {
    if (selectedFiles.length === 0) {
      addNotification('warning', 'Please select at least one file to convert.')
      return
    }

    setIsConverting(true)

    // Create jobs for each file
    const newJobs: ConversionJob[] = selectedFiles.map((file, i) => ({
      id: `job-${Date.now()}-${i}`,
      fileName: file.name,
      inputFormat: getFileExtension(file.name),
      outputFormat,
      status: 'queued' as ConversionStatus,
      progress: 0,
      fileSize: `${(file.size / (1024 * 1024)).toFixed(1)} MB`,
      createdAt: new Date().toISOString(),
    }))

    setJobs((prev) => [...newJobs, ...prev])

    // Simulate conversion with progress for each job
    for (const job of newJobs) {
      // Mark as converting
      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: 'converting' as ConversionStatus } : j))

      // Simulate progress
      for (let p = 0; p <= 100; p += 10) {
        await new Promise((r) => setTimeout(r, 200))
        setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, progress: p } : j))
      }

      // Random success/failure (90% success rate)
      const succeeded = Math.random() > 0.1
      setJobs((prev) =>
        prev.map((j) =>
          j.id === job.id
            ? {
                ...j,
                status: succeeded ? 'completed' : 'failed',
                progress: 100,
                completedAt: new Date().toISOString(),
                duration: `${Math.floor(Math.random() * 3)}m ${Math.floor(Math.random() * 59)}s`,
                outputUrl: succeeded ? `/api/converter/download/${job.id}` : undefined,
                error: succeeded ? undefined : 'Unsupported geometry type in source file',
              }
            : j,
        ),
      )
    }

    setIsConverting(false)
    addNotification('success', `Batch conversion of ${selectedFiles.length} file(s) complete.`)

    // In real implementation:
    // const formData = new FormData()
    // selectedFiles.forEach(f => formData.append('files', f))
    // formData.append('outputFormat', outputFormat)
    // const res = await fetch('/api/converter/convert', { method: 'POST', body: formData })
  }

  const clearCompleted = () => {
    setJobs((prev) => prev.filter((j) => j.status !== 'completed' && j.status !== 'failed'))
  }

  const openIn3DViewer = (job: ConversionJob) => {
    addNotification('info', `Opening ${job.fileName} in 3D Viewer...`)
    // In real implementation: navigate to /viewer?file=job.outputUrl
  }

  const runCostEstimate = (job: ConversionJob) => {
    addNotification('info', `Running cost estimate for ${job.fileName}...`)
    // In real implementation: navigate to /cost?file=job.outputUrl
  }

  // ── Column definitions ──────────────────────────────────

  const jobColumns = [
    { key: 'fileName', header: 'File', render: (j: ConversionJob) => (
      <div>
        <p className="font-medium">{j.fileName}</p>
        <p className="text-xs text-text-secondary">{j.fileSize}</p>
      </div>
    )},
    { key: 'inputFormat', header: 'Input', render: (j: ConversionJob) => <Badge variant="default">{j.inputFormat}</Badge> },
    { key: 'outputFormat', header: 'Output', render: (j: ConversionJob) => (
      <Badge variant="primary">{j.outputFormat.toUpperCase()}</Badge>
    )},
    { key: 'status', header: 'Status', render: (j: ConversionJob) => (
      <div className="flex items-center gap-2">
        {statusBadge(j.status)}
        {j.status === 'converting' && <span className="text-xs text-text-secondary">{j.progress}%</span>}
      </div>
    )},
    { key: 'progress', header: 'Progress', render: (j: ConversionJob) => (
      <div className="w-32">
        <div className="h-2 bg-surface-alt rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${
              j.status === 'failed' ? 'bg-danger' : j.status === 'completed' ? 'bg-green-500' : 'bg-primary'
            }`}
            style={{ width: `${j.progress}%` }}
          />
        </div>
      </div>
    )},
    { key: 'duration', header: 'Duration', render: (j: ConversionJob) => (
      <span className="text-text-secondary">{j.duration || '—'}</span>
    )},
    { key: 'actions', header: 'Actions', render: (j: ConversionJob) => (
      <div className="flex items-center gap-1">
        {j.status === 'completed' && (
          <>
            <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => addNotification('info', `Downloading ${j.fileName}...`)}>
              Download
            </Button>
            <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => openIn3DViewer(j)}>
              3D
            </Button>
            <Button variant="ghost" size="sm" icon={<Calculator size={14} />} onClick={() => runCostEstimate(j)}>
              Cost
            </Button>
          </>
        )}
        {j.status === 'failed' && j.error && (
          <span className="text-xs text-danger flex items-center gap-1">
            <AlertCircle size={12} /> {j.error}
          </span>
        )}
      </div>
    )},
  ]

  const historyColumns = [
    { key: 'fileName', header: 'File Name', render: (h: ConversionHistoryEntry) => (
      <span className="font-medium">{h.fileName}</span>
    )},
    { key: 'inputFormat', header: 'Input', render: (h: ConversionHistoryEntry) => <Badge variant="default">{h.inputFormat}</Badge> },
    { key: 'outputFormat', header: 'Output', render: (h: ConversionHistoryEntry) => <Badge variant="primary">{h.outputFormat.toUpperCase()}</Badge> },
    { key: 'status', header: 'Status', render: (h: ConversionHistoryEntry) => statusBadge(h.status) },
    { key: 'fileSize', header: 'Size' },
    { key: 'duration', header: 'Duration' },
    { key: 'createdAt', header: 'Date', render: (h: ConversionHistoryEntry) => formatDate(h.createdAt) },
  ]

  // ── Tabs definition ──────────────────────────────────────

  const tabs = [
    { id: 'convert', label: 'New Conversion', icon: <FileOutput size={16} /> },
    { id: 'history', label: 'Conversion History', icon: <Clock size={16} /> },
  ]

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">CAD/BIM Converter</h1>
        <p className="text-text-secondary mt-1">
          Convert Revit, IFC, DWG, and DGN files to Excel, 3D DAE, or PDF formats
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Files Converted" value={totalConverted} icon={FileOutput} color="primary" trend={{ value: 12, label: 'this week' }} />
        <StatCard label="Success Rate" value={`${successRate}%`} icon={CheckCircle2} color="success" />
        <StatCard label="Avg Time" value="1m 48s" icon={Clock} color="warning" />
        <StatCard label="Formats" value={formatsUsed} icon={BarChart3} color="primary" />
      </div>

      {/* Main Content */}
      <Tabs tabs={tabs} defaultTab="convert">
        {(activeTab) =>
          activeTab === 'convert' ? (
            <div className="space-y-6">
              {/* Upload + Format Selection Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* File Upload - spans 2 cols */}
                <div className="lg:col-span-2">
                  <Card title="Upload Files" subtitle="Supports batch upload of CAD/BIM files">
                    <FileUpload
                      accept=".rvt,.ifc,.dwg,.dgn"
                      multiple
                      maxSize={500 * 1024 * 1024}
                      onFilesSelected={handleFilesSelected}
                      label="Drop CAD/BIM files here or click to browse"
                      description="Supports .rvt, .ifc, .dwg, .dgn up to 500 MB each"
                    />
                  </Card>
                </div>

                {/* Format Selection */}
                <Card title="Output Format" subtitle="Select target format">
                  <div className="space-y-3">
                    {FORMAT_OPTIONS.map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => setOutputFormat(fmt.id)}
                        className={`w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left ${
                          outputFormat === fmt.id
                            ? 'border-primary bg-primary-light/50'
                            : 'border-border hover:border-primary/30 hover:bg-surface-alt'
                        }`}
                      >
                        <div className={`p-2 rounded-lg ${outputFormat === fmt.id ? 'bg-primary text-white' : 'bg-surface-alt text-text-secondary'}`}>
                          {fmt.icon}
                        </div>
                        <div>
                          <p className="font-medium text-sm text-text">{fmt.label}</p>
                          <p className="text-xs text-text-secondary">{fmt.description}</p>
                        </div>
                      </button>
                    ))}
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <Button
                      className="w-full"
                      size="lg"
                      loading={isConverting}
                      disabled={selectedFiles.length === 0}
                      onClick={startConversion}
                      icon={isConverting ? <Loader2 size={18} className="animate-spin" /> : <FileOutput size={18} />}
                    >
                      {isConverting
                        ? 'Converting...'
                        : `Convert ${selectedFiles.length > 0 ? `${selectedFiles.length} file(s)` : ''}`}
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Active Jobs */}
              {jobs.length > 0 && (
                <Card
                  title="Conversion Queue"
                  subtitle={`${jobs.filter((j) => j.status === 'converting').length} active, ${jobs.filter((j) => j.status === 'queued').length} queued`}
                  actions={
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={clearCompleted}>
                        Clear Completed
                      </Button>
                      <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => addNotification('info', 'Refreshing queue...')}>
                        Refresh
                      </Button>
                    </div>
                  }
                >
                  <Table<ConversionJob & Record<string, unknown>>
                    columns={jobColumns as any}
                    data={jobs as any}
                    keyField="id"
                    emptyMessage="No active conversions"
                  />
                </Card>
              )}

              {/* Integration Actions */}
              {jobs.some((j) => j.status === 'completed') && (
                <Card title="Quick Actions">
                  <div className="flex flex-wrap gap-3">
                    <Button
                      variant="outline"
                      icon={<Eye size={16} />}
                      onClick={() => addNotification('info', 'Opening latest result in 3D Viewer...')}
                    >
                      Open in 3D Viewer
                    </Button>
                    <Button
                      variant="outline"
                      icon={<Calculator size={16} />}
                      onClick={() => addNotification('info', 'Running cost estimate on latest result...')}
                    >
                      Run Cost Estimate
                    </Button>
                    <Button
                      variant="outline"
                      icon={<Download size={16} />}
                      onClick={() => addNotification('info', 'Downloading all completed files...')}
                    >
                      Download All
                    </Button>
                  </div>
                </Card>
              )}
            </div>
          ) : (
            /* History Tab */
            <Card
              title="Conversion History"
              subtitle={`${history.length} conversions in the last 7 days`}
              actions={
                <Button variant="outline" size="sm" icon={<Download size={14} />}>
                  Export Log
                </Button>
              }
            >
              <Table<ConversionHistoryEntry & Record<string, unknown>>
                columns={historyColumns as any}
                data={history as any}
                keyField="id"
                emptyMessage="No conversion history yet"
              />
            </Card>
          )
        }
      </Tabs>
    </div>
  )
}
