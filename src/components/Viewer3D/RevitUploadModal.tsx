import { useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Building2, Upload, X, FileArchive, FileSpreadsheet, Box } from 'lucide-react'
import { Button } from '../ui/Button'
import { ConversionProgressCard } from './ConversionProgressCard'
import {
  startRevitProcessing,
  subscribeToProcessingProgress,
} from '../../services/revit-api'
import type { RevitProcessModelResponse } from '../../services/revit-api'
import type { RevitProcessingJob } from './ifc/types'
import {
  modalOverlay,
  modalContent,
  staggerContainer,
  fadeInUp,
} from '../../lib/animations'

interface Props {
  open: boolean
  onClose: () => void
  onComplete: (result: RevitProcessModelResponse) => void
  projectId: string
  modelVersion?: string
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatElapsed(ms: number): string {
  const s = Math.floor(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

export function RevitUploadModal({ open, onClose, onComplete, projectId, modelVersion }: Props) {
  const [file, setFile] = useState<File | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [job, setJob] = useState<RevitProcessingJob>({
    jobId: '',
    phase: 'uploading',
    uploadPercent: 0,
    ifcReady: false,
    xlsxReady: false,
    daeReady: false,
    elapsedMs: 0,
    result: null,
    error: null,
  })
  const [isProcessing, setIsProcessing] = useState(false)
  const cleanupRef = useRef<(() => void) | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const resetState = useCallback(() => {
    cleanupRef.current?.()
    cleanupRef.current = null
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
    setFile(null)
    setIsProcessing(false)
    setJob({
      jobId: '', phase: 'uploading', uploadPercent: 0,
      ifcReady: false, xlsxReady: false, daeReady: false,
      elapsedMs: 0, result: null, error: null,
    })
  }, [])

  const handleClose = useCallback(() => {
    if (isProcessing && job.phase !== 'complete' && job.phase !== 'error') {
      // Allow closing — conversion continues on server
    }
    resetState()
    onClose()
  }, [isProcessing, job.phase, onClose, resetState])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.name.toLowerCase().endsWith('.rvt')) {
      setFile(droppedFile)
    }
  }, [])

