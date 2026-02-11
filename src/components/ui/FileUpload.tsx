import { useState, useRef, useCallback } from 'react'
import {
  CloudUpload,
  X,
  File,
  CheckCircle2,
  Building2,
  Cuboid,
  PencilRuler,
  Layers3,
  type LucideIcon,
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, formatFileSize } from '../../lib/utils'
import { fadeInUp, listItem, staggerContainer, interactiveScaleSubtle } from '../../lib/animations'

interface FileUploadProps {
  accept?: string
  multiple?: boolean
  maxSize?: number
  onFilesSelected: (files: File[]) => void
  label?: string
  description?: string
  className?: string
  dropzoneClassName?: string
}

const FILE_ICONS: Record<string, string> = {
  ifc: 'text-primary',
  rvt: 'text-chart-5',
  dwg: 'text-warning',
  dxf: 'text-chart-3',
  xlsx: 'text-success',
  xls: 'text-success',
  csv: 'text-success',
  pdf: 'text-destructive',
}

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return FILE_ICONS[ext] || 'text-primary'
}

const SUPPORTED_TYPE_META: Record<string, { icon: LucideIcon; className: string; label: string }> = {
  rvt: { icon: Building2, className: 'text-sky-300 border-sky-400/35 bg-sky-500/15', label: '.rvt' },
  ifc: { icon: Cuboid, className: 'text-emerald-300 border-emerald-400/35 bg-emerald-500/15', label: 'ifc' },
  dwg: { icon: PencilRuler, className: 'text-amber-300 border-amber-400/35 bg-amber-500/15', label: '.dwg' },
  dxf: { icon: Layers3, className: 'text-violet-300 border-violet-400/35 bg-violet-500/15', label: '.dxf' },
}

function parseAcceptedExtensions(accept?: string): string[] {
  if (!accept) return []
  return accept
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.startsWith('.'))
    .map((item) => item.slice(1).toLowerCase())
}

function getTypeMeta(ext: string): { icon: LucideIcon; className: string; label: string } {
  return SUPPORTED_TYPE_META[ext] ?? {
    icon: File,
    className: 'text-primary border-primary/35 bg-primary/15',
    label: `.${ext}`,
  }
}

export function FileUpload({ accept, multiple, maxSize = 500 * 1024 * 1024, onFilesSelected, label, description, className, dropzoneClassName }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const acceptedExtensions = parseAcceptedExtensions(accept)

  const openFilePicker = useCallback(() => {
    inputRef.current?.click()
  }, [])

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles || newFiles.length === 0) return
    const arr = Array.from(newFiles).filter((f) => {
      if (f.size > maxSize) return false
      if (acceptedExtensions.length > 0) {
        const ext = f.name.split('.').pop()?.toLowerCase() || ''
        if (!acceptedExtensions.includes(ext)) return false
      }
      return true
    })
    if (arr.length > 0) {
      setFiles(arr)
      onFilesSelected(arr)
    }
  }, [maxSize, onFilesSelected, acceptedExtensions])

  const onInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files)
    // Reset so the same file can be re-selected
    e.target.value = ''
  }, [handleFiles])

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
    handleFiles(e.dataTransfer.files)
  }, [handleFiles])

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(true)
  }, [])

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setDragOver(false)
  }, [])

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index)
    setFiles(updated)
    onFilesSelected(updated)
  }

  return (
    <div className={cn('space-y-3', className)}>
      {/* Hidden file input — positioned offscreen, not display:none */}
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={onInputChange}
        tabIndex={-1}
        style={{ position: 'absolute', width: 1, height: 1, opacity: 0, overflow: 'hidden', pointerEvents: 'none' }}
      />

      <motion.div
        variants={interactiveScaleSubtle}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        animate={dragOver ? { borderColor: 'var(--primary)' } : {}}
        className={cn(
          'file-upload-dropzone cursor-pointer',
          'relative overflow-hidden rounded-2xl border-2 border-dashed p-6 text-center transition-colors',
          dragOver
            ? 'border-primary bg-primary/8'
            : 'border-border/70 bg-card/45 hover:border-primary/50 hover:bg-muted/45',
          dropzoneClassName,
        )}
        onClick={openFilePicker}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
      >
        {dragOver && (
          <motion.div
            className="pointer-events-none absolute inset-0 bg-primary/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}

        <div className="file-upload-main-icon mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full border border-border/70 bg-card/70">
          <CloudUpload size={42} className={cn('transition-colors', dragOver ? 'text-primary' : 'text-muted-foreground')} />
        </div>
        {acceptedExtensions.length > 0 && (
          <div className="file-upload-supported-list mb-5 flex flex-wrap items-center justify-center gap-2">
            {acceptedExtensions.map((ext) => {
              const meta = getTypeMeta(ext)
              const TypeIcon = meta.icon
              return (
                <span
                  key={ext}
                  className={cn(
                    'file-upload-supported-item inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-semibold tracking-wide',
                    meta.className,
                  )}
                >
                  <TypeIcon size={12} />
                  {meta.label}
                </span>
              )
            })}
          </div>
        )}
        <p className="text-[15px] font-semibold leading-tight text-foreground">
          {label || 'Перетащите файлы сюда или нажмите для загрузки'}
        </p>
        <p className="mt-2 text-xs text-muted-foreground">
          {description || `Поддерживаются ${accept || 'все файлы'} до ${formatFileSize(maxSize)}`}
        </p>
        <div className="mt-6">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); openFilePicker() }}
            className="primary-glow-btn converter-upload-cta rounded-2xl px-8 py-3 text-[15px] font-bold text-primary-foreground shadow-[var(--shadow-glow)]"
          >
            Загрузить файлы
          </button>
        </div>
      </motion.div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
            {files.map((file, i) => (
              <motion.div
                key={file.name + i}
                variants={listItem}
                exit="exit"
                className="group flex items-center gap-3 rounded-xl border border-border/70 bg-card/70 p-3"
              >
                <File size={18} className={cn('shrink-0', getFileColor(file.name))} />
                <div className="flex-1 min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <CheckCircle2 size={14} className="text-success shrink-0" />
                <button
                  onClick={(e) => { e.stopPropagation(); removeFile(i) }}
                  className="rounded p-1 opacity-0 transition-colors group-hover:opacity-100 hover:bg-card"
                >
                  <X size={14} className="text-muted-foreground" />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
