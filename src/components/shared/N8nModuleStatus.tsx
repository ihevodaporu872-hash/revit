import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'
import { fetchN8nResults } from '../../services/supabase-api'

interface N8nModuleStatusProps {
  module: 'costEstimate' | 'converter' | 'validation' | 'projectMgmt' | 'qto'
}

export default function N8nModuleStatus({ module }: N8nModuleStatusProps) {
  const [todayCount, setTodayCount] = useState(0)
  const [errorCount, setErrorCount] = useState(0)

  useEffect(() => {
    fetchN8nResults(module, 100)
      .then((results) => {
        const today = new Date().toISOString().split('T')[0]
        const todayResults = results.filter(
          (r) => r.createdAt && r.createdAt.startsWith(today)
        )
        setTodayCount(todayResults.length)
        setErrorCount(todayResults.filter((r) => r.status === 'error' || r.status === 'failed').length)
      })
      .catch(() => {})
  }, [module])

  if (todayCount === 0) return null

  return (
    <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-muted border border-border text-xs">
      <Zap size={10} className="text-primary" />
      <span className="text-muted-foreground">
        n8n: {todayCount} сегодня
      </span>
      {errorCount > 0 && (
        <span className="text-destructive font-medium">, {errorCount} ошибк{errorCount === 1 ? 'а' : errorCount < 5 ? 'и' : ''}</span>
      )}
    </div>
  )
}
