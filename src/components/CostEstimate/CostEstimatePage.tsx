import { useState, useMemo, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchCostEstimates, fetchN8nCostEstimates } from '../../services/supabase-api'
import { classifyVOR, triggerN8nWorkflow } from '../../services/api'
import {
  Search,
  Globe,
  Calculator,
  Clock,
  Database,
  Download,
  Sparkles,
  ChevronDown,
  Trash2,
  Plus,
  Minus,
  BarChart3,
  Check,
  GitCompare,
  Zap,
  Image,
  FileText as FileTextIcon,
  MessageSquare,
  ChevronRight,
} from 'lucide-react'
import N8nWorkflowStatus from '../shared/N8nWorkflowStatus'
import N8nModuleStatus from '../shared/N8nModuleStatus'
import { VORExportButtons, EstimateExportButtons } from './VORExport'
import VORValidation from './VORValidation'
import VORAnalytics from './VORAnalytics'
import VORCompare from './VORCompare'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Tabs } from '../ui/Tabs'
import { Table } from '../ui/Table'
import { FileUpload } from '../ui/FileUpload'
import { useAppStore } from '../../store/appStore'
import { formatCurrency, formatDate } from '../../lib/utils'
import { MotionPage } from '../MotionPage'
import {
  staggerContainer,
  fadeInUp,
  scaleIn,
  listItem,
  modalContent,
  springTransition,
} from '../../lib/animations'

// ── Types ──────────────────────────────────────────────────────────────

interface WorkItem {
  id: string
  code: string
  description: string
  unit: string
  unitPrice: number
  category: string
  subcategory?: string
}

interface CostLineItem {
  id: string
  workItem: WorkItem
  quantity: number
  total: number
}

interface ClassificationResult {
  elementName: string
  matchedCode: string
  matchedDescription: string
  confidence: number
  unit: string
  unitPrice: number
  quantity: number
}

interface RecentEstimate {
  id: string
  name: string
  itemCount: number
  totalCost: number
  createdAt: string
  language: string
}

type LanguageCode = 'EN' | 'DE' | 'RU' | 'ZH' | 'AR' | 'ES' | 'FR' | 'PT' | 'HI'

// ── Constants ──────────────────────────────────────────────────────────

const LANGUAGES: { code: LanguageCode; name: string; flag: string }[] = [
  { code: 'EN', name: 'English', flag: '\uD83C\uDDEC\uD83C\uDDE7' },
  { code: 'DE', name: 'Deutsch', flag: '\uD83C\uDDE9\uD83C\uDDEA' },
  { code: 'RU', name: '\u0420\u0443\u0441\u0441\u043A\u0438\u0439', flag: '\uD83C\uDDF7\uD83C\uDDFA' },
  { code: 'ZH', name: '\u4E2D\u6587', flag: '\uD83C\uDDE8\uD83C\uDDF3' },
  { code: 'AR', name: '\u0627\u0644\u0639\u0631\u0628\u064A\u0629', flag: '\uD83C\uDDF8\uD83C\uDDE6' },
  { code: 'ES', name: 'Espa\u00F1ol', flag: '\uD83C\uDDEA\uD83C\uDDF8' },
  { code: 'FR', name: 'Fran\u00E7ais', flag: '\uD83C\uDDEB\uD83C\uDDF7' },
  { code: 'PT', name: 'Portugu\u00EAs', flag: '\uD83C\uDDE7\uD83C\uDDF7' },
  { code: 'HI', name: '\u0939\u093F\u0928\u094D\u0926\u0940', flag: '\uD83C\uDDEE\uD83C\uDDF3' },
]

// ── Mock Data ──────────────────────────────────────────────────────────

