import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ShieldCheck, AlertTriangle, AlertCircle, Info } from 'lucide-react'
import { validateVOR } from '../../services/api'
import type { VORIssue } from '../../services/api'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { useAppStore } from '../../store/appStore'
import { staggerContainer, fadeInUp, listItem } from '../../lib/animations'

interface VORValidationProps {
  file: File | null
  language: string
}

const severityConfig = {
  error: { icon: AlertCircle, color: 'danger' as const, label: 'Ошибки', statColor: 'danger' as const },
  warning: { icon: AlertTriangle, color: 'warning' as const, label: 'Предупр.', statColor: 'warning' as const },
  info: { icon: Info, color: 'info' as const, label: 'Инфо', statColor: 'primary' as const },
}

export default function VORValidation({ file, language }: VORValidationProps) {
  const { addNotification } = useAppStore()
  const [isValidating, setIsValidating] = useState(false)
  const [issues, setIssues] = useState<VORIssue[]>([])
  const [summary, setSummary] = useState<{ errors: number; warnings: number; info: number } | null>(null)

  const handleValidate = async () => {
    if (!file) {
      addNotification('warning', 'Сначала загрузите Excel-файл с ВОР')
      return
    }
    setIsValidating(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      formData.append('language', language.toLowerCase())
      const result = await validateVOR(formData)
      setIssues(result.issues)
      setSummary(result.summary)
      const total = result.issues.length
      addNotification(
        total === 0 ? 'success' : 'info',
        total === 0 ? 'ВОР прошёл проверку без замечаний' : `Найдено ${total} замечаний`,
      )
    } catch (err: any) {
      addNotification('error', err.message || 'Ошибка валидации')
    } finally {
      setIsValidating(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck size={18} className="text-primary" />
          <span className="text-sm font-medium text-foreground">Проверка ВОР</span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleValidate}
          loading={isValidating}
          disabled={!file}
          icon={<ShieldCheck size={14} />}
        >
          {isValidating ? 'Проверка ИИ...' : 'Проверить ВОР'}
        </Button>
      </div>

      <AnimatePresence>
        {summary && (
          <motion.div variants={fadeInUp} initial="hidden" animate="visible" exit="exit" className="space-y-4">
            <div className="grid grid-cols-3 gap-3">
              <StatCard
                label={severityConfig.error.label}
                value={summary.errors}
                icon={AlertCircle}
                color={severityConfig.error.statColor}
              />
              <StatCard
                label={severityConfig.warning.label}
                value={summary.warnings}
                icon={AlertTriangle}
                color={severityConfig.warning.statColor}
              />
              <StatCard
                label={severityConfig.info.label}
                value={summary.info}
                icon={Info}
                color={severityConfig.info.statColor}
              />
            </div>

            {issues.length > 0 ? (
              <Card title="Замечания" subtitle={`Всего: ${issues.length}`} hover>
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-2">
                  {issues.map((issue, i) => {
                    const cfg = severityConfig[issue.type] || severityConfig.info
                    const Icon = cfg.icon
                    return (
                      <motion.div
                        key={i}
                        variants={listItem}
                        className="flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-muted/30"
                      >
                        <Icon size={16} className={`mt-0.5 shrink-0 ${
                          issue.type === 'error' ? 'text-destructive' :
                          issue.type === 'warning' ? 'text-yellow-500' : 'text-blue-400'
                        }`} />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant={cfg.color}>{issue.type}</Badge>
                            {issue.itemName && (
                              <span className="text-xs font-mono text-muted-foreground truncate">{issue.itemName}</span>
                            )}
                            {issue.rowIndex !== undefined && (
                              <span className="text-xs text-muted-foreground">строка {issue.rowIndex + 1}</span>
                            )}
                          </div>
                          <p className="text-sm text-foreground">{issue.message}</p>
                          {issue.details && (
                            <p className="text-xs text-muted-foreground mt-1">{issue.details}</p>
                          )}
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              </Card>
            ) : (
              <Card hover>
                <div className="text-center py-8">
                  <ShieldCheck size={40} className="mx-auto text-green-500 mb-2" />
                  <p className="text-foreground font-medium">Проверка пройдена</p>
                  <p className="text-xs text-muted-foreground mt-1">Замечаний не обнаружено</p>
                </div>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