  const handleFileSelect = useCallback(() => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.rvt'
    input.onchange = (e) => {
      const selected = (e.target as HTMLInputElement).files?.[0]
      if (selected) setFile(selected)
    }
    input.click()
  }, [])

  const handleStart = useCallback(async () => {
    if (!file) return
    setIsProcessing(true)

    const formData = new FormData()
    formData.append('file', file)
    formData.append('projectId', projectId)
    if (modelVersion) formData.append('modelVersion', modelVersion)
    formData.append('ifcSchema', 'IFC4X3')

    setJob((prev) => ({ ...prev, phase: 'uploading', uploadPercent: 0 }))

    try {
      const { jobId } = await startRevitProcessing(formData, (percent) => {
        setJob((prev) => ({ ...prev, uploadPercent: percent }))
      })

      setJob((prev) => ({ ...prev, jobId, phase: 'converting' }))

      // Start elapsed timer
      const startMs = Date.now()
      timerRef.current = setInterval(() => {
        setJob((prev) => ({ ...prev, elapsedMs: Date.now() - startMs }))
      }, 500)

      // Subscribe to SSE
      const cleanup = subscribeToProcessingProgress(jobId, {
        onProgress(data) {
          setJob((prev) => ({
            ...prev,
            ifcReady: data.ifc,
            xlsxReady: data.xlsx,
            daeReady: data.dae,
            elapsedMs: data.elapsedMs,
          }))
        },
        onXlsxImport() {
          setJob((prev) => ({ ...prev, phase: 'importing' }))
        },
        onComplete(result) {
          if (timerRef.current) clearInterval(timerRef.current)
          setJob((prev) => ({
            ...prev,
            phase: 'complete',
            result,
            ifcReady: !!result.outputs?.ifcPath,
            xlsxReady: !!result.outputs?.xlsxPath,
            daeReady: !!result.outputs?.daePath,
          }))
        },
        onError(data) {
          if (timerRef.current) clearInterval(timerRef.current)
          setJob((prev) => ({
            ...prev,
            phase: 'error',
            error: data.message,
          }))
        },
      })
      cleanupRef.current = cleanup
    } catch (err) {
      if (timerRef.current) clearInterval(timerRef.current)
      setJob((prev) => ({
        ...prev,
        phase: 'error',
        error: err instanceof Error ? err.message : 'Unknown error',
      }))
    }
  }, [file, projectId, modelVersion])

  const handleOpenInViewer = useCallback(() => {
    if (job.result) {
      onComplete(job.result)
      resetState()
    }
  }, [job.result, onComplete, resetState])

  const cardStatus = (ready: boolean) => {
    if (job.phase === 'error') return 'error' as const
    if (ready) return 'done' as const
    if (job.phase === 'converting' || job.phase === 'importing') return 'converting' as const
    return 'waiting' as const
  }

  const overallPercent = (() => {
    if (job.phase === 'uploading') return job.uploadPercent * 0.2 // 0-20%
    if (job.phase === 'complete') return 100
    if (job.phase === 'error') return 0
    // Converting phase: 20% base + 26.67% per ready format
    const readyCount = [job.ifcReady, job.xlsxReady, job.daeReady].filter(Boolean).length
    return 20 + readyCount * 26.67
  })()

  if (!open) return null

  return (
    <AnimatePresence>
      <motion.div
        key="revit-upload-overlay"
        variants={modalOverlay}
        initial="hidden"
        animate="visible"
        exit="exit"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
        onClick={(e) => {
          if (e.target === e.currentTarget) handleClose()
        }}
      >
        <motion.div
          variants={modalContent}
          initial="hidden"
          animate="visible"
          exit="exit"
          className="bg-card border border-border rounded-2xl max-w-lg w-full mx-4 shadow-2xl"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Building2 size={20} className="text-primary" />
            </div>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-foreground">Upload Revit Model</h2>
              <p className="text-xs text-muted-foreground">Convert .rvt to IFC + Excel + DAE</p>
            </div>
            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* Body */}
          <div className="px-6 py-5 space-y-4">
            {/* Drop zone */}
            {!isProcessing && (
              <div
                onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
                onDragLeave={() => setDragOver(false)}
                onDrop={handleDrop}
                onClick={!file ? handleFileSelect : undefined}
                className={`relative border-2 border-dashed rounded-xl p-6 text-center transition-all cursor-pointer ${
                  dragOver
                    ? 'border-primary bg-primary/5'
                    : file
                      ? 'border-emerald-500/30 bg-emerald-500/5'
                      : 'border-border/50 hover:border-primary/40 hover:bg-muted/20'
                }`}
              >
                {file ? (
                  <div className="flex items-center gap-3 justify-center">
                    <FileArchive size={24} className="text-emerald-500" />
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{file.name}</p>
                      <p className="text-xs text-muted-foreground">{formatBytes(file.size)}</p>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); setFile(null) }}
                      className="p-1 rounded hover:bg-muted/50 text-muted-foreground"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Upload size={28} className="mx-auto text-muted-foreground/50 mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Drop <span className="text-foreground font-medium">.rvt</span> file here or click to browse
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Progress cards */}
            {isProcessing && (
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-3"
              >
                {/* Upload progress */}
                {job.phase === 'uploading' && (
                  <motion.div variants={fadeInUp}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs text-muted-foreground">Uploading...</span>
                      <span className="text-xs font-medium text-foreground">{job.uploadPercent}%</span>
                    </div>
                    <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-300"
                        style={{ width: `${job.uploadPercent}%` }}
                      />
                    </div>
                  </motion.div>
                )}

                {/* Conversion cards */}
                {job.phase !== 'uploading' && (
                  <>
                    <div className="grid grid-cols-3 gap-2">
                      <motion.div variants={fadeInUp}>
                        <ConversionProgressCard
                          label="IFC 4X3"
                          icon={<Box size={18} />}
                          status={cardStatus(job.ifcReady)}
                        />
                      </motion.div>
                      <motion.div variants={fadeInUp}>
                        <ConversionProgressCard
                          label="Excel"
                          icon={<FileSpreadsheet size={18} />}
                          status={cardStatus(job.xlsxReady)}
                        />
                      </motion.div>
                      <motion.div variants={fadeInUp}>
                        <ConversionProgressCard
                          label="DAE"
                          icon={<FileArchive size={18} />}
                          status={cardStatus(job.daeReady)}
                        />
                      </motion.div>
                    </div>

                    {/* Overall progress */}
                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-xs text-muted-foreground">
                          {job.phase === 'converting' && 'Converting...'}
                          {job.phase === 'importing' && 'Importing Revit data...'}
                          {job.phase === 'loading' && 'Loading model...'}
                          {job.phase === 'complete' && 'Conversion complete'}
                          {job.phase === 'error' && 'Error'}
                        </span>
                        <span className="text-xs font-medium text-muted-foreground">
                          {formatElapsed(job.elapsedMs)}
                        </span>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            job.phase === 'error' ? 'bg-destructive' : job.phase === 'complete' ? 'bg-emerald-500' : 'bg-primary'
                          }`}
                          style={{ width: `${overallPercent}%` }}
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Error message */}
                {job.phase === 'error' && job.error && (
                  <motion.div variants={fadeInUp} className="p-3 bg-destructive/5 border border-destructive/20 rounded-lg">
                    <p className="text-xs text-destructive">{job.error}</p>
                  </motion.div>
                )}
              </motion.div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border">
            <Button variant="secondary" onClick={handleClose}>
              {isProcessing && job.phase !== 'complete' && job.phase !== 'error' ? 'Close' : 'Cancel'}
            </Button>

            {!isProcessing && (
              <Button
                variant="primary"
                icon={<Upload size={16} />}
                onClick={handleStart}
                disabled={!file}
              >
                Upload & Convert
              </Button>
            )}

            {job.phase === 'complete' && (
              <Button variant="primary" onClick={handleOpenInViewer}>
                Open in Viewer
              </Button>
            )}

            {job.phase === 'error' && (
              <Button variant="primary" onClick={resetState}>
                Try Again
              </Button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