const MOCK_SEARCH_RESULTS: WorkItem[] = [
  { id: 'w1', code: '03.31.13.10', description: 'Structural concrete, cast-in-place, walls, 200mm thick', unit: 'm\u00B3', unitPrice: 285.50, category: 'Concrete', subcategory: 'Cast-in-place' },
  { id: 'w2', code: '03.31.13.20', description: 'Structural concrete, cast-in-place, slabs, 250mm thick', unit: 'm\u00B3', unitPrice: 312.00, category: 'Concrete', subcategory: 'Cast-in-place' },
  { id: 'w3', code: '03.31.13.30', description: 'Structural concrete, cast-in-place, columns, 400x400mm', unit: 'm\u00B3', unitPrice: 445.00, category: 'Concrete', subcategory: 'Cast-in-place' },
  { id: 'w4', code: '03.31.13.40', description: 'Structural concrete, cast-in-place, beams, 300x500mm', unit: 'm\u00B3', unitPrice: 398.75, category: 'Concrete', subcategory: 'Cast-in-place' },
  { id: 'w5', code: '03.21.11.10', description: 'Reinforcement steel bars, Grade 60, #4 to #8', unit: 'kg', unitPrice: 1.85, category: 'Concrete', subcategory: 'Reinforcement' },
  { id: 'w6', code: '04.21.13.10', description: 'Clay masonry, standard brick, running bond', unit: 'm\u00B2', unitPrice: 95.20, category: 'Masonry', subcategory: 'Clay brick' },
  { id: 'w7', code: '05.12.13.10', description: 'Structural steel, wide flange beams, W12 to W18', unit: 'kg', unitPrice: 3.45, category: 'Steel', subcategory: 'Structural' },
  { id: 'w8', code: '07.21.13.10', description: 'Thermal insulation, rigid board, 50mm thick', unit: 'm\u00B2', unitPrice: 28.40, category: 'Insulation', subcategory: 'Board' },
  { id: 'w9', code: '09.29.10.10', description: 'Gypsum board partition, 12.5mm, single layer each side', unit: 'm\u00B2', unitPrice: 42.60, category: 'Finishes', subcategory: 'Drywall' },
  { id: 'w10', code: '22.11.13.10', description: 'Water supply piping, copper, 15mm to 25mm diameter', unit: 'm', unitPrice: 38.90, category: 'Plumbing', subcategory: 'Piping' },
]

const MOCK_CLASSIFICATION_RESULTS: ClassificationResult[] = [
  { elementName: 'Basic Wall: Interior - 135mm', matchedCode: '09.29.10.10', matchedDescription: 'Gypsum board partition, 12.5mm', confidence: 0.92, unit: 'm\u00B2', unitPrice: 42.60, quantity: 156 },
  { elementName: 'Basic Wall: Exterior - 300mm', matchedCode: '03.31.13.10', matchedDescription: 'Structural concrete, cast-in-place, walls', confidence: 0.88, unit: 'm\u00B3', unitPrice: 285.50, quantity: 48 },
  { elementName: 'Floor: 250mm Concrete', matchedCode: '03.31.13.20', matchedDescription: 'Structural concrete, cast-in-place, slabs', confidence: 0.95, unit: 'm\u00B3', unitPrice: 312.00, quantity: 124 },
  { elementName: 'Column: 400x400 Concrete', matchedCode: '03.31.13.30', matchedDescription: 'Structural concrete, cast-in-place, columns', confidence: 0.97, unit: 'm\u00B3', unitPrice: 445.00, quantity: 36 },
  { elementName: 'Curtain Wall Panel', matchedCode: '08.44.13.10', matchedDescription: 'Aluminum curtain wall system', confidence: 0.78, unit: 'm\u00B2', unitPrice: 380.00, quantity: 220 },
]

const MOCK_RECENT_ESTIMATES: RecentEstimate[] = [
  { id: 'e1', name: 'Hospital Phase 2 - Structure', itemCount: 142, totalCost: 2847500, createdAt: '2026-02-07T14:30:00Z', language: 'EN' },
  { id: 'e2', name: 'Office Tower MEP', itemCount: 89, totalCost: 1254800, createdAt: '2026-02-06T11:15:00Z', language: 'DE' },
  { id: 'e3', name: 'Residential Block A', itemCount: 234, totalCost: 4125000, createdAt: '2026-02-05T16:45:00Z', language: 'EN' },
  { id: 'e4', name: 'Parking Structure', itemCount: 67, totalCost: 987600, createdAt: '2026-02-04T09:20:00Z', language: 'RU' },
  { id: 'e5', name: 'School Extension', itemCount: 178, totalCost: 3256400, createdAt: '2026-02-03T13:10:00Z', language: 'ES' },
]

// ── Component ──────────────────────────────────────────────────────────

