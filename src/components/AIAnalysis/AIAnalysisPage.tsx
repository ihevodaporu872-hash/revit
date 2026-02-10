import { useState, useCallback, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BrainCircuit,
  Send,
  Sparkles,
  Code2,
  BarChart3,
  TableProperties,
  TrendingUp,
  Zap,
  FileSpreadsheet,
  Clock,
  PieChart,
  Copy,
  Check,
  Bot,
  User,
  Loader2,
  RotateCcw,
  Columns3,
  Search,
  GitBranch,
} from 'lucide-react'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Tabs } from '../ui/Tabs'
import { FileUpload } from '../ui/FileUpload'
import { useAppStore } from '../../store/appStore'
import { MotionPage } from '../MotionPage'
import { staggerContainer, fadeInUp, scaleIn, listItem, fadeIn, interactiveScale } from '../../lib/animations'
import { saveChatSession } from '../../services/supabase-api'

// ---- Types ----

interface ChatMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  timestamp: number
  code?: string
  results?: AnalysisResult
}

interface AnalysisResult {
  type: 'table' | 'chart' | 'stats' | 'mixed'
  tableData?: { headers: string[]; rows: string[][] }
  stats?: { label: string; value: string; change?: number }[]
  chartDescription?: string
  chartBars?: { label: string; value: number; color: string }[]
  summary?: string
}

interface QuickPreset {
  id: string
  label: string
  icon: React.ReactNode
  prompt: string
}

// ---- Mock Data ----

const QUICK_PRESETS: QuickPreset[] = [
  { id: 'group', label: 'Группировка по категориям', icon: <Columns3 size={14} />, prompt: 'Сгруппируй данные по категориям и покажи количество и сумму по каждой группе.' },
  { id: 'distribution', label: 'Распределение', icon: <PieChart size={14} />, prompt: 'Покажи распределение значений в основном числовом столбце, включая проценты и гистограмму.' },
  { id: 'anomalies', label: 'Поиск аномалий', icon: <Search size={14} />, prompt: 'Найди аномалии и выбросы в данных. Отметь значения с сильным отклонением от среднего.' },
  { id: 'compare', label: 'Сравнение столбцов', icon: <GitBranch size={14} />, prompt: 'Сравни основные числовые столбцы: корреляция, различия и тренды.' },
]

