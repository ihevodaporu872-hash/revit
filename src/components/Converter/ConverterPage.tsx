import { useState, useCallback, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  Layers,
  ShieldCheck,
  Sparkles,
  ClipboardList,
} from 'lucide-react'
import { fetchConversionHistory, saveConversionRecord } from '../../services/supabase-api'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Tabs } from '../ui/Tabs'
import { Table } from '../ui/Table'
import { FileUpload } from '../ui/FileUpload'
import { useAppStore } from '../../store/appStore'
import { formatDate } from '../../lib/utils'
import { MotionPage } from '../MotionPage'
import './ConverterPage.css'
import {
  staggerContainer,
  fadeInUp,
  scaleIn,
  cardHover,
  listItem,
  modalOverlay,
  modalContent,
  interactiveScale,
} from '../../lib/animations'

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
  { id: 'h4', fileName: 'Parking_Structure.dgn', inputFormat: 'DGN', outputFormat: 'excel', status: 'failed', createdAt: '2026-02-06T09:20:00Z', duration: '\u2014', fileSize: '67.3 MB' },
  { id: 'h5', fileName: 'Residential_Block_A.rvt', inputFormat: 'RVT', outputFormat: 'dae', status: 'completed', createdAt: '2026-02-05T13:10:00Z', duration: '3m 05s', fileSize: '89.4 MB' },
  { id: 'h6', fileName: 'HVAC_Layout.ifc', inputFormat: 'IFC', outputFormat: 'excel', status: 'completed', createdAt: '2026-02-05T08:55:00Z', duration: '1m 18s', fileSize: '19.6 MB' },
]

const FORMAT_OPTIONS: { id: OutputFormat; label: string; description: string; icon: React.ReactNode }[] = [
  { id: 'excel', label: 'Excel (.xlsx)', description: '\u0422\u0430\u0431\u043B\u0438\u0446\u044B \u0441\u0432\u043E\u0439\u0441\u0442\u0432, \u043A\u043E\u043B\u0438\u0447\u0435\u0441\u0442\u0432\u0430, \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044F', icon: <FileSpreadsheet size={20} /> },
  { id: 'dae', label: 'DAE 3D (.dae)', description: '3D-\u0433\u0435\u043E\u043C\u0435\u0442\u0440\u0438\u044F \u0434\u043B\u044F \u0437\u0440\u0438\u0442\u0435\u043B\u0435\u0439 \u0438 \u0434\u0432\u0438\u0436\u043A\u043E\u0432', icon: <Box size={20} /> },
  { id: 'pdf', label: '\u041E\u0442\u0447\u0451\u0442 \u0432 PDF', description: '\u041E\u0442\u0447\u0451\u0442\u044B \u043E \u0444\u043E\u0440\u043C\u0430\u0442\u0438\u0440\u043E\u0432\u0430\u043D\u043D\u044B\u0445 \u0441\u0432\u043E\u0439\u0441\u0442\u0432\u0430\u0445', icon: <FileText size={20} /> },
]

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api'

// ── Helpers ─────────────────────────────────────────────────────────────

