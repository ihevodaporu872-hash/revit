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
  Zap,
  Layers,
} from 'lucide-react'
import { fetchConversionHistory, saveConversionRecord } from '../../services/supabase-api'
import { triggerN8nWorkflow } from '../../services/api'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Tabs } from '../ui/Tabs'
import { Table } from '../ui/Table'
import { FileUpload } from '../ui/FileUpload'
import { useAppStore } from '../../store/appStore'
import { formatDate } from '../../lib/utils'
import { MotionPage } from '../MotionPage'
import N8nWorkflowStatus from '../shared/N8nWorkflowStatus'
import N8nModuleStatus from '../shared/N8nModuleStatus'
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
  { id: 'h4', fileName: 'Parking_Structure.dgn', inputFormat: 'DGN', outputFormat: 'excel', status: 'failed', createdAt: '2026-02-06T09:20:00Z', duration: '—', fileSize: '67.3 MB' },
  { id: 'h5', fileName: 'Residential_Block_A.rvt', inputFormat: 'RVT', outputFormat: 'dae', status: 'completed', createdAt: '2026-02-05T13:10:00Z', duration: '3m 05s', fileSize: '89.4 MB' },
  { id: 'h6', fileName: 'HVAC_Layout.ifc', inputFormat: 'IFC', outputFormat: 'excel', status: 'completed', createdAt: '2026-02-05T08:55:00Z', duration: '1m 18s', fileSize: '19.6 MB' },
]

const FORMAT_OPTIONS: { id: OutputFormat; label: string; description: string; icon: React.ReactNode }[] = [
  { id: 'excel', label: 'Excel (.xlsx)', description: 'Таблицы свойств, количества, расписания', icon: <FileSpreadsheet size={20} /> },
  { id: 'dae', label: 'DAE 3D (.dae)', description: '3D-геометрия для зрителей и движков', icon: <Box size={20} /> },
  { id: 'pdf', label: 'Отчёт в PDF', description: 'Отчёты о форматированных свойствах', icon: <FileText size={20} /> },
]

// ── Helpers ─────────────────────────────────────────────────────────────