function generateMockResponse(userMessage: string, fileName: string): { code: string; results: AnalysisResult } {
  const lowerMsg = userMessage.toLowerCase()

  if (lowerMsg.includes('group') || lowerMsg.includes('category')) {
    return {
      code: `import pandas as pd

df = pd.read_excel("${fileName}")

# Group by category and calculate aggregates
grouped = df.groupby('Category').agg({
    'Quantity': 'sum',
    'UnitCost': 'mean',
    'TotalCost': 'sum'
}).round(2)

grouped['Count'] = df.groupby('Category').size()
grouped = grouped.sort_values('TotalCost', ascending=False)
print(grouped)`,
      results: {
        type: 'mixed',
        tableData: {
          headers: ['Category', 'Count', 'Total Qty', 'Avg Unit Cost', 'Total Cost'],
          rows: [
            ['Structural', '245', '1,847', '$125.50', '$231,547.50'],
            ['MEP', '189', '1,234', '$89.30', '$110,204.20'],
            ['Architectural', '312', '2,156', '$67.80', '$146,176.80'],
            ['Civil', '98', '567', '$145.20', '$82,318.40'],
            ['Landscape', '45', '234', '$52.40', '$12,261.60'],
          ],
        },
        chartBars: [
          { label: 'Structural', value: 231547, color: '#3b82f6' },
          { label: 'Architectural', value: 146176, color: '#10b981' },
          { label: 'MEP', value: 110204, color: '#f59e0b' },
          { label: 'Civil', value: 82318, color: '#8b5cf6' },
          { label: 'Landscape', value: 12261, color: '#ec4899' },
        ],
        stats: [
          { label: 'Total Categories', value: '5' },
          { label: 'Total Items', value: '889' },
          { label: 'Total Cost', value: '$582,508.50' },
          { label: 'Largest Category', value: 'Architectural (312)' },
        ],
        summary: 'The data contains 5 categories with 889 total items. Structural has the highest total cost ($231,547.50) while Architectural has the most items (312). The average unit cost ranges from $52.40 (Landscape) to $145.20 (Civil).',
      },
    }
  }

  if (lowerMsg.includes('distribution') || lowerMsg.includes('histogram')) {
    return {
      code: `import pandas as pd
import numpy as np

df = pd.read_excel("${fileName}")

# Analyze distribution of TotalCost
costs = df['TotalCost']
print(f"Mean: ${'{costs.mean():.2f}'}")
print(f"Median: ${'{costs.median():.2f}'}")
print(f"Std Dev: ${'{costs.std():.2f}'}")
print(f"Min: ${'{costs.min():.2f}'}")
print(f"Max: ${'{costs.max():.2f}'}")

# Create histogram bins
bins = pd.cut(costs, bins=6)
distribution = bins.value_counts().sort_index()
print("\\nDistribution:")
print(distribution)`,
      results: {
        type: 'mixed',
        chartBars: [
          { label: '$0-500', value: 145, color: '#3b82f6' },
          { label: '$500-1K', value: 234, color: '#3b82f6' },
          { label: '$1K-5K', value: 312, color: '#3b82f6' },
          { label: '$5K-10K', value: 128, color: '#3b82f6' },
          { label: '$10K-50K', value: 56, color: '#f59e0b' },
          { label: '$50K+', value: 14, color: '#ef4444' },
        ],
        stats: [
          { label: 'Mean', value: '$4,823.50' },
          { label: 'Median', value: '$2,145.00' },
          { label: 'Std Deviation', value: '$8,912.30' },
          { label: 'Skewness', value: '2.34 (right-skewed)' },
        ],
        summary: 'The cost distribution is right-skewed with a mean of $4,823.50 and median of $2,145.00. Most items (78%) fall under $5,000. There are 14 items above $50,000 which may warrant review as potential outliers.',
      },
    }
  }

  if (lowerMsg.includes('anomal') || lowerMsg.includes('outlier')) {
    return {
      code: `import pandas as pd
import numpy as np

df = pd.read_excel("${fileName}")

# Detect anomalies using IQR method
Q1 = df['TotalCost'].quantile(0.25)
Q3 = df['TotalCost'].quantile(0.75)
IQR = Q3 - Q1
lower = Q1 - 1.5 * IQR
upper = Q3 + 1.5 * IQR

anomalies = df[(df['TotalCost'] < lower) | (df['TotalCost'] > upper)]
print(f"Found {len(anomalies)} anomalies out of {len(df)} records")
print(f"Threshold: ${'{lower:.2f}'} to ${'{upper:.2f}'}")
print(anomalies[['Element', 'Category', 'TotalCost']].to_string())`,
      results: {
        type: 'mixed',
        tableData: {
          headers: ['Element', 'Category', 'Total Cost', 'Z-Score', 'Flag'],
          rows: [
            ['Beam-L4-Heavy-001', 'Structural', '$145,230.00', '4.2', 'HIGH OUTLIER'],
            ['HVAC-Central-Unit', 'MEP', '$98,500.00', '3.1', 'HIGH OUTLIER'],
            ['Foundation-Pile-023', 'Civil', '$87,340.00', '2.8', 'HIGH OUTLIER'],
            ['Wall-Ext-Spec-007', 'Architectural', '$0.50', '-2.4', 'LOW OUTLIER'],
            ['Bolt-Misc-999', 'Structural', '$0.01', '-2.6', 'LOW OUTLIER'],
          ],
        },
        stats: [
          { label: 'Total Records', value: '889' },
          { label: 'Anomalies Found', value: '5', change: -2 },
          { label: 'High Outliers', value: '3' },
          { label: 'Low Outliers', value: '2' },
        ],
        summary: 'Found 5 anomalies using the IQR method. 3 high outliers exceed $87,000 and may represent bulk orders or specification errors. 2 low outliers are under $1 and likely represent data entry errors. Recommend manual review of flagged items.',
      },
    }
  }

  if (lowerMsg.includes('compare') || lowerMsg.includes('column') || lowerMsg.includes('correlation')) {
    return {
      code: `import pandas as pd

df = pd.read_excel("${fileName}")

# Compare numeric columns
numeric_cols = df.select_dtypes(include='number').columns
comparison = df[numeric_cols].describe().round(2)
correlation = df[numeric_cols].corr().round(3)

print("Summary Statistics:")
print(comparison)
print("\\nCorrelation Matrix:")
print(correlation)`,
      results: {
        type: 'mixed',
        tableData: {
          headers: ['Metric', 'Quantity', 'Unit Cost', 'Total Cost', 'Area (m2)'],
          rows: [
            ['Mean', '12.4', '$95.60', '$4,823.50', '45.2'],
            ['Median', '8.0', '$72.30', '$2,145.00', '32.0'],
            ['Std Dev', '15.2', '$68.40', '$8,912.30', '38.7'],
            ['Min', '1.0', '$0.01', '$0.50', '0.5'],
            ['Max', '150.0', '$890.00', '$145,230.00', '320.0'],
            ['Correlation w/ Cost', '0.72', '0.85', '1.00', '0.61'],
          ],
        },
        stats: [
          { label: 'Strongest Correlation', value: 'Unit Cost vs Total (0.85)' },
          { label: 'Weakest Correlation', value: 'Area vs Total (0.61)' },
          { label: 'Numeric Columns', value: '4' },
          { label: 'Complete Rows', value: '876 / 889 (98.5%)' },
        ],
        summary: 'Unit Cost has the strongest correlation with Total Cost (0.85), followed by Quantity (0.72) and Area (0.61). All correlations are positive. 13 rows have missing numeric values which were excluded from correlation calculations.',
      },
    }
  }

  // Default generic analysis
  return {
    code: `import pandas as pd

df = pd.read_excel("${fileName}")

# General data overview
print(f"Shape: {df.shape}")
print(f"Columns: {list(df.columns)}")
print(f"Missing values:\\n{df.isnull().sum()}")
print(f"\\nFirst 5 rows:")
print(df.head())
print(f"\\nBasic statistics:")
print(df.describe())`,
    results: {
      type: 'mixed',
      tableData: {
        headers: ['Statistic', 'Value'],
        rows: [
          ['Total Rows', '889'],
          ['Total Columns', '12'],
          ['Numeric Columns', '4'],
          ['Text Columns', '8'],
          ['Missing Values', '13 (0.12%)'],
          ['Duplicate Rows', '0'],
          ['Memory Usage', '85.4 KB'],
        ],
      },
      stats: [
        { label: 'Rows', value: '889' },
        { label: 'Columns', value: '12' },
        { label: 'Completeness', value: '99.88%' },
        { label: 'File Size', value: '85.4 KB' },
      ],
      summary: `Data overview for "${fileName}": 889 rows and 12 columns. The dataset is 99.88% complete with only 13 missing values across 3 columns. No duplicate rows found. Data types include 4 numeric and 8 text columns.`,
    },
  }
}