function statusBadge(status: ConversionStatus) {
  const map: Record<ConversionStatus, { variant: 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
    queued: { variant: 'info', label: '\u0412 \u043E\u0447\u0435\u0440\u0435\u0434\u0438' },
    converting: { variant: 'warning', label: '\u041A\u043E\u043D\u0432\u0435\u0440\u0442\u0430\u0446\u0438\u044F' },
    completed: { variant: 'success', label: '\u0413\u043E\u0442\u043E\u0432\u043E' },
    failed: { variant: 'danger', label: '\u041E\u0448\u0438\u0431\u043A\u0430' },
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
  const [history, setHistory] = useState<ConversionHistoryEntry[]>(MOCK_HISTORY)

  // Native post-processing options
  const [postValidate, setPostValidate] = useState(false)
  const [postClassify, setPostClassify] = useState(false)
  const [postQto, setPostQto] = useState(false)

  useEffect(() => {
    fetchConversionHistory()
      .then((rows) => { if (rows.length > 0) setHistory(rows as ConversionHistoryEntry[]) })
      .catch(() => {})
  }, [])

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
      addNotification('warning', '\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u043C\u0438\u043D\u0438\u043C\u0443\u043C \u043E\u0434\u0438\u043D \u0444\u0430\u0439\u043B \u0434\u043B\u044F \u043A\u043E\u043D\u0432\u0435\u0440\u0442\u0430\u0446\u0438\u0438.')
      return
    }

    setIsConverting(true)

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

    for (const [idx, job] of newJobs.entries()) {
      const file = selectedFiles[idx]

      setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, status: 'converting' as ConversionStatus, progress: 10 } : j))

      const formData = new FormData()
      formData.append('file', file)
      formData.append('outputFormat', outputFormat)

      try {
        setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, progress: 30 } : j))

        const response = await fetch('/api/converter/convert', {
          method: 'POST',
          body: formData,
        })

        setJobs((prev) => prev.map((j) => j.id === job.id ? { ...j, progress: 80 } : j))

        const data = await response.json()

        if (response.ok && data.status === 'completed') {
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? {
                    ...j,
                    status: 'completed',
                    progress: 100,
                    completedAt: data.completedAt || new Date().toISOString(),
                    duration: data.duration ? `${Math.round(data.duration / 1000)}s` : '\u2014',
                    outputUrl: data.outputDir || undefined,
                  }
                : j,
            ),
          )

          saveConversionRecord({
            fileName: job.fileName,
            inputFormat: job.inputFormat,
            outputFormat: job.outputFormat,
            status: 'completed',
            fileSize: job.fileSize,
            duration: data.duration ? `${Math.round(data.duration / 1000)}s` : '',
          }).catch(() => {})

          // Run native post-processing
          if (postValidate) {
            fetch(`${API_BASE}/cad/validate`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ elements: data.elements || [], rules: null }),
            }).then(() => addNotification('success', `\u0412\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u044F BIM: ${job.fileName}`)).catch(() => {})
          }
          if (postClassify) {
            fetch(`${API_BASE}/cad/classify`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ elements: data.elements || [] }),
            }).then(() => addNotification('success', `\u041A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F: ${job.fileName}`)).catch(() => {})
          }
          if (postQto) {
            fetch(`${API_BASE}/cad/qto-report`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ elements: data.elements || [], projectName: job.fileName }),
            }).then(() => addNotification('success', `QTO-\u043E\u0442\u0447\u0451\u0442: ${job.fileName}`)).catch(() => {})
          }
        } else {
          const errorMsg = data.error || data.message || `\u0421\u0435\u0440\u0432\u0435\u0440 \u0432\u0435\u0440\u043D\u0443\u043B \u0441\u0442\u0430\u0442\u0443\u0441 ${response.status}`
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? { ...j, status: 'failed', progress: 100, completedAt: new Date().toISOString(), error: errorMsg }
                : j,
            ),
          )
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : '\u0421\u0435\u0440\u0432\u0435\u0440 \u043D\u0435\u0434\u043E\u0441\u0442\u0443\u043F\u0435\u043D'
        setJobs((prev) =>
          prev.map((j) =>
            j.id === job.id
              ? { ...j, status: 'failed', progress: 100, completedAt: new Date().toISOString(), error: errorMsg }
              : j,
          ),
        )
      }
    }

    setIsConverting(false)

    const completedCount = newJobs.length
    addNotification('success', `\u041E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430 \u0437\u0430\u0432\u0435\u0440\u0448\u0435\u043D\u0430: ${completedCount} \u0444\u0430\u0439\u043B(\u043E\u0432).`)
  }

  const clearCompleted = () => {
    setJobs((prev) => prev.filter((j) => j.status !== 'completed' && j.status !== 'failed'))
  }

  const openIn3DViewer = (job: ConversionJob) => {
    addNotification('info', `\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u044E ${job.fileName} \u0432 3D-\u043F\u0440\u043E\u0441\u043C\u043E\u0442\u0440\u0449\u0438\u043A\u0435...`)
  }

  const runCostEstimate = (job: ConversionJob) => {
    addNotification('info', `\u0417\u0430\u043F\u0443\u0441\u043A\u0430\u044E \u0441\u043C\u0435\u0442\u0443 \u0434\u043B\u044F ${job.fileName}...`)
  }

  // ── Column definitions ──────────────────────────────────

  const jobColumns = [
    { key: 'fileName', header: '\u0424\u0430\u0439\u043B', render: (j: ConversionJob) => (
      <div>
        <p className="font-medium">{j.fileName}</p>
        <p className="text-xs text-muted-foreground">{j.fileSize}</p>
      </div>
    )},
    { key: 'inputFormat', header: '\u0412\u0445\u043E\u0434', render: (j: ConversionJob) => <Badge variant="default">{j.inputFormat}</Badge> },
    { key: 'outputFormat', header: '\u0412\u044B\u0445\u043E\u0434', render: (j: ConversionJob) => (
      <Badge variant="primary">{j.outputFormat.toUpperCase()}</Badge>
    )},
    { key: 'status', header: '\u0421\u0442\u0430\u0442\u0443\u0441', render: (j: ConversionJob) => (
      <div className="flex items-center gap-2">
        {statusBadge(j.status)}
        {j.status === 'converting' && <span className="text-xs text-muted-foreground">{j.progress}%</span>}
      </div>
    )},
    { key: 'progress', header: '\u041F\u0440\u043E\u0433\u0440\u0435\u0441\u0441', render: (j: ConversionJob) => (
      <div className="w-32">
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <motion.div
            className={`h-full rounded-full ${
              j.status === 'failed' ? 'bg-destructive' : j.status === 'completed' ? 'bg-success' : 'bg-primary'
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${j.progress}%` }}
            transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
          />
        </div>
      </div>
    )},
    { key: 'duration', header: '\u0412\u0440\u0435\u043C\u044F', render: (j: ConversionJob) => (
      <span className="text-muted-foreground">{j.duration || '\u2014'}</span>
    )},
    { key: 'actions', header: '\u0414\u0435\u0439\u0441\u0442\u0432\u0438\u044F', render: (j: ConversionJob) => (
      <div className="flex items-center gap-1">
        {j.status === 'completed' && (
          <>
            <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => addNotification('info', `\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u043D\u0438\u0435 ${j.fileName}...`)}>
              \u0421\u043A\u0430\u0447\u0430\u0442\u044C
            </Button>
            <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => openIn3DViewer(j)}>
              3D
            </Button>
            <Button variant="ghost" size="sm" icon={<Calculator size={14} />} onClick={() => runCostEstimate(j)}>
              \u0421\u043C\u0435\u0442\u0430
            </Button>
          </>
        )}
        {j.status === 'failed' && j.error && (
          <span className="text-xs text-destructive flex items-center gap-1">
            <AlertCircle size={12} /> {j.error}
          </span>
        )}
      </div>
    )},
  ]

  const historyColumns = [
    { key: 'fileName', header: '\u0424\u0430\u0439\u043B', render: (h: ConversionHistoryEntry) => (
      <span className="font-medium">{h.fileName}</span>
    )},
    { key: 'inputFormat', header: '\u0412\u0445\u043E\u0434', render: (h: ConversionHistoryEntry) => <Badge variant="default">{h.inputFormat}</Badge> },
    { key: 'outputFormat', header: '\u0412\u044B\u0445\u043E\u0434', render: (h: ConversionHistoryEntry) => <Badge variant="primary">{h.outputFormat.toUpperCase()}</Badge> },
    { key: 'status', header: '\u0421\u0442\u0430\u0442\u0443\u0441', render: (h: ConversionHistoryEntry) => statusBadge(h.status) },
    { key: 'fileSize', header: '\u0420\u0430\u0437\u043C\u0435\u0440' },
    { key: 'duration', header: '\u0412\u0440\u0435\u043C\u044F' },
    { key: 'createdAt', header: '\u0414\u0430\u0442\u0430', render: (h: ConversionHistoryEntry) => formatDate(h.createdAt) },
  ]

  // ── Tabs definition ──────────────────────────────────────

  const tabs = [
    { id: 'convert', label: '\u041D\u043E\u0432\u0430\u044F \u043A\u043E\u043D\u0432\u0435\u0440\u0441\u0438\u044F', icon: <FileOutput size={16} /> },
    { id: 'history', label: '\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u0440\u0435\u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u043D\u0438\u044F', icon: <Clock size={16} /> },
  ]

  // ── Render ──────────────────────────────────────────────

  return (
    <MotionPage>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="display-heading text-[30px] font-semibold leading-tight tracking-tight text-foreground xl:text-[34px]">\u041F\u0440\u0435\u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u0442\u0435\u043B\u044C CAD/BIM</h1>
          </div>
          <p className="max-w-5xl text-[14px] text-muted-foreground">
            \u041A\u043E\u043D\u0432\u0435\u0440\u0442\u0438\u0440\u0443\u0439\u0442\u0435 \u0444\u0430\u0439\u043B\u044B Revit, IFC, DWG \u0438 DGN \u0432 \u0444\u043E\u0440\u043C\u0430\u0442\u044B Excel, 3D DAE \u0438\u043B\u0438 PDF
          </p>
        </div>

      {/* Stats Row */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeInUp}>
          <StatCard className="converter-stat-card" label="\u041A\u043E\u043D\u0432\u0435\u0440\u0441\u0438\u0438 \u043D\u0430 \u044D\u0442\u043E\u0439 \u043D\u0435\u0434\u0435\u043B\u0435" value={totalConverted} icon={FileOutput} color="primary" trend={{ value: 12, label: '\u043D\u0430 \u044D\u0442\u043E\u0439 \u043D\u0435\u0434\u0435\u043B\u0435' }} />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard className="converter-stat-card" label="\u041F\u0440\u043E\u0446\u0435\u043D\u0442 \u0443\u0441\u043F\u0435\u0445\u0430" value={`${successRate}%`} icon={CheckCircle2} color="success" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard className="converter-stat-card" label="\u0421\u0440\u0435\u0434\u043D\u0435\u0435 \u0432\u0440\u0435\u043C\u044F" value="1\u043C 48\u0441" icon={Clock} color="warning" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard className="converter-stat-card" label="\u0424\u043E\u0440\u043C\u0430\u0442\u044B" value={`${formatsUsed} \u0442\u0438\u043F\u0430`} icon={BarChart3} color="primary" />
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <Tabs tabs={tabs} defaultTab="convert">
        {(activeTab) =>
          activeTab === 'convert' ? (
            <div className="space-y-6">
              {/* Upload + Format Selection Row */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* File Upload - spans 2 cols */}
                <div className="lg:col-span-2">
                  <Card className="converter-upload-card" title="\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432" subtitle="\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 \u0441\u044E\u0434\u0430 CAD/BIM-\u0444\u0430\u0439\u043B\u044B \u0438\u043B\u0438 \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u0434\u043B\u044F \u0437\u0430\u0433\u0440\u0443\u0437\u043A\u0438" hover>
                    <FileUpload
                      accept=".rvt,.ifc,.dwg,.dgn"
                      multiple
                      maxSize={500 * 1024 * 1024}
                      onFilesSelected={handleFilesSelected}
                      label="\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 CAD/BIM-\u0444\u0430\u0439\u043B\u044B \u0437\u0434\u0435\u0441\u044C"
                      description="\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 \u0444\u0430\u0439\u043B\u043E\u0432 \u0434\u043E 500 \u041C\u0411"
                      dropzoneClassName="converter-upload-dropzone"
                    />
                  </Card>
                </div>

                {/* Format Selection */}
                <Card className="converter-format-card" title="\u0424\u043E\u0440\u043C\u0430\u0442 \u0432\u044B\u0432\u043E\u0434\u0430" subtitle="\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0446\u0435\u043B\u0435\u0432\u043E\u0439 \u0444\u043E\u0440\u043C\u0430\u0442" hover>
                  <div className="space-y-3">
                    {FORMAT_OPTIONS.map((fmt) => (
                      <motion.button
                        key={fmt.id}
                        onClick={() => setOutputFormat(fmt.id)}
                        variants={interactiveScale}
                        initial="rest"
                        whileHover="hover"
                        whileTap="tap"
                        className={`converter-format-option ${outputFormat === fmt.id ? 'is-active' : ''}`}
                      >
                        <div className={`converter-format-option-icon ${outputFormat === fmt.id ? 'is-active' : ''}`}>
                          {fmt.icon}
                        </div>
                        <div>
                          <p className="text-[15px] font-semibold leading-tight text-foreground">{fmt.label}</p>
                          <p className="mt-0.5 text-xs text-muted-foreground">{fmt.description}</p>
                        </div>
                      </motion.button>
                    ))}
                  </div>

                  {/* Native Post-processing */}
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Sparkles size={12} /> \u041F\u043E\u0441\u0442-\u043E\u0431\u0440\u0430\u0431\u043E\u0442\u043A\u0430
                    </p>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                      <input type="checkbox" checked={postValidate} onChange={(e) => setPostValidate(e.target.checked)} className="accent-primary" />
                      <ShieldCheck size={14} className="text-muted-foreground" />
                      <span className="text-foreground">\u0412\u0430\u043B\u0438\u0434\u0430\u0446\u0438\u044F BIM</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                      <input type="checkbox" checked={postClassify} onChange={(e) => setPostClassify(e.target.checked)} className="accent-primary" />
                      <Sparkles size={14} className="text-muted-foreground" />
                      <span className="text-foreground">\u0410\u0432\u0442\u043E-\u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                      <input type="checkbox" checked={postQto} onChange={(e) => setPostQto(e.target.checked)} className="accent-primary" />
                      <ClipboardList size={14} className="text-muted-foreground" />
                      <span className="text-foreground">QTO-\u043E\u0442\u0447\u0451\u0442</span>
                    </label>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <Button
                      className="primary-glow-btn converter-main-cta h-12 w-full rounded-2xl text-[16px] font-bold"
                      size="lg"
                      loading={isConverting}
                      disabled={selectedFiles.length === 0}
                      onClick={startConversion}
                      icon={isConverting ? <Loader2 size={18} className="animate-spin" /> : <FileOutput size={18} />}
                    >
                      {isConverting ? '\u041A\u043E\u043D\u0432\u0435\u0440\u0442\u0430\u0446\u0438\u044F...' : '\u041A\u043E\u043D\u0432\u0435\u0440\u0442\u0438\u0440\u043E\u0432\u0430\u0442\u044C'}
                    </Button>
                  </div>
                </Card>
              </div>

              {/* Active Jobs */}
              {jobs.length > 0 && (
                <Card
                  title="\u041E\u0447\u0435\u0440\u0435\u0434\u044C \u043A\u043E\u043D\u0432\u0435\u0440\u0442\u0430\u0446\u0438\u0438"
                  subtitle={`${jobs.filter((j) => j.status === 'converting').length} \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445, ${jobs.filter((j) => j.status === 'queued').length} \u0432 \u043E\u0447\u0435\u0440\u0435\u0434\u0438`}
                  hover
                  actions={
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={clearCompleted}>
                        \u041E\u0447\u0438\u0441\u0442\u0438\u0442\u044C \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D\u043D\u044B\u0435
                      </Button>
                      <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => addNotification('info', '\u041E\u0431\u043D\u043E\u0432\u043B\u044F\u044E \u043E\u0447\u0435\u0440\u0435\u0434\u044C...')}>
                        \u041E\u0431\u043D\u043E\u0432\u0438\u0442\u044C
                      </Button>
                    </div>
                  }
                >
                  <Table<ConversionJob & Record<string, unknown>>
                    columns={jobColumns as any}
                    data={jobs as any}
                    keyField="id"
                    emptyMessage="\u041D\u0435\u0442 \u0430\u043A\u0442\u0438\u0432\u043D\u044B\u0445 \u043A\u043E\u043D\u0432\u0435\u0440\u0442\u0430\u0446\u0438\u0439"
                  />
                </Card>
              )}

              {/* Integration Actions */}
              <AnimatePresence>
                {jobs.some((j) => j.status === 'completed') && (
                  <motion.div
                    variants={fadeInUp}
                    initial="hidden"
                    animate="visible"
                    exit="hidden"
                  >
                    <Card title="Quick Actions" hover>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          variant="outline"
                          icon={<Eye size={16} />}
                          onClick={() => addNotification('info', '\u041E\u0442\u043A\u0440\u044B\u0432\u0430\u044E \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0439 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442 \u0432 3D...')}
                        >
                          \u041E\u0442\u043A\u0440\u044B\u0442\u044C \u0432 3D
                        </Button>
                        <Button
                          variant="outline"
                          icon={<Calculator size={16} />}
                          onClick={() => addNotification('info', '\u0417\u0430\u043F\u0443\u0441\u043A \u0441\u043C\u0435\u0442\u044B \u043F\u043E \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0435\u043C\u0443 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u0443...')}
                        >
                          \u0417\u0430\u043F\u0443\u0441\u0442\u0438\u0442\u044C \u0441\u043C\u0435\u0442\u0443
                        </Button>
                        <Button
                          variant="outline"
                          icon={<Download size={16} />}
                          onClick={() => addNotification('info', '\u0421\u043A\u0430\u0447\u0438\u0432\u0430\u044E \u0432\u0441\u0435 \u0433\u043E\u0442\u043E\u0432\u044B\u0435 \u0444\u0430\u0439\u043B\u044B...')}
                        >
                          \u0421\u043A\u0430\u0447\u0430\u0442\u044C \u0432\u0441\u0451
                        </Button>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ) : (
            /* History Tab */
            <Card
              title="\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u0440\u0435\u043E\u0431\u0440\u0430\u0437\u043E\u0432\u0430\u043D\u0438\u044F"
              subtitle={`${history.length} \u043A\u043E\u043D\u0432\u0435\u0440\u0442\u0430\u0446\u0438\u0439 \u0437\u0430 7 \u0434\u043D\u0435\u0439`}
              hover
              actions={
                <Button variant="outline" size="sm" icon={<Download size={14} />}>
                  \u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u043B\u043E\u0433\u0430
                </Button>
              }
            >
              <Table<ConversionHistoryEntry & Record<string, unknown>>
                columns={historyColumns as any}
                data={history as any}
                keyField="id"
                emptyMessage="\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u0430"
              />
            </Card>
          )
        }
      </Tabs>
      </div>
    </MotionPage>
  )
}
