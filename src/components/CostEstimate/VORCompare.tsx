import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { GitCompare, Plus, Minus, ArrowRightLeft, Equal } from 'lucide-react'
import { compareVOR } from '../../services/api'
import type { VORComparisonResponse } from '../../services/api'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { FileUpload } from '../ui/FileUpload'
import { useAppStore } from '../../store/appStore'
import { staggerContainer, fadeInUp, listItem } from '../../lib/animations'

export default function VORCompare() {
  const { addNotification } = useAppStore()
  const [file1, setFile1] = useState<File | null>(null)
  const [file2, setFile2] = useState<File | null>(null)
  const [isComparing, setIsComparing] = useState(false)
  const [result, setResult] = useState<VORComparisonResponse | null>(null)

  const handleCompare = async () => {
    if (!file1 || !file2) {
      addNotification('warning', 'Загрузите оба Excel-файла для сравнения')
      return
    }
    setIsComparing(true)
    try {
      const formData = new FormData()
      formData.append('files', file1)
      formData.append('files', file2)
      const res = await compareVOR(formData)
      setResult(res)
      addNotification('success', `Сравнение завершено: +${res.summary.addedCount} −${res.summary.removedCount} ~${res.summary.changedCount}`)
    } catch (err: any) {
      addNotification('error', err.message || 'Ошибка сравнения')
    } finally {
      setIsComparing(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Upload area */}
      <Card title="Сравнение ВОР" subtitle="Загрузите две версии ВОР для сравнения изменений" hover>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Файл 1 (старая версия)</p>
            <FileUpload
              accept=".xlsx,.xls"
              onFilesSelected={(files) => setFile1(files[0] || null)}
              label="Перетащите первый Excel"
              description=".xlsx / .xls"
            />
            {file1 && <p className="text-xs text-muted-foreground mt-1 truncate">{file1.name}</p>}
          </div>
          <div>
            <p className="text-xs font-medium text-muted-foreground mb-2 uppercase tracking-wider">Файл 2 (новая версия)</p>
            <FileUpload
              accept=".xlsx,.xls"
              onFilesSelected={(files) => setFile2(files[0] || null)}
              label="Перетащите второй Excel"
              description=".xlsx / .xls"
            />
            {file2 && <p className="text-xs text-muted-foreground mt-1 truncate">{file2.name}</p>}
          </div>
        </div>
        <div className="mt-4 flex justify-end">
          <Button
            onClick={handleCompare}
            loading={isComparing}
            disabled={!file1 || !file2}
            icon={<GitCompare size={16} />}
          >
            {isComparing ? 'Сравнение...' : 'Сравнить ВОР'}
          </Button>
        </div>
      </Card>

      {/* Results */}
      <AnimatePresence>
        {result && (
          <motion.div variants={fadeInUp} initial="hidden" animate="visible" exit="exit" className="space-y-6">
            {/* Summary stats */}
            <motion.div
              className="grid grid-cols-2 lg:grid-cols-4 gap-3"
              variants={staggerContainer}
              initial="hidden"
              animate="visible"
            >
              <motion.div variants={fadeInUp}>
                <StatCard label="Добавлено" value={result.summary.addedCount} icon={Plus} color="success" />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <StatCard label="Удалено" value={result.summary.removedCount} icon={Minus} color="danger" />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <StatCard label="Изменено" value={result.summary.changedCount} icon={ArrowRightLeft} color="warning" />
              </motion.div>
              <motion.div variants={fadeInUp}>
                <StatCard label="Без изменений" value={result.summary.unchangedCount} icon={Equal} color="primary" />
              </motion.div>
            </motion.div>

            {/* Added items */}
            {result.added.length > 0 && (
              <Card title={`Добавленные позиции (${result.added.length})`} hover>
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-1.5">
                  {result.added.map((item, i) => (
                    <motion.div
                      key={i}
                      variants={listItem}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-green-500/20 bg-green-500/5"
                    >
                      <Plus size={14} className="text-green-500 shrink-0" />
                      <span className="flex-1 text-sm text-foreground truncate">{item.name}</span>
                      {item.unit && <Badge variant="default">{item.unit}</Badge>}
                      <span className="text-sm font-medium text-foreground tabular-nums">{item.quantity}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </Card>
            )}

            {/* Removed items */}
            {result.removed.length > 0 && (
              <Card title={`Удалённые позиции (${result.removed.length})`} hover>
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-1.5">
                  {result.removed.map((item, i) => (
                    <motion.div
                      key={i}
                      variants={listItem}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-red-500/20 bg-red-500/5"
                    >
                      <Minus size={14} className="text-red-500 shrink-0" />
                      <span className="flex-1 text-sm text-foreground truncate">{item.name}</span>
                      {item.unit && <Badge variant="default">{item.unit}</Badge>}
                      <span className="text-sm font-medium text-foreground tabular-nums">{item.quantity}</span>
                    </motion.div>
                  ))}
                </motion.div>
              </Card>
            )}

            {/* Changed items */}
            {result.changed.length > 0 && (
              <Card title={`Изменённые позиции (${result.changed.length})`} hover>
                <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-1.5">
                  {result.changed.map((item, i) => (
                    <motion.div
                      key={i}
                      variants={listItem}
                      className="flex items-center gap-3 p-2.5 rounded-lg border border-yellow-500/20 bg-yellow-500/5"
                    >
                      <ArrowRightLeft size={14} className="text-yellow-500 shrink-0" />
                      <span className="flex-1 text-sm text-foreground truncate">{item.name}</span>
                      {item.unit && <Badge variant="default">{item.unit}</Badge>}
                      <div className="flex items-center gap-2 text-sm tabular-nums">
                        <span className="text-muted-foreground">{item.oldQuantity}</span>
                        <span className="text-muted-foreground">→</span>
                        <span className="font-medium text-foreground">{item.newQuantity}</span>
                        <Badge variant={item.percentChange > 0 ? 'warning' : 'info'}>
                          {item.percentChange > 0 ? '+' : ''}{item.percentChange}%
                        </Badge>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              </Card>
            )}

            {/* Empty state */}
            {result.added.length === 0 && result.removed.length === 0 && result.changed.length === 0 && (
              <Card hover>
                <div className="text-center py-8">
                  <Equal size={40} className="mx-auto text-green-500 mb-2" />
                  <p className="text-foreground font-medium">Файлы идентичны</p>
                  <p className="text-xs text-muted-foreground mt-1">Различий в позициях не обнаружено</p>
                </div>
              </Card>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
