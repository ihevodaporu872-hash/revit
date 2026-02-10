import { useState, useEffect, useRef } from 'react'
import { CheckCircle2, XCircle, Loader2 } from 'lucide-react'
import { getN8nExecutionStatus } from '../../services/api'

interface N8nWorkflowStatusProps {
  executionId: string | null
  onComplete?: (status: string) => void
}

export default function N8nWorkflowStatus({ executionId, onComplete }: N8nWorkflowStatusProps) {
  const [status, setStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')
  const [error, setError] = useState<string | null>(null)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    if (!executionId) {
      setStatus('idle')
      return
    }

    setStatus('running')
    setError(null)

    const poll = async () => {
      try {
        const exec = await getN8nExecutionStatus(executionId)
        const s = exec?.status || 'running'
        if (s === 'success' || s === 'finished') {
          setStatus('success')
          onComplete?.('success')
          if (intervalRef.current) clearInterval(intervalRef.current)
        } else if (s === 'error' || s === 'failed' || s === 'crashed') {
          setStatus('error')
          setError(String((exec as unknown as Record<string, unknown>)?.errorMessage || 'Workflow failed'))
          onComplete?.('error')
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      } catch {
        // Keep polling on transient errors
      }
    }

    poll()
    intervalRef.current = setInterval(poll, 3000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [executionId, onComplete])

  if (status === 'idle' || !executionId) return null

  return (
    <div className="inline-flex items-center gap-2 text-sm">
      {status === 'running' && (
        <>
          <Loader2 size={16} className="animate-spin text-primary" />
          <span className="text-muted-foreground">Выполняется...</span>
        </>
      )}
      {status === 'success' && (
        <>
          <CheckCircle2 size={16} className="text-green-500" />
          <span className="text-green-500">Завершено</span>
        </>
      )}
      {status === 'error' && (
        <>
          <XCircle size={16} className="text-destructive" />
          <span className="text-destructive">{error || 'Ошибка'}</span>
        </>
      )}
    </div>
  )
}