// ---- Typing dots animation ----

const typingDotVariants: import('framer-motion').Variants = {
  hidden: { opacity: 0.3, y: 0 },
  visible: (i: number) => ({
    opacity: [0.3, 1, 0.3],
    y: [0, -4, 0],
    transition: {
      duration: 0.8,
      repeat: Infinity,
      ease: 'easeInOut' as const,
      delay: i * 0.15,
    },
  }),
}

// ---- Code block entrance ----

const codeBlockVariants: import('framer-motion').Variants = {
  hidden: { opacity: 0, y: 8, scaleY: 0.96 },
  visible: {
    opacity: 1,
    y: 0,
    scaleY: 1,
    transition: { duration: 0.35, ease: [0.25, 0.1, 0.25, 1] as const },
  },
}

// ---- Component ----

export default function AIAnalysisPage() {
  const { addNotification } = useAppStore()
  const [files, setFiles] = useState<File[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputValue, setInputValue] = useState('')
  const [loading, setLoading] = useState(false)
  const [copiedId, setCopiedId] = useState<string | null>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Persistent stats backed by localStorage
  const [analysesRun, setAnalysesRun] = useState(() => {
    const saved = localStorage.getItem('jens_ai_analyses_run')
    return saved ? parseInt(saved, 10) : 0
  })
  const [avgResponseMs, setAvgResponseMs] = useState(() => {
    const saved = localStorage.getItem('jens_ai_avg_response_ms')
    return saved ? parseFloat(saved) : 0
  })
  const [filesProcessed, setFilesProcessed] = useState(() => {
    const saved = localStorage.getItem('jens_ai_files_processed')
    return saved ? parseInt(saved, 10) : 0
  })
  const [chartsGenerated, setChartsGenerated] = useState(() => {
    const saved = localStorage.getItem('jens_ai_charts_generated')
    return saved ? parseInt(saved, 10) : 0
  })
  const [trackedFileNames, setTrackedFileNames] = useState<Set<string>>(() => {
    const saved = localStorage.getItem('jens_ai_tracked_files')
    return saved ? new Set(JSON.parse(saved)) : new Set()
  })

  const [chatSessionId, setChatSessionId] = useState<string | null>(null)

  // Persist stats to localStorage
  const trackAnalysis = useCallback((responseTimeMs: number, fileName: string, hasChart: boolean, isDemo: boolean) => {
    if (isDemo) return // Don't count demo responses in stats
    setAnalysesRun(prev => {
      const next = prev + 1
      localStorage.setItem('jens_ai_analyses_run', String(next))
      return next
    })
    setAvgResponseMs(prev => {
      const count = analysesRun || 1
      const next = Math.round((prev * count + responseTimeMs) / (count + 1))
      localStorage.setItem('jens_ai_avg_response_ms', String(next))
      return next
    })
    setTrackedFileNames(prev => {
      if (!prev.has(fileName)) {
        const next = new Set(prev).add(fileName)
        localStorage.setItem('jens_ai_tracked_files', JSON.stringify([...next]))
        setFilesProcessed(next.size)
        localStorage.setItem('jens_ai_files_processed', String(next.size))
        return next
      }
      return prev
    })
    if (hasChart) {
      setChartsGenerated(prev => {
        const next = prev + 1
        localStorage.setItem('jens_ai_charts_generated', String(next))
        return next
      })
    }
  }, [analysesRun])

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim()) return
    if (files.length === 0) {
      addNotification('warning', 'Сначала загрузите файл для анализа.')
      return
    }

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInputValue('')
    setLoading(true)
    const startTime = Date.now()

    try {
      // Real API call
      let usedMock = false
      let aiMsg: ChatMessage | null = null

      try {
        const formData = new FormData()
        formData.append('file', files[0])
        formData.append('prompt', text)
        formData.append('history', JSON.stringify(messages.map((m) => ({ role: m.role, content: m.content }))))

        const res = await fetch('/api/ai/analyze', { method: 'POST', body: formData })
        if (res.ok) {
          const data = await res.json()
          const elapsed = Date.now() - startTime
          aiMsg = {
            id: `ai-${Date.now()}`,
            role: 'ai',
            content: data.explanation || data.analysis || 'Анализ завершён.',
            timestamp: Date.now(),
            code: data.code || undefined,
            results: data.results || undefined,
          }
          trackAnalysis(elapsed, files[0].name, !!(data.results?.chartBars), false)
        }
      } catch {
        // API not available, fall through to mock
      }

      // Fallback: mock response with [Demo] indication
      if (!aiMsg) {
        usedMock = true
        await new Promise((resolve) => setTimeout(resolve, 1500 + Math.random() * 1000))
        const mock = generateMockResponse(text, files[0].name)
        aiMsg = {
          id: `ai-${Date.now()}`,
          role: 'ai',
          content: `[Demo] ${mock.results.summary || 'Анализ завершён. Ниже результаты:'}`,
          timestamp: Date.now(),
          code: mock.code,
          results: mock.results,
        }
        addNotification('warning', 'Сервер AI недоступен — показаны демо-данные.')
      }

      setMessages((prev) => [...prev, aiMsg!])
      // Persist chat session to Supabase
      saveChatSession({
        id: chatSessionId || undefined,
        title: files[0]?.name || 'AI Analysis',
        fileName: files[0]?.name,
        messages: [...messages, userMsg, aiMsg].map((m) => ({ role: m.role, content: m.content, timestamp: m.timestamp })),
      }).then((saved) => { if (saved?.id) setChatSessionId(saved.id) }).catch(() => {})
    } catch (err) {
      addNotification('error', `Ошибка анализа: ${err instanceof Error ? err.message : 'Неизвестная ошибка'}`)
    } finally {
      setLoading(false)
    }
  }, [files, messages, addNotification, chatSessionId, trackAnalysis])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage(inputValue)
    }
  }

  const copyCode = (id: string, code: string) => {
    navigator.clipboard.writeText(code)
    setCopiedId(id)
    setTimeout(() => setCopiedId(null), 2000)
  }

  const clearChat = () => {
    setMessages([])
    addNotification('info', 'История чата очищена.')
  }

  const maxBarValue = (bars: AnalysisResult['chartBars']) => {
    if (!bars || bars.length === 0) return 1
    return Math.max(...bars.map((b) => b.value))
  }

  return (
    <MotionPage>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-3">
              <BrainCircuit size={28} className="text-primary" />
              Анализ данных ИИ
            </h1>
            <p className="text-muted-foreground mt-1">
              Загружайте данные и получайте анализ, визуализации и выводы с помощью ИИ
            </p>
          </div>
          {messages.length > 0 && (
            <Button variant="outline" icon={<RotateCcw size={16} />} onClick={clearChat}>
              Очистить чат
            </Button>
          )}
        </div>

        {/* Stats */}
        <motion.div
          variants={staggerContainer}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        >
          <motion.div variants={fadeInUp}>
            <StatCard label="Запусков анализа" value={analysesRun} icon={Zap} color="primary" trend={{ value: 23, label: 'за неделю' }} />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <StatCard label="Средний ответ" value={avgResponse} icon={Clock} color="success" />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <StatCard label="Обработано файлов" value={filesProcessed} icon={FileSpreadsheet} color="warning" trend={{ value: 8, label: 'за месяц' }} />
          </motion.div>
          <motion.div variants={fadeInUp}>
            <StatCard label="Построено графиков" value={chartsGenerated} icon={PieChart} color="primary" trend={{ value: 15, label: 'за неделю' }} />
          </motion.div>
        </motion.div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: Upload + Presets */}
          <div className="space-y-6">
            {/* File Upload */}
            <Card title="Источник данных" subtitle="Загрузите Excel или CSV">
              <FileUpload
                accept=".xlsx,.xls,.csv"
                onFilesSelected={setFiles}
                label="Перетащите файлы данных сюда"
                description="Поддержка .xlsx, .xls, .csv"
              />
            </Card>

            {/* Quick Presets */}
            <Card title="Быстрый анализ" subtitle="Частые шаблоны анализа">
              <motion.div
                variants={staggerContainer}
                initial="hidden"
                animate="visible"
                className="space-y-2"
              >
                {QUICK_PRESETS.map((preset) => (
                  <motion.button
                    key={preset.id}
                    variants={listItem}
                    whileHover={{
                      scale: 1.02,
                      borderColor: 'var(--primary)',
                      boxShadow: 'var(--shadow-glow)',
                    }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => sendMessage(preset.prompt)}
                    disabled={loading || files.length === 0}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted transition-colors text-left disabled:opacity-50 disabled:pointer-events-none"
                  >
                    <div className="p-1.5 rounded-md bg-primary/10 text-primary shrink-0">
                      {preset.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{preset.label}</p>
                      <p className="text-xs text-muted-foreground truncate">{preset.prompt}</p>
                    </div>
                    <Sparkles size={14} className="text-primary/40 shrink-0" />
                  </motion.button>
                ))}
              </motion.div>
            </Card>
          </div>

          {/* Right: Chat + Results */}
          <div className="lg:col-span-2 flex flex-col">
            <Card className="flex-1 flex flex-col !p-0">
              {/* Chat Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Bot size={20} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">Jens AI Assistant</h3>
                    <p className="text-xs text-muted-foreground">На базе Google Gemini</p>
                  </div>
                </div>
                <Badge variant="success">Онлайн</Badge>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6 min-h-[400px] max-h-[600px]">
                {messages.length === 0 && (
                  <motion.div
                    variants={fadeIn}
                    initial="hidden"
                    animate="visible"
                    className="flex flex-col items-center justify-center h-full text-muted-foreground py-12"
                  >
                    <Sparkles size={48} className="text-primary/20 mb-4" />
                    <h3 className="text-lg font-semibold text-foreground">Начните анализ</h3>
                    <p className="text-sm mt-1 max-w-sm text-center">
                      Загрузите файл данных и опишите, что нужно проанализировать. Можно выбрать быстрый шаблон слева.
                    </p>
                  </motion.div>
                )}

                <AnimatePresence mode="popLayout">
                  {messages.map((msg) => (
                    <motion.div
                      key={msg.id}
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                      layout
                      className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                    >
                      {msg.role === 'ai' && (
                        <motion.div
                          variants={scaleIn}
                          initial="hidden"
                          animate="visible"
                          className="p-2 rounded-lg bg-primary/10 text-primary h-fit shrink-0 mt-1"
                        >
                          <Bot size={16} />
                        </motion.div>
                      )}

                      <div className={`max-w-[85%] space-y-3 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                        {/* Message bubble */}
                        <div className={`rounded-xl px-4 py-3 ${
                          msg.role === 'user'
                            ? 'bg-primary text-white rounded-br-sm'
                            : 'bg-muted border border-border rounded-bl-sm'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                          <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-white/60' : 'text-muted-foreground'}`}>
                            {new Date(msg.timestamp).toLocaleTimeString()}
                          </p>
                        </div>

                        {/* Code block */}
                        {msg.code && (
                          <motion.div
                            variants={codeBlockVariants}
                            initial="hidden"
                            animate="visible"
                            className="rounded-xl border border-border overflow-hidden"
                            style={{ transformOrigin: 'top' }}
                          >
                            <div className="flex items-center justify-between px-4 py-2 bg-[oklch(0.15_0.01_262)] text-muted-foreground">
                              <div className="flex items-center gap-2 text-xs">
                                <Code2 size={14} />
                                <span>Сгенерированный Python-код</span>
                              </div>
                              <button
                                onClick={() => copyCode(msg.id, msg.code!)}
                                className="flex items-center gap-1 text-xs hover:text-white transition-colors"
                              >
                                {copiedId === msg.id ? <Check size={12} /> : <Copy size={12} />}
                                {copiedId === msg.id ? 'Скопировано' : 'Копировать'}
                              </button>
                            </div>
                            <pre className="bg-[oklch(0.12_0.01_262)] text-foreground/80 p-4 overflow-x-auto text-xs leading-relaxed">
                              <code>{msg.code}</code>
                            </pre>
                          </motion.div>
                        )}

                        {/* Results */}
                        {msg.results && (
                          <Tabs
                            tabs={[
                              ...(msg.results.tableData ? [{ id: 'table', label: 'Таблица', icon: <TableProperties size={14} /> }] : []),
                              ...(msg.results.chartBars ? [{ id: 'chart', label: 'График', icon: <BarChart3 size={14} /> }] : []),
                              ...(msg.results.stats ? [{ id: 'stats', label: 'Статистика', icon: <TrendingUp size={14} /> }] : []),
                            ]}
                            className="rounded-xl border border-border overflow-hidden bg-card"
                          >
                            {(activeTab) => (
                              <div className="px-4 pb-4">
                                {activeTab === 'table' && msg.results?.tableData && (
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-sm">
                                      <thead>
                                        <tr className="border-b border-border">
                                          {msg.results.tableData.headers.map((h, i) => (
                                            <th key={i} className="text-left px-3 py-2 text-xs font-semibold text-muted-foreground uppercase">
                                              {h}
                                            </th>
                                          ))}
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {msg.results.tableData.rows.map((row, ri) => (
                                          <tr key={ri} className="border-b border-border/50 hover:bg-muted">
                                            {row.map((cell, ci) => (
                                              <td key={ci} className="px-3 py-2 text-foreground">
                                                {cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}

                                {activeTab === 'chart' && msg.results?.chartBars && (
                                  <div className="space-y-3">
                                    <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Распределение</p>
                                    {msg.results.chartBars.map((bar, i) => (
                                      <div key={i} className="space-y-1">
                                        <div className="flex items-center justify-between text-sm">
                                          <span className="text-foreground">{bar.label}</span>
                                          <span className="font-medium text-foreground">{bar.value.toLocaleString()}</span>
                                        </div>
                                        <div className="h-5 bg-border rounded-md overflow-hidden">
                                          <div
                                            className="h-full rounded-md transition-all duration-700"
                                            style={{
                                              width: `${(bar.value / maxBarValue(msg.results!.chartBars)) * 100}%`,
                                              backgroundColor: bar.color,
                                            }}
                                          />
                                        </div>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                {activeTab === 'stats' && msg.results?.stats && (
                                  <div className="grid grid-cols-2 gap-3">
                                    {msg.results.stats.map((stat, i) => (
                                      <div key={i} className="p-3 rounded-lg bg-muted border border-border">
                                        <p className="text-xs text-muted-foreground">{stat.label}</p>
                                        <p className="text-lg font-bold text-foreground mt-0.5">{stat.value}</p>
                                        {stat.change !== undefined && (
                                          <p className={`text-xs mt-0.5 ${stat.change >= 0 ? 'text-success' : 'text-destructive'}`}>
                                            {stat.change >= 0 ? '+' : ''}{stat.change}%
                                          </p>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}
                          </Tabs>
                        )}
                      </div>

                      {msg.role === 'user' && (
                        <motion.div
                          variants={scaleIn}
                          initial="hidden"
                          animate="visible"
                          className="p-2 rounded-lg bg-primary text-white h-fit shrink-0 mt-1"
                        >
                          <User size={16} />
                        </motion.div>
                      )}
                    </motion.div>
                  ))}
                </AnimatePresence>

                {/* Loading indicator */}
                <AnimatePresence>
                  {loading && (
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
                      className="flex gap-3"
                    >
                      <div className="p-2 rounded-lg bg-primary/10 text-primary h-fit shrink-0">
                        <Bot size={16} />
                      </div>
                      <div className="bg-muted border border-border rounded-xl rounded-bl-sm px-4 py-3">
                        <div className="flex items-center gap-3 text-sm text-muted-foreground">
                          <Loader2 size={14} className="animate-spin" />
                          <span>Идёт анализ данных через Gemini AI</span>
                          <span className="flex items-center gap-0.5">
                            {[0, 1, 2].map((i) => (
                              <motion.span
                                key={i}
                                custom={i}
                                variants={typingDotVariants}
                                initial="hidden"
                                animate="visible"
                                className="inline-block w-1.5 h-1.5 rounded-full bg-primary"
                              />
                            ))}
                          </span>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                <div ref={chatEndRef} />
              </div>

              {/* Chat Input */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.15 }}
                className="border-t border-border p-4"
              >
                <div className="flex items-center gap-3">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={files.length > 0 ? 'Опишите, что хотите проанализировать...' : 'Сначала загрузите файл...'}
                    disabled={files.length === 0 || loading}
                    className="flex-1 px-4 py-2.5 bg-muted border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary disabled:opacity-50 transition-shadow duration-200"
                  />
                  <Button
                    onClick={() => sendMessage(inputValue)}
                    disabled={!inputValue.trim() || loading || files.length === 0}
                    icon={loading ? undefined : <Send size={16} />}
                    loading={loading}
                  >
                    Отправить
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground mt-2 px-1">
                  Нажмите Enter для отправки. ИИ сгенерирует код и покажет результаты анализа.
                </p>
              </motion.div>
            </Card>
          </div>
        </div>
      </div>
    </MotionPage>
  )
}