export default function CostEstimatePage() {
  const { addNotification } = useAppStore()

  // Search state
  const [searchQuery, setSearchQuery] = useState('')
  const [language, setLanguage] = useState<LanguageCode>('EN')
  const [showLangDropdown, setShowLangDropdown] = useState(false)
  const [searchResults, setSearchResults] = useState<WorkItem[]>([])
  const [isSearching, setIsSearching] = useState(false)

  // Cost calculation state
  const [costItems, setCostItems] = useState<CostLineItem[]>([])

  // Classification state
  const [vorFile, setVorFile] = useState<File | null>(null)
  const [classificationResults, setClassificationResults] = useState<ClassificationResult[]>([])
  const [isClassifying, setIsClassifying] = useState(false)

  // Recent estimates
  const [recentEstimates, setRecentEstimates] = useState<RecentEstimate[]>(MOCK_RECENT_ESTIMATES)

  // n8n cost estimates
  const [n8nEstimates, setN8nEstimates] = useState<Array<{
    id: string; source: string; queryText: string | null; photoUrl: string | null
    language: string; items: unknown[]; totalCost: number; currency: string
    region: string | null; confidence: number | null; createdAt: string
  }>>([])
  const [expandedN8nRow, setExpandedN8nRow] = useState<string | null>(null)
  const [n8nPipelineExecId, setN8nPipelineExecId] = useState<string | null>(null)

  useEffect(() => {
    fetchCostEstimates()
      .then((rows) => { if (rows.length > 0) setRecentEstimates(rows as RecentEstimate[]) })
      .catch(() => {})
    fetchN8nCostEstimates()
      .then((rows) => setN8nEstimates(rows))
      .catch(() => {})
  }, [])

  // ── Computed values ────────────────────────────────────

  const grandTotal = useMemo(() => costItems.reduce((sum, item) => sum + item.total, 0), [costItems])

  const currentLang = LANGUAGES.find((l) => l.code === language)!

  // ── Handlers ───────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      addNotification('warning', 'Please enter a search query')
      return
    }

    setIsSearching(true)

    // Simulate API call
    await new Promise((r) => setTimeout(r, 800))

    // In real implementation:
    // const res = await fetch('/api/cost/search', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ query: searchQuery, language }),
    // })
    // const data = await res.json()

    // Filter mock data based on query
    const filtered = MOCK_SEARCH_RESULTS.filter(
      (item) =>
        item.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.includes(searchQuery) ||
        item.category.toLowerCase().includes(searchQuery.toLowerCase()),
    )

    setSearchResults(filtered.length > 0 ? filtered : MOCK_SEARCH_RESULTS)
    setIsSearching(false)
  }

  const addToCostItems = (workItem: WorkItem) => {
    const existing = costItems.find((ci) => ci.workItem.id === workItem.id)
    if (existing) {
      setCostItems((prev) =>
        prev.map((ci) =>
          ci.workItem.id === workItem.id
            ? { ...ci, quantity: ci.quantity + 1, total: (ci.quantity + 1) * ci.workItem.unitPrice }
            : ci,
        ),
      )
    } else {
      setCostItems((prev) => [
        ...prev,
        { id: `ci-${Date.now()}`, workItem, quantity: 1, total: workItem.unitPrice },
      ])
    }
    addNotification('success', `Added "${workItem.code}" to cost estimate`)
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCostItems((prev) =>
      prev
        .map((ci) => {
          if (ci.id !== itemId) return ci
          const newQty = Math.max(0, ci.quantity + delta)
          return { ...ci, quantity: newQty, total: newQty * ci.workItem.unitPrice }
        })
        .filter((ci) => ci.quantity > 0),
    )
  }

  const setQuantityDirect = (itemId: string, qty: number) => {
    if (qty <= 0) {
      setCostItems((prev) => prev.filter((ci) => ci.id !== itemId))
      return
    }
    setCostItems((prev) =>
      prev.map((ci) =>
        ci.id === itemId ? { ...ci, quantity: qty, total: qty * ci.workItem.unitPrice } : ci,
      ),
    )
  }

  const removeCostItem = (itemId: string) => {
    setCostItems((prev) => prev.filter((ci) => ci.id !== itemId))
  }

  const handleClassifyUpload = async () => {
    if (!vorFile) {
      addNotification('warning', 'Сначала загрузите Excel-файл с ВОР')
      return
    }
    setIsClassifying(true)
    try {
      const formData = new FormData()
      formData.append('file', vorFile)
      formData.append('language', language.toLowerCase())
      const result = await classifyVOR(formData)
      const mapped: ClassificationResult[] = result.classifications.map((c) => ({
        elementName: c.originalName,
        matchedCode: c.cwicrCode,
        matchedDescription: c.matchedDescription,
        confidence: c.confidence,
        unit: c.unit,
        unitPrice: (c.unitCostMin + c.unitCostMax) / 2,
        quantity: c.quantity,
      }))
      setClassificationResults(mapped)
      addNotification('success', `Классифицировано ${mapped.length} из ${result.summary.totalRows} строк ВОР`)
    } catch (err: any) {
      addNotification('error', err.message || 'Ошибка классификации')
    } finally {
      setIsClassifying(false)
    }
  }

  const addClassifiedToCost = () => {
    const newItems: CostLineItem[] = classificationResults.map((cr, i) => ({
      id: `ci-cls-${Date.now()}-${i}`,
      workItem: {
        id: `w-cls-${i}`,
        code: cr.matchedCode,
        description: cr.matchedDescription,
        unit: cr.unit,
        unitPrice: cr.unitPrice,
        category: 'Classified',
      },
      quantity: cr.quantity,
      total: cr.quantity * cr.unitPrice,
    }))
    setCostItems((prev) => [...prev, ...newItems])
    addNotification('success', `Added ${newItems.length} classified items to cost estimate`)
  }

  // ── Column definitions ──────────────────────────────────

  const searchColumns = [
    { key: 'code', header: 'Item Code', render: (item: WorkItem) => (
      <span className="font-mono text-xs font-medium text-primary">{item.code}</span>
    )},
    { key: 'description', header: 'Description', render: (item: WorkItem) => (
      <span className="text-sm">{item.description}</span>
    )},
    { key: 'unit', header: 'Unit', render: (item: WorkItem) => (
      <Badge variant="default">{item.unit}</Badge>
    )},
    { key: 'unitPrice', header: 'Unit Price', render: (item: WorkItem) => (
      <span className="font-medium">{formatCurrency(item.unitPrice)}</span>
    )},
    { key: 'category', header: 'Category', render: (item: WorkItem) => (
      <Badge variant="primary">{item.category}</Badge>
    )},
    { key: 'actions', header: '', className: 'w-20', render: (item: WorkItem) => (
      <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => addToCostItems(item)}>
        Add
      </Button>
    )},
  ]

  const classifyColumns = [
    { key: 'elementName', header: 'Наименование', render: (cr: ClassificationResult) => (
      <span className="font-medium text-sm">{cr.elementName}</span>
    )},
    { key: 'matchedCode', header: 'Matched Code', render: (cr: ClassificationResult) => (
      <span className="font-mono text-xs text-primary">{cr.matchedCode}</span>
    )},
    { key: 'matchedDescription', header: 'Description', render: (cr: ClassificationResult) => (
      <span className="text-sm">{cr.matchedDescription}</span>
    )},
    { key: 'confidence', header: 'Confidence', render: (cr: ClassificationResult) => (
      <Badge variant={cr.confidence >= 0.9 ? 'success' : cr.confidence >= 0.8 ? 'warning' : 'danger'}>
        {Math.round(cr.confidence * 100)}%
      </Badge>
    )},
    { key: 'unit', header: 'Unit', render: (cr: ClassificationResult) => <Badge variant="default">{cr.unit}</Badge> },
    { key: 'unitPrice', header: 'Unit Price', render: (cr: ClassificationResult) => formatCurrency(cr.unitPrice) },
    { key: 'quantity', header: 'Qty', render: (cr: ClassificationResult) => cr.quantity.toLocaleString() },
    { key: 'total', header: 'Total', render: (cr: ClassificationResult) => (
      <span className="font-medium">{formatCurrency(cr.quantity * cr.unitPrice)}</span>
    )},
  ]

  const historyColumns = [
    { key: 'name', header: 'Estimate Name', render: (e: RecentEstimate) => (
      <span className="font-medium">{e.name}</span>
    )},
    { key: 'itemCount', header: 'Items', render: (e: RecentEstimate) => e.itemCount.toLocaleString() },
    { key: 'totalCost', header: 'Total Cost', render: (e: RecentEstimate) => (
      <span className="font-medium">{formatCurrency(e.totalCost)}</span>
    )},
    { key: 'language', header: 'Language', render: (e: RecentEstimate) => {
      const lang = LANGUAGES.find((l) => l.code === e.language)
      return <Badge variant="default">{lang?.flag} {e.language}</Badge>
    }},
    { key: 'createdAt', header: 'Date', render: (e: RecentEstimate) => formatDate(e.createdAt) },
  ]

  // ── Tabs ──────────────────────────────────────────────

  const tabs = [
    { id: 'search', label: 'Семантический поиск', icon: <Search size={16} /> },
    { id: 'classify', label: 'Классификация ИИ', icon: <Sparkles size={16} /> },
    { id: 'estimate', label: 'Расчёт сметы', icon: <Calculator size={16} /> },
    { id: 'compare', label: 'Сравнение ВОР', icon: <GitCompare size={16} /> },
    { id: 'n8n', label: 'n8n Оценки', icon: <Zap size={16} /> },
    { id: 'history', label: 'История', icon: <Clock size={16} /> },
  ]

  // ── Render ──────────────────────────────────────────────

  return (
    <MotionPage>
      <div className="space-y-6">
        {/* Header */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">Смета стоимости CWICR</h1>
            <N8nModuleStatus module="costEstimate" />
          </div>
          <p className="text-muted-foreground mt-1">
            Поиск по 55 719 строительным позициям на 9 языках с BIM-классификацией на базе ИИ
          </p>
        </motion.div>

      {/* Stats Row */}
      <motion.div
        className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeInUp}>
          <StatCard label="Всего позиций" value="55,719" icon={Database} color="primary" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="Языки" value={LANGUAGES.length} icon={Globe} color="success" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="Среднее время ответа" value="0.3s" icon={Clock} color="warning" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="Смет сегодня" value={7} icon={BarChart3} color="primary" trend={{ value: 15, label: 'к вчера' }} />
        </motion.div>
      </motion.div>

      {/* Main Content */}
      <Tabs tabs={tabs} defaultTab="search">
        {(activeTab) => {
          // ── Search Tab ──────────────────────────────────
          if (activeTab === 'search') {
            return (
              <div className="space-y-6">
                {/* Search Bar */}
                <Card hover>
                  <div className="flex gap-3">
                    {/* Language selector */}
                    <div className="relative">
                      <button
                        onClick={() => setShowLangDropdown(!showLangDropdown)}
                        className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg hover:bg-muted transition-colors text-sm min-w-[120px]"
                      >
                        <span className="text-base">{currentLang.flag}</span>
                        <span className="font-medium text-foreground">{currentLang.code}</span>
                        <ChevronDown size={14} className="text-muted-foreground ml-auto" />
                      </button>
                      <AnimatePresence>
                        {showLangDropdown && (
                          <motion.div
                            variants={modalContent}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="absolute top-full left-0 mt-1 bg-card border border-border rounded-lg shadow-lg z-20 py-1 min-w-[180px]"
                          >
                            {LANGUAGES.map((lang, index) => (
                              <motion.button
                                key={lang.code}
                                variants={listItem}
                                initial="hidden"
                                animate="visible"
                                custom={index}
                                onClick={() => { setLanguage(lang.code); setShowLangDropdown(false) }}
                                className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-muted transition-colors ${
                                  language === lang.code ? 'bg-primary/10 text-primary' : 'text-foreground'
                                }`}
                              >
                                <span className="text-base">{lang.flag}</span>
                                <span>{lang.name}</span>
                                {language === lang.code && <Check size={14} className="ml-auto text-primary" />}
                              </motion.button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Search input */}
                    <div className="flex-1 relative">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Поиск позиций... например: 'бетонная стена', 'балка', '03.31'"
                        className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                      />
                    </div>

                    <Button onClick={handleSearch} loading={isSearching} icon={<Search size={16} />}>
                      Найти
                    </Button>
                  </div>
                </Card>

                {/* Search Results */}
                <AnimatePresence>
                  {searchResults.length > 0 && (
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <Card
                        title="Результаты поиска"
                        subtitle={`${searchResults.length} найдено по запросу "${searchQuery}" на языке ${currentLang.name}`}
                        hover
                      >
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                          <Table<WorkItem & Record<string, unknown>>
                            columns={searchColumns as any}
                            data={searchResults as any}
                            keyField="id"
                            emptyMessage="Ничего не найдено. Попробуйте другой запрос."
                          />
                        </motion.div>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Empty state */}
                {searchResults.length === 0 && !isSearching && (
                  <motion.div variants={scaleIn} initial="hidden" animate="visible">
                    <Card>
                      <div className="text-center py-16">
                        <Search size={48} className="mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground">Выполните поиск строительных позиций</p>
                        <p className="text-muted-foreground/60 text-xs mt-1">
                          Пример: "бетон", "балка", "утепление" или код позиции
                        </p>
                      </div>
                    </Card>
                  </motion.div>
                )}
              </div>
            )
          }

          // ── Classification Tab ──────────────────────────
          if (activeTab === 'classify') {
            return (
              <div className="space-y-6">
                <Card
                  title="Классификация ВОР (работы и материалы)"
                  subtitle="Загрузите Excel-файл с ВОР для авто-классификации через Gemini AI + CWICR"
                  hover
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <FileUpload
                        accept=".xlsx,.xls"
                        onFilesSelected={(files) => setVorFile(files[0] || null)}
                        label="Перетащите Excel-файл с ВОР"
                        description="Поддержка .xlsx и .xls — наименования работ, единицы, объёмы"
                      />
                    </div>
                    <div className="text-center px-6">
                      <Sparkles size={24} className="mx-auto text-primary mb-2" />
                      <p className="text-xs text-muted-foreground">Работает на</p>
                      <p className="text-sm font-semibold text-foreground">Gemini AI</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-3">
                    <Button
                      variant="outline"
                      onClick={async () => {
                        try {
                          const result = await triggerN8nWorkflow('/webhook/cost-text', { query: searchQuery || 'cost estimate', language }) as Record<string, unknown>
                          const execId = (result?.executionId || result?.id || '') as string
                          if (execId) setN8nPipelineExecId(execId)
                          addNotification('info', 'n8n пайплайн запущен')
                        } catch { addNotification('error', 'Не удалось запустить n8n пайплайн') }
                      }}
                      icon={<Zap size={16} />}
                    >
                      Запустить n8n Pipeline
                    </Button>
                    <Button
                      onClick={handleClassifyUpload}
                      loading={isClassifying}
                      disabled={!vorFile}
                      icon={<Sparkles size={16} />}
                    >
                      {isClassifying ? 'Классификация ИИ...' : 'Классифицировать ВОР'}
                    </Button>
                  </div>
                  {n8nPipelineExecId && (
                    <div className="mt-3">
                      <N8nWorkflowStatus
                        executionId={n8nPipelineExecId}
                        onComplete={() => {
                          addNotification('success', 'n8n пайплайн завершён')
                          fetchN8nCostEstimates().then(setN8nEstimates).catch(() => {})
                        }}
                      />
                    </div>
                  )}
                </Card>

                {/* VOR Validation */}
                <Card hover>
                  <VORValidation file={vorFile} language={language} />
                </Card>

                {/* Classification results */}
                <AnimatePresence>
                  {classificationResults.length > 0 && (
                    <motion.div
                      variants={fadeInUp}
                      initial="hidden"
                      animate="visible"
                      exit="exit"
                    >
                      <Card
                        title="Результаты классификации"
                        subtitle={`Классифицировано строк ВОР: ${classificationResults.length}`}
                        hover
                        actions={
                          <div className="flex items-center gap-2">
                            <VORExportButtons results={classificationResults} />
                            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={addClassifiedToCost}>
                              Добавить всё в смету
                            </Button>
                          </div>
                        }
                      >
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                          <Table<ClassificationResult & Record<string, unknown>>
                            columns={classifyColumns as any}
                            data={classificationResults as any}
                            keyField="elementName"
                            emptyMessage="Пока нет результатов классификации"
                          />
                        </motion.div>
                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">
                            Общая стоимость по классификации:
                          </p>
                          <motion.p
                            key={classificationResults.reduce((sum, cr) => sum + cr.quantity * cr.unitPrice, 0)}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={springTransition}
                            className="text-lg font-bold text-foreground"
                          >
                            {formatCurrency(
                              classificationResults.reduce((sum, cr) => sum + cr.quantity * cr.unitPrice, 0),
                            )}
                          </motion.p>
                        </div>
                      </Card>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Analytics */}
                {classificationResults.length > 0 && (
                  <VORAnalytics results={classificationResults} />
                )}
              </div>
            )
          }

          // ── Compare Tab ─────────────────────────────────
          if (activeTab === 'compare') {
            return <VORCompare />
          }

          // ── Cost Calculation Tab ────────────────────────
          if (activeTab === 'estimate') {
            return (
              <div className="space-y-6">
                <Card
                  title="Расчёт сметы"
                  subtitle={`Позиции в расчёте: ${costItems.length}`}
                  hover
                  actions={<EstimateExportButtons costItems={costItems} grandTotal={grandTotal} />}
                >
                  {costItems.length === 0 ? (
                    <motion.div variants={scaleIn} initial="hidden" animate="visible">
                      <div className="text-center py-16">
                        <Calculator size={48} className="mx-auto text-muted-foreground/30 mb-3" />
                        <p className="text-muted-foreground">Позиции пока не добавлены</p>
                        <p className="text-muted-foreground/60 text-xs mt-1">
                          Найдите позиции или классифицируйте BIM-элементы, чтобы добавить их
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      {/* Cost items table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Код</th>
                              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Описание</th>
                              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Ед.</th>
                              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Цена за ед.</th>
                              <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Кол-во</th>
                              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Итого</th>
                              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3 w-16"></th>
                            </tr>
                          </thead>
                          <AnimatePresence mode="popLayout">
                            <motion.tbody
                              variants={staggerContainer}
                              initial="hidden"
                              animate="visible"
                            >
                              {costItems.map((item) => (
                                <motion.tr
                                  key={item.id}
                                  variants={listItem}
                                  initial="hidden"
                                  animate="visible"
                                  exit="exit"
                                  layout
                                  className="border-b border-border/50 hover:bg-muted transition-colors"
                                >
                                  <td className="px-4 py-3 text-sm font-mono text-primary">{item.workItem.code}</td>
                                  <td className="px-4 py-3 text-sm text-foreground">{item.workItem.description}</td>
                                  <td className="px-4 py-3"><Badge variant="default">{item.workItem.unit}</Badge></td>
                                  <td className="px-4 py-3 text-sm text-foreground text-right">{formatCurrency(item.workItem.unitPrice)}</td>
                                  <td className="px-4 py-3">
                                    <div className="flex items-center justify-center gap-1">
                                      <button
                                        onClick={() => updateQuantity(item.id, -1)}
                                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                                      >
                                        <Minus size={14} />
                                      </button>
                                      <input
                                        type="number"
                                        value={item.quantity}
                                        onChange={(e) => setQuantityDirect(item.id, parseInt(e.target.value) || 0)}
                                        className="w-16 text-center py-1 border border-border rounded text-sm bg-card text-foreground"
                                      />
                                      <button
                                        onClick={() => updateQuantity(item.id, 1)}
                                        className="p-1 rounded hover:bg-muted text-muted-foreground"
                                      >
                                        <Plus size={14} />
                                      </button>
                                    </div>
                                  </td>
                                  <td className="px-4 py-3 text-sm font-medium text-foreground text-right">
                                    {formatCurrency(item.total)}
                                  </td>
                                  <td className="px-4 py-3 text-right">
                                    <button
                                      onClick={() => removeCostItem(item.id)}
                                      className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  </td>
                                </motion.tr>
                              ))}
                            </motion.tbody>
                          </AnimatePresence>
                        </table>
                      </div>

                      {/* Totals */}
                      <div className="mt-4 pt-4 border-t-2 border-border">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-muted-foreground">{costItems.length} line items</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-muted-foreground">Общий итог</p>
                            <motion.p
                              key={grandTotal}
                              initial={{ opacity: 0, scale: 0.85, y: 4 }}
                              animate={{ opacity: 1, scale: 1, y: 0 }}
                              transition={springTransition}
                              className="text-2xl font-bold text-foreground"
                            >
                              {formatCurrency(grandTotal)}
                            </motion.p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            )
          }

          // ── n8n Estimates Tab ─────────────────────────────
          if (activeTab === 'n8n') {
            return (
              <div className="space-y-6">
                <Card
                  title="Оценки стоимости из n8n"
                  subtitle={`${n8nEstimates.length} оценок из Telegram-ботов и n8n пайплайнов`}
                  hover
                  actions={
                    <Button
                      variant="outline"
                      size="sm"
                      icon={<Zap size={14} />}
                      onClick={() => fetchN8nCostEstimates().then(setN8nEstimates).catch(() => {})}
                    >
                      Обновить
                    </Button>
                  }
                >
                  {n8nEstimates.length === 0 ? (
                    <div className="text-center py-12">
                      <Zap size={48} className="mx-auto text-muted-foreground/30 mb-3" />
                      <p className="text-muted-foreground">Оценки из n8n пока отсутствуют</p>
                      <p className="text-muted-foreground/60 text-xs mt-1">
                        Результаты появятся автоматически после запуска n8n-воркфлоу
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {n8nEstimates.map((est) => (
                        <motion.div key={est.id} variants={listItem}>
                          <div
                            className="p-4 bg-muted rounded-lg border border-border hover:border-primary/30 cursor-pointer transition-colors"
                            onClick={() => setExpandedN8nRow(expandedN8nRow === est.id ? null : est.id)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                {est.source === 'telegram' && <MessageSquare size={16} className="text-blue-500" />}
                                {est.source === 'photo' && <Image size={16} className="text-purple-500" />}
                                {est.source === 'pdf' && <FileTextIcon size={16} className="text-orange-500" />}
                                {!['telegram', 'photo', 'pdf'].includes(est.source) && <Zap size={16} className="text-primary" />}
                                <div>
                                  <span className="text-sm font-medium text-foreground">
                                    {est.queryText ? est.queryText.slice(0, 80) + (est.queryText.length > 80 ? '...' : '') : `Оценка от ${est.source}`}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className="text-xs text-muted-foreground">{est.source}</span>
                                    <span className="text-xs text-muted-foreground">{est.language}</span>
                                    {est.region && <span className="text-xs text-muted-foreground">{est.region}</span>}
                                  </div>
                                </div>
                              </div>
                              <div className="flex items-center gap-4">
                                <span className="text-sm font-bold text-foreground">
                                  {est.totalCost.toLocaleString()} {est.currency}
                                </span>
                                <span className="text-xs text-muted-foreground">
                                  {new Date(est.createdAt).toLocaleDateString()}
                                </span>
                                <ChevronRight size={14} className={`text-muted-foreground transition-transform ${expandedN8nRow === est.id ? 'rotate-90' : ''}`} />
                              </div>
                            </div>

                            <AnimatePresence>
                              {expandedN8nRow === est.id && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="mt-4 pt-4 border-t border-border space-y-3">
                                    {est.photoUrl && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-1">Фото</p>
                                        <img src={est.photoUrl} alt="Query" className="max-h-40 rounded-lg border border-border" />
                                      </div>
                                    )}
                                    {Array.isArray(est.items) && est.items.length > 0 && (
                                      <div>
                                        <p className="text-xs text-muted-foreground mb-2">Позиции ({est.items.length})</p>
                                        <div className="space-y-1">
                                          {(est.items as Array<Record<string, unknown>>).map((item, idx) => (
                                            <div key={idx} className="flex items-center justify-between text-xs p-2 bg-background rounded border border-border">
                                              <span className="text-foreground">{String(item.description || item.name || `#${idx + 1}`)}</span>
                                              <span className="font-medium text-foreground">{Number(item.cost || item.totalPrice || 0).toLocaleString()} {est.currency}</span>
                                            </div>
                                          ))}
                                        </div>
                                      </div>
                                    )}
                                    {est.confidence != null && (
                                      <p className="text-xs text-muted-foreground">Уверенность: {est.confidence}%</p>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </Card>
              </div>
            )
          }

          // ── History Tab ─────────────────────────────────
          if (activeTab === 'history') {
            return (
              <Card
                title="Последние сметы"
                subtitle={`Смет за последние 7 дней: ${recentEstimates.length}`}
                hover
                actions={
                  <Button variant="outline" size="sm" icon={<Download size={14} />}>
                    Экспорт всего
                  </Button>
                }
              >
                <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                  <Table<RecentEstimate & Record<string, unknown>>
                    columns={historyColumns as any}
                    data={recentEstimates as any}
                    keyField="id"
                    emptyMessage="История смет пока пуста"
                  />
                </motion.div>
              </Card>
            )
          }

          return null
        }}
      </Tabs>
      </div>
    </MotionPage>
  )
}
