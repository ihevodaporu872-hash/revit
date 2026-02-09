import { useState, useRef, useCallback } from 'react'
import { Upload, X, File } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn, formatFileSize } from '../../lib/utils'
import { fadeInUp, defaultTransition } from '../../lib/animations'

interface FileUploadProps {
  accept?: string
  multiple?: boolean
  maxSize?: number
  onFilesSelected: (files: File[]) => void
  label?: string
  description?: string
  className?: string
}

export function FileUpload({
  accept,
  multiple,
  maxSize = 500 * 1024 * 1024,
  onFilesSelected,
  label,
  description,
  className,
}: FileUploadProps) {
  const [dragOver, setDragOver] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFiles = useCallback(
    (newFiles: FileList | null) => {
      if (!newFiles) return
      const arr = Array.from(newFiles).filter((f) => f.size <= maxSize)
      setFiles(arr)
      onFilesSelected(arr)
    },
    [maxSize, onFilesSelected],
  )

  const removeFile = (index: number) => {
    const updated = files.filter((_, i) => i !== index)
    setFiles(updated)
    onFilesSelected(updated)
  }

  return (
    <div className={cn('space-y-3', className)}>
      <motion.div
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className={cn(
          'border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all duration-200',
          dragOver
            ? 'border-primary bg-primary-light/50'
            : 'border-border hover:border-primary/50 hover:bg-surface-alt',
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <motion.div
          animate={{ y: dragOver ? -2 : 0 }}
          transition={defaultTransition}
        >
          <Upload size={32} className="mx-auto text-text-secondary mb-3" />
        </motion.div>
        <p className="font-medium text-text">
          {label || 'Drop files here or click to browse'}
        </p>
        <p className="text-sm text-text-secondary mt-1">
          {description || `Supports ${accept || 'all files'} up to ${formatFileSize(maxSize)}`}
        </p>
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
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={defaultTransition}
            className="space-y-2"
          >
            {files.map((file, i) => (
              <motion.div
                key={file.name + i}
                variants={fadeInUp}
                initial="hidden"
                animate="visible"
                exit="hidden"
                className="flex items-center gap-3 p-3 bg-surface-alt rounded-lg border border-border"
              >
                <File size={18} className="text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-text truncate">{file.name}</p>
                  <p className="text-xs text-text-secondary">{formatFileSize(file.size)}</p>
                </div>
                <motion.button
                  onClick={() => removeFile(i)}
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="p-1 hover:bg-surface rounded transition-colors"
                >
                  <X size={14} className="text-text-secondary" />
                </motion.button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
