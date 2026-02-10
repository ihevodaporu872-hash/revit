import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAppStore } from '../store/appStore'

const MODULE_LABELS: Record<string, string> = {
  costEstimate: 'Оценка стоимости',
  converter: 'Конвертер',
  validation: 'Валидация',
  projectMgmt: 'Управление проектом',
  qto: 'QTO отчёт',
  general: 'n8n',
}

export function useN8nNotifications() {
  const addNotification = useAppStore((s) => s.addNotification)
  const subscribed = useRef(false)

  useEffect(() => {
    if (!supabase || subscribed.current) return

    subscribed.current = true

    const channel = supabase
      .channel('n8n-results-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'n8n_results' },
        (payload) => {
          const row = payload.new as Record<string, unknown>
          const module = String(row.module || 'general')
          const status = String(row.status || 'completed')
          const label = MODULE_LABELS[module] || module

          if (status === 'completed' || status === 'success') {
            addNotification('success', `${label}: воркфлоу завершён`)
          } else if (status === 'error' || status === 'failed') {
            const errMsg = row.error_message ? ` — ${String(row.error_message).slice(0, 100)}` : ''
            addNotification('error', `${label}: ошибка${errMsg}`)
          }
        }
      )
      .subscribe()

    return () => {
      supabase!.removeChannel(channel)
      subscribed.current = false
    }
  }, [addNotification])
}
