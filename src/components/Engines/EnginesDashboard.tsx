import { useState, useEffect, useCallback } from 'react'
import { motion } from 'framer-motion'
import {
  Cog, Bot, Send, RefreshCw, CheckCircle2, XCircle,
  AlertTriangle, Cpu, Database, Sheet, Zap, Server,
  Package,
} from 'lucide-react'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Tabs } from '../ui/Tabs'
import { MotionPage } from '../MotionPage'
import { staggerContainer, fadeInUp, listItem } from '../../lib/animations'
import { getEnginesStatus, sendTelegramTest, type EnginesStatusResponse } from '../../services/api'

const BOT_COMMANDS = [
  { command: '/start', description: 'Начать работу с ботом' },
  { command: '/help', description: 'Справка по командам' },
  { command: '/status', description: 'Статус платформы Jens' },
  { command: '/cost', description: 'Новая смета стоимости' },
  { command: '/task', description: 'Создать задачу в проекте' },
  { command: '/report', description: 'Полевой отчёт с фото' },
]

export default function EnginesDashboard() {
  const [data, setData] = useState<EnginesStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [testMessage, setTestMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sendResult, setSendResult] = useState<{ ok: boolean; text: string } | null>(null)

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const result = await getEnginesStatus()
      setData(result)
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  const handleSendTest = async () => {
    if (!testMessage.trim()) return
    setSending(true)
    setSendResult(null)
    try {
      await sendTelegramTest(testMessage)
      setSendResult({ ok: true, text: 'Сообщение отправлено' })
      setTestMessage('')
    } catch {
      setSendResult({ ok: false, text: 'Ошибка отправки' })
    } finally {
      setSending(false)
    }
  }

  const engines = data?.engines
  const activeEnginesCount = engines
    ? Object.values(engines).filter((e) => e.status === 'online').length
    : 0

  const tabs = [
    { id: 'engines', label: 'Движки', icon: <Cpu size={16} /> },
    { id: 'telegram', label: 'Telegram Бот', icon: <Bot size={16} /> },
  ]

  function statusBadge(status: string) {
    if (status === 'online') return <Badge variant="success">Онлайн</Badge>
    if (status === 'degraded') return <Badge variant="warning">Деградация</Badge>
    return <Badge variant="danger">Офлайн</Badge>
  }

  return (
    <MotionPage className="space-y-6 p-6 mx-auto max-w-7xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Автоматизация</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Нативные движки и Telegram-бот
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<RefreshCw size={14} />}
          onClick={refresh}
          loading={loading}
        >
          Обновить
        </Button>
      </div>

      {/* Stats */}
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <StatCard
          label="Платформа"
          value={data?.status === 'ok' ? 'Онлайн' : data ? 'Деградация' : 'Офлайн'}
          icon={Server}
          color={data?.status === 'ok' ? 'success' : data ? 'warning' : 'danger'}
        />
        <StatCard
          label="Активные движки"
          value={`${activeEnginesCount} / 4`}
          icon={Cog}
          color={activeEnginesCount === 4 ? 'success' : activeEnginesCount > 0 ? 'warning' : 'danger'}
        />
        <StatCard
          label="Telegram бот"
          value={data?.telegram?.configured ? 'Настроен' : 'Не настроен'}
          icon={Bot}
          color={data?.telegram?.configured ? 'success' : 'warning'}
        />
        <StatCard
          label="Gemini AI"
          value={data?.gemini?.available ? 'Доступен' : 'Недоступен'}
          icon={Zap}
          color={data?.gemini?.available ? 'success' : 'danger'}
        />
      </motion.div>

      {/* Tabs */}
      <Card>
        <Tabs tabs={tabs} defaultTab="engines">
          {(activeTab) => (
            <>
              {activeTab === 'engines' && (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-3"
                >
                  {/* CWICR */}
                  <motion.div variants={listItem} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-primary/15 p-2"><Database size={20} className="text-primary" /></span>
                        <div>
                          <p className="text-sm font-medium text-foreground">CWICR Vector Search</p>
                          <p className="text-xs text-muted-foreground">
                            Поиск расценок по базе CWICR
                            {engines?.cwicr?.details && ` · ${(engines.cwicr.details as { languageCount?: number }).languageCount || 0} языков · ${(engines.cwicr.details as { cachedRows?: number }).cachedRows || 0} строк в кэше`}
                          </p>
                        </div>
                      </div>
                      {engines?.cwicr && statusBadge(engines.cwicr.status)}
                    </div>
                  </motion.div>

                  {/* Cost Estimation */}
                  <motion.div variants={listItem} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-primary/15 p-2"><Zap size={20} className="text-primary" /></span>
                        <div>
                          <p className="text-sm font-medium text-foreground">Cost Estimation</p>
                          <p className="text-xs text-muted-foreground">
                            Расчёт стоимости с Gemini AI
                            {data?.gemini?.available ? ' · Gemini доступен' : ' · Gemini недоступен'}
                          </p>
                        </div>
                      </div>
                      {engines?.costEstimation && statusBadge(engines.costEstimation.status)}
                    </div>
                  </motion.div>

                  {/* CAD/BIM Pipeline */}
                  <motion.div variants={listItem} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-primary/15 p-2"><Cpu size={20} className="text-primary" /></span>
                        <div>
                          <p className="text-sm font-medium text-foreground">CAD/BIM Pipeline</p>
                          <p className="text-xs text-muted-foreground">
                            Конвертация и обработка моделей
                            {engines?.cadPipeline?.details && ` · Open-source: ${(engines.cadPipeline.details as { openSourceCount?: number }).openSourceCount || 0} движков`}
                          </p>
                        </div>
                      </div>
                      {engines?.cadPipeline && statusBadge(engines.cadPipeline.status)}
                    </div>
                    {/* Open-source converters sub-section */}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                        <Package size={10} /> dxf-parser
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                        <Package size={10} /> LibreDWG WASM
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] text-emerald-400">
                        <Package size={10} /> web-ifc
                      </span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] ${
                        (engines?.cadPipeline?.details as { revitIfc?: { available?: boolean } })?.revitIfc?.available
                          ? 'bg-emerald-500/10 text-emerald-400'
                          : 'bg-muted text-muted-foreground'
                      }`}>
                        <Package size={10} /> revit-ifc
                        {(engines?.cadPipeline?.details as { revitIfc?: { backend?: string } })?.revitIfc?.backend && (
                          <span className="opacity-70">
                            ({(engines?.cadPipeline?.details as { revitIfc?: { backend?: string } }).revitIfc?.backend})
                          </span>
                        )}
                      </span>
                    </div>
                  </motion.div>

                  {/* Google Sheets Sync */}
                  <motion.div variants={listItem} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-primary/15 p-2"><Sheet size={20} className="text-primary" /></span>
                        <div>
                          <p className="text-sm font-medium text-foreground">Google Sheets Sync</p>
                          <p className="text-xs text-muted-foreground">
                            Синхронизация данных с Google Sheets
                            {engines?.sheetsSync?.details && ((engines.sheetsSync.details as { configured?: boolean }).configured ? ' · Настроен' : ' · Не настроен')}
                          </p>
                        </div>
                      </div>
                      {engines?.sheetsSync && statusBadge(engines.sheetsSync.status)}
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {activeTab === 'telegram' && (
                <motion.div
                  variants={staggerContainer}
                  initial="hidden"
                  animate="visible"
                  className="space-y-4"
                >
                  {/* Bot Info */}
                  <motion.div variants={listItem} className="rounded-lg border border-border bg-background p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="rounded-lg bg-blue-500/15 p-2"><Bot size={20} className="text-blue-500" /></span>
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {data?.telegram?.botUsername || '@jenssssssssss_bot'}
                          </p>
                          <p className="text-xs text-muted-foreground">Telegram бот платформы Jens</p>
                        </div>
                      </div>
                      <Badge variant={data?.telegram?.configured ? 'success' : 'warning'}>
                        {data?.telegram?.configured ? 'Настроен' : 'Не настроен'}
                      </Badge>
                    </div>
                  </motion.div>

                  {/* Commands */}
                  <motion.div variants={listItem}>
                    <p className="mb-2 text-sm font-medium text-foreground">Команды бота</p>
                    <div className="space-y-1.5">
                      {BOT_COMMANDS.map((cmd) => (
                        <div
                          key={cmd.command}
                          className="flex items-center gap-3 rounded-md border border-border/50 bg-muted/30 px-3 py-2"
                        >
                          <code className="text-xs font-mono text-primary">{cmd.command}</code>
                          <span className="text-xs text-muted-foreground">{cmd.description}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>

                  {/* Test Message */}
                  <motion.div variants={listItem} className="rounded-lg border border-border bg-background p-4">
                    <p className="mb-3 text-sm font-medium text-foreground">Отправить тестовое сообщение</p>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={testMessage}
                        onChange={(e) => setTestMessage(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSendTest()}
                        placeholder="Введите текст..."
                        className="flex-1 rounded-lg border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/60 focus:border-primary/50 focus:outline-none"
                      />
                      <Button
                        size="sm"
                        icon={<Send size={14} />}
                        onClick={handleSendTest}
                        loading={sending}
                        disabled={!testMessage.trim() || !data?.telegram?.configured}
                      >
                        Отправить
                      </Button>
                    </div>
                    {sendResult && (
                      <div className={`mt-2 flex items-center gap-1.5 text-xs ${sendResult.ok ? 'text-success' : 'text-destructive'}`}>
                        {sendResult.ok ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                        {sendResult.text}
                      </div>
                    )}
                  </motion.div>
                </motion.div>
              )}
            </>
          )}
        </Tabs>
      </Card>

      {/* Open-Source Converters Card */}
      <Card title="Open-Source конвертеры" subtitle="Основные движки обработки CAD/BIM-файлов">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">dxf-parser</strong> — чистый JS-парсер DXF файлов. Извлекает слои, линии, полилинии, текст, блоки. Основной движок для .dxf.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">LibreDWG (WASM)</strong> — WebAssembly-парсер DWG на основе libredwg. Читает AutoCAD R14–2024. Основной движок для .dwg.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">web-ifc (WASM)</strong> — WebAssembly IFC-парсер. Чтение IFC2x3, IFC4. Основной движок для .ifc.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-400" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">revit-ifc (RVT→IFC)</strong> — open-source плагин Autodesk/revit-ifc (LGPL v2). Конвертация RVT→IFC через pyRevit CLI + Revit 2023. Требуется машина с установленным Revit.
            </span>
          </div>
        </div>
      </Card>

      {/* Dependencies Card */}
      <Card title="Зависимости" subtitle="Необходимые сервисы и переменные окружения">
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">Supabase</strong> — база данных для хранения смет, задач и документов. Задаётся через <code className="rounded bg-muted px-1.5 py-0.5 text-xs">SUPABASE_URL</code> и <code className="rounded bg-muted px-1.5 py-0.5 text-xs">SUPABASE_SERVICE_KEY</code>.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">Gemini API</strong> — ИИ для классификации и анализа. Задаётся через <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GEMINI_API_KEY</code>.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">Google Sheets</strong> — синхронизация расценок. Задаётся через <code className="rounded bg-muted px-1.5 py-0.5 text-xs">GOOGLE_SHEETS_ID</code> и сервисный аккаунт.
            </span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle size={14} className="mt-0.5 shrink-0 text-warning" />
            <span className="text-muted-foreground">
              <strong className="text-foreground">Telegram</strong> — уведомления и управление. Задаётся через <code className="rounded bg-muted px-1.5 py-0.5 text-xs">TELEGRAM_BOT_TOKEN</code> и <code className="rounded bg-muted px-1.5 py-0.5 text-xs">TELEGRAM_CHAT_ID</code>.
            </span>
          </div>
        </div>
      </Card>
    </MotionPage>
  )
}