function statusBadge(status: ConversionStatus) {
  const map: Record<ConversionStatus, { variant: 'success' | 'warning' | 'danger' | 'info'; label: string }> = {
    queued: { variant: 'info', label: 'В очереди' },
    converting: { variant: 'warning', label: 'Конвертация' },
    completed: { variant: 'success', label: 'Готово' },
    failed: { variant: 'danger', label: 'Ошибка' },
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

  // n8n post-processing
  const [n8nValidation, setN8nValidation] = useState(false)
  const [n8nClassify, setN8nClassify] = useState(false)
  const [n8nQto, setN8nQto] = useState(false)
  const [n8nPipelineIds, setN8nPipelineIds] = useState<Array<{ name: string; execId: string }>>([])
  const [batchMode, setBatchMode] = useState(false)

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
      addNotification('warning', 'Выберите минимум один файл для конвертации.')
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
                    duration: data.duration ? `${Math.round(data.duration / 1000)}s` : '—',
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
        } else {
          const errorMsg = data.error || data.message || `Сервер вернул статус ${response.status}`
          setJobs((prev) =>
            prev.map((j) =>
              j.id === job.id
                ? { ...j, status: 'failed', progress: 100, completedAt: new Date().toISOString(), error: errorMsg }
                : j,
            ),
          )
        }
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Сервер недоступен'
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
    addNotification('success', `Обработка завершена: ${completedCount} файл(ов).`)
  }

  const clearCompleted = () => {
    setJobs((prev) => prev.filter((j) => j.status !== 'completed' && j.status !== 'failed'))
  }

  const openIn3DViewer = (job: ConversionJob) => {
    addNotification('info', `Открываю ${job.fileName} в 3D-просмотрщике...`)
    // In real implementation: navigate to /viewer?file=job.outputUrl
  }

  const runCostEstimate = (job: ConversionJob) => {
    addNotification('info', `Запускаю смету для ${job.fileName}...`)
    // In real implementation: navigate to /cost?file=job.outputUrl
  }

  // ── Column definitions ──────────────────────────────────

  const jobColumns = [
    { key: 'fileName', header: 'Файл', render: (j: ConversionJob) => (
      <div>
        <p className="font-medium">{j.fileName}</p>
        <p className="text-xs text-muted-foreground">{j.fileSize}</p>
      </div>
    )},
    { key: 'inputFormat', header: 'Вход', render: (j: ConversionJob) => <Badge variant="default">{j.inputFormat}</Badge> },
    { key: 'outputFormat', header: 'Выход', render: (j: ConversionJob) => (
      <Badge variant="primary">{j.outputFormat.toUpperCase()}</Badge>
    )},
    { key: 'status', header: 'Статус', render: (j: ConversionJob) => (
      <div className="flex items-center gap-2">
        {statusBadge(j.status)}
        {j.status === 'converting' && <span className="text-xs text-muted-foreground">{j.progress}%</span>}
      </div>
    )},
    { key: 'progress', header: 'Прогресс', render: (j: ConversionJob) => (
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
    { key: 'duration', header: 'Время', render: (j: ConversionJob) => (
      <span className="text-muted-foreground">{j.duration || '—'}</span>
    )},
    { key: 'actions', header: 'Действия', render: (j: ConversionJob) => (
      <div className="flex items-center gap-1">
        {j.status === 'completed' && (
          <>
            <Button variant="ghost" size="sm" icon={<Download size={14} />} onClick={() => addNotification('info', `Скачивание ${j.fileName}...`)}>
              Скачать
            </Button>
            <Button variant="ghost" size="sm" icon={<Eye size={14} />} onClick={() => openIn3DViewer(j)}>
              3D
            </Button>
            <Button variant="ghost" size="sm" icon={<Calculator size={14} />} onClick={() => runCostEstimate(j)}>
              Смета
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
    { key: 'fileName', header: 'Файл', render: (h: ConversionHistoryEntry) => (
      <span className="font-medium">{h.fileName}</span>
    )},
    { key: 'inputFormat', header: 'Вход', render: (h: ConversionHistoryEntry) => <Badge variant="default">{h.inputFormat}</Badge> },
    { key: 'outputFormat', header: 'Выход', render: (h: ConversionHistoryEntry) => <Badge variant="primary">{h.outputFormat.toUpperCase()}</Badge> },
    { key: 'status', header: 'Статус', render: (h: ConversionHistoryEntry) => statusBadge(h.status) },
    { key: 'fileSize', header: 'Размер' },
    { key: 'duration', header: 'Время' },
    { key: 'createdAt', header: 'Дата', render: (h: ConversionHistoryEntry) => formatDate(h.createdAt) },
  ]

  // ── Tabs definition ──────────────────────────────────────

  const tabs = [
    { id: 'convert', label: 'Новая конверсия', icon: <FileOutput size={16} /> },
    { id: 'history', label: 'История преобразования', icon: <Clock size={16} /> },
  ]

  // ── Render ──────────────────────────────────────────────

  return (
    <MotionPage>
      <div className="space-y-6">
        {/* Header */}
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="display-heading text-[30px] font-semibold leading-tight tracking-tight text-foreground xl:text-[34px]">Преобразователь CAD/BIM</h1>
            <N8nModuleStatus module="converter" />
          </div>
          <p className="max-w-5xl text-[14px] text-muted-foreground">
            Конвертируйте файлы Revit, IFC, DWG и DGN в форматы Excel, 3D DAE или PDF
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
          <StatCard className="converter-stat-card" label="Конверсии на этой неделе" value={totalConverted} icon={FileOutput} color="primary" trend={{ value: 12, label: 'на этой неделе' }} />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard className="converter-stat-card" label="Процент успеха" value={`${successRate}%`} icon={CheckCircle2} color="success" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard className="converter-stat-card" label="Среднее время" value="1м 48с" icon={Clock} color="warning" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard className="converter-stat-card" label="Форматы" value={`${formatsUsed} типа`} icon={BarChart3} color="primary" />
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
                  <Card className="converter-upload-card" title="Загрузка файлов" subtitle="Перетащите сюда CAD/BIM-файлы или нажмите для загрузки" hover>
                    <FileUpload
                      accept=".rvt,.ifc,.dwg,.dgn"
                      multiple
                      maxSize={500 * 1024 * 1024}
                      onFilesSelected={handleFilesSelected}
                      label="Загрузите CAD/BIM-файлы здесь"
                      description="Поддержка файлов до 500 МБ"
                      dropzoneClassName="converter-upload-dropzone"
                    />
                  </Card>
                </div>

                {/* Format Selection */}
                <Card className="converter-format-card" title="Формат вывода" subtitle="Выберите целевой формат" hover>
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

                  {/* n8n Post-processing */}
                  <div className="mt-4 pt-4 border-t border-border space-y-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                      <Zap size={12} /> Пост-обработка n8n
                    </p>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                      <input type="checkbox" checked={n8nValidation} onChange={(e) => setN8nValidation(e.target.checked)} className="accent-primary" />
                      <span className="text-foreground">Валидация BIM</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                      <input type="checkbox" checked={n8nClassify} onChange={(e) => setN8nClassify(e.target.checked)} className="accent-primary" />
                      <span className="text-foreground">Авто-классификация</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                      <input type="checkbox" checked={n8nQto} onChange={(e) => setN8nQto(e.target.checked)} className="accent-primary" />
                      <span className="text-foreground">QTO-отчёт</span>
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/50 rounded px-2 py-1 transition-colors">
                      <input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)} className="accent-primary" />
                      <Layers size={14} className="text-muted-foreground" />
                      <span className="text-foreground">Батч-конвертация (n8n)</span>
                    </label>
                  </div>

                  <div className="mt-4 pt-4 border-t border-border">
                    <Button
                      className="primary-glow-btn converter-main-cta h-12 w-full rounded-2xl text-[16px] font-bold"
                      size="lg"
                      loading={isConverting}
                      disabled={selectedFiles.length === 0}
                      onClick={async () => {
                        if (batchMode && selectedFiles.length > 0) {
                          // Delegate to n8n batch converter
                          try {
                            const result = await triggerN8nWorkflow('/webhook/batch-convert', {
                              files: selectedFiles.map(f => f.name),
                              outputFormat,
                            }) as Record<string, unknown>
                            addNotification('info', 'Батч-конвертация запущена в n8n')
                            const execId = (result?.executionId || result?.id || '') as string
                            if (execId) setN8nPipelineIds(prev => [...prev, { name: 'Batch Convert', execId }])
                          } catch { addNotification('error', 'Не удалось запустить батч-конвертацию') }
                          return
                        }
                        await startConversion()
                        // After conversion, trigger selected n8n pipelines
                        const pipelines: Array<{ webhook: string; name: string }> = []
                        if (n8nValidation) pipelines.push({ webhook: '/webhook/bim-validate', name: 'BIM Validation' })
                        if (n8nClassify) pipelines.push({ webhook: '/webhook/auto-classify', name: 'Auto Classify' })
                        if (n8nQto) pipelines.push({ webhook: '/webhook/qto-report', name: 'QTO Report' })
                        for (const p of pipelines) {
                          try {
                            const result = await triggerN8nWorkflow(p.webhook, {
                              fileName: selectedFiles[0]?.name,
                              outputFormat,
                            }) as Record<string, unknown>
                            const execId = (result?.executionId || result?.id || '') as string
                            if (execId) setN8nPipelineIds(prev => [...prev, { name: p.name, execId }])
                          } catch { addNotification('warning', `Не удалось запустить ${p.name}`) }
                        }
                      }}
                      icon={isConverting ? <Loader2 size={18} className="animate-spin" /> : <FileOutput size={18} />}
                    >
                      {isConverting
                        ? 'Конвертация...'
                        : batchMode ? 'Батч-конвертация (n8n)' : 'Конвертировать'}
                    </Button>
                  </div>

                  {/* n8n Pipeline Status */}
                  {n8nPipelineIds.length > 0 && (
                    <div className="mt-3 space-y-2">
                      {n8nPipelineIds.map((p, i) => (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">{p.name}:</span>
                          <N8nWorkflowStatus
                            executionId={p.execId}
                            onComplete={(status) => addNotification(status === 'success' ? 'success' : 'error', `${p.name}: ${status}`)}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>

              {/* Active Jobs */}
              {jobs.length > 0 && (
                <Card
                  title="Очередь конвертации"
                  subtitle={`${jobs.filter((j) => j.status === 'converting').length} активных, ${jobs.filter((j) => j.status === 'queued').length} в очереди`}
                  hover
                  actions={
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="sm" icon={<Trash2 size={14} />} onClick={clearCompleted}>
                        Очистить завершённые
                      </Button>
                      <Button variant="ghost" size="sm" icon={<RefreshCw size={14} />} onClick={() => addNotification('info', 'Обновляю очередь...')}>
                        Обновить
                      </Button>
                    </div>
                  }
                >
                  <Table<ConversionJob & Record<string, unknown>>
                    columns={jobColumns as any}
                    data={jobs as any}
                    keyField="id"
                    emptyMessage="Нет активных конвертаций"
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
                          onClick={() => addNotification('info', 'Открываю последний результат в 3D...')}
                        >
                          Открыть в 3D
                        </Button>
                        <Button
                          variant="outline"
                          icon={<Calculator size={16} />}
                          onClick={() => addNotification('info', 'Запуск сметы по последнему результату...')}
                        >
                          Запустить смету
                        </Button>
                        <Button
                          variant="outline"
                          icon={<Download size={16} />}
                          onClick={() => addNotification('info', 'Скачиваю все готовые файлы...')}
                        >
                          Скачать всё
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
              title="История преобразования"
              subtitle={`${history.length} конвертаций за 7 дней`}
              hover
              actions={
                <Button variant="outline" size="sm" icon={<Download size={14} />}>
                  Экспорт лога
                </Button>
              }
            >
              <Table<ConversionHistoryEntry & Record<string, unknown>>
                columns={historyColumns as any}
                data={history as any}
                keyField="id"
                emptyMessage="История пока пуста"
              />
            </Card>
          )
        }
      </Tabs>
      </div>
    </MotionPage>
  )
}
