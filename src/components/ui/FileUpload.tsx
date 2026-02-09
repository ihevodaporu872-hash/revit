import { useState, useRef, useCallback } from 'react'
import { Upload, X, File, CheckCircle2 } from 'lucide-react'
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
}

const FILE_ICONS: Record<string, string> = {
  ifc: 'text-primary',
  rvt: 'text-chart-5',
  dwg: 'text-warning',
  dgn: 'text-chart-3',
  xlsx: 'text-success',
  xls: 'text-success',
  csv: 'text-success',
  pdf: 'text-destructive',
}

function getFileColor(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() || ''
  return FILE_ICONS[ext] || 'text-primary'
}

export function FileUpload({ accept, multiple, maxSize = 500 * 1024 * 1024, onFilesSelected, label, description, className }: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback((newFiles: FileList | null) => {
    if (!newFiles) return
    const arr = Array.from(newFiles).filter((f) => f.size <= maxSize)
    setFiles(arr)
    onFilesSelected(arr)
  }, [maxSize, onFilesSelected])

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index)
    setFiles(updated)
    onFilesSelected(updated)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <motion.div
        variants={interactiveScaleSubtle}
        initial="rest"
        whileHover="hover"
        whileTap="tap"
        animate={dragOver ? { borderColor: 'var(--primary)' } : {}}
        className={cn(
          'border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors relative overflow-hidden',
          dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/50',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files) }}
      >
        {dragOver && (
          <motion.div
            className="absolute inset-0 bg-primary/5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />
        )}
        <Upload size={32} className={cn('mx-auto mb-3 transition-colors', dragOver ? 'text-primary' : 'text-muted-foreground')} />
        <p className="font-medium text-foreground">{label || 'Drop files here or click to browse'}</p>
        <p className="text-sm text-muted-foreground mt-1">{description || `Supports ${accept || 'all files'} up to ${formatFileSize(maxSize)}`}</p>
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          onChange={(e) => handleFiles(e.target.files)}
          className="hidden"
        />
      </motion.div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
            {files.map((file, i) => (
              <motion.div
                key={file.name + i}
                variants={listItem}
                exit="exit"
                className="flex items-center gap-3 p-3 bg-muted rounded-lg border border-border group"
              >
                <File size={18} className={cn('shrink-0', getFileColor(file.name))} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{file.name}</p>
                  <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                </div>
                <CheckCircle2 size={14} className="text-success shrink-0" />
                <button onClick={(e) => { e.stopPropagation(); removeFile(i) }} className="p-1 hover:bg-card rounded transition-colors opacity-0 group-hover:opacity-100">
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
