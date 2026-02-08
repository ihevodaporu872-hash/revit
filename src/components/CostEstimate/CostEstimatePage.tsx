import { useState, useCallback, useMemo } from 'react'
import {
  Search,
  Globe,
  Calculator,
  Clock,
  Database,
  Download,
  FileSpreadsheet,
  FileText,
  Upload,
  Sparkles,
  ChevronDown,
  Trash2,
  Plus,
  Minus,
  BarChart3,
  Check,
  Loader2,
  X,
} from 'lucide-react'
import { Card, StatCard } from '../ui/Card'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Tabs } from '../ui/Tabs'
import { Table } from '../ui/Table'
import { useAppStore } from '../../store/appStore'
import { formatCurrency, formatDate } from '../../lib/utils'

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
  const [classificationResults, setClassificationResults] = useState<ClassificationResult[]>([])
  const [isClassifying, setIsClassifying] = useState(false)

  // Recent estimates
  const [recentEstimates] = useState<RecentEstimate[]>(MOCK_RECENT_ESTIMATES)

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
    setIsClassifying(true)

    // Simulate API call to Gemini AI classification
    await new Promise((r) => setTimeout(r, 2000))

    // In real implementation:
    // const formData = new FormData()
    // formData.append('file', excelFile)
    // formData.append('language', language)
    // const res = await fetch('/api/cost/classify', { method: 'POST', body: formData })
    // const data = await res.json()

    setClassificationResults(MOCK_CLASSIFICATION_RESULTS)
    setIsClassifying(false)
    addNotification('success', `Classified ${MOCK_CLASSIFICATION_RESULTS.length} BIM elements using Gemini AI`)
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

  const exportToExcel = () => {
    addNotification('info', 'Exporting cost estimate to Excel...')
    // In real implementation: generate XLSX using xlsx library
  }

  const exportToPdf = () => {
    addNotification('info', 'Exporting cost estimate to PDF...')
    // In real implementation: generate PDF report
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
    { key: 'elementName', header: 'BIM Element', render: (cr: ClassificationResult) => (
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
    { id: 'search', label: 'Semantic Search', icon: <Search size={16} /> },
    { id: 'classify', label: 'AI Classification', icon: <Sparkles size={16} /> },
    { id: 'estimate', label: 'Cost Calculation', icon: <Calculator size={16} /> },
    { id: 'history', label: 'History', icon: <Clock size={16} /> },
  ]

  // ── Render ──────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-text">CWICR Cost Estimation</h1>
        <p className="text-text-secondary mt-1">
          Search 55,719 construction work items across 9 languages with AI-powered BIM classification
        </p>
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Items" value="55,719" icon={Database} color="primary" />
        <StatCard label="Languages" value={LANGUAGES.length} icon={Globe} color="success" />
        <StatCard label="Avg Response Time" value="0.3s" icon={Clock} color="warning" />
        <StatCard label="Estimates Today" value={7} icon={BarChart3} color="primary" trend={{ value: 15, label: 'vs yesterday' }} />
      </div>

      {/* Main Content */}
      <Tabs tabs={tabs} defaultTab="search">
        {(activeTab) => {
          // ── Search Tab ──────────────────────────────────
          if (activeTab === 'search') {
            return (
              <div className="space-y-6">
                {/* Search Bar */}
                <Card>
                  <div className="flex gap-3">
                    {/* Language selector */}
                    <div className="relative">
                      <button
                        onClick={() => setShowLangDropdown(!showLangDropdown)}
                        className="flex items-center gap-2 px-3 py-2.5 border border-border rounded-lg hover:bg-surface-alt transition-colors text-sm min-w-[120px]"
                      >
                        <span className="text-base">{currentLang.flag}</span>
                        <span className="font-medium text-text">{currentLang.code}</span>
                        <ChevronDown size={14} className="text-text-secondary ml-auto" />
                      </button>
                      {showLangDropdown && (
                        <div className="absolute top-full left-0 mt-1 bg-surface border border-border rounded-lg shadow-lg z-20 py-1 min-w-[180px]">
                          {LANGUAGES.map((lang) => (
                            <button
                              key={lang.code}
                              onClick={() => { setLanguage(lang.code); setShowLangDropdown(false) }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-sm hover:bg-surface-alt transition-colors ${
                                language === lang.code ? 'bg-primary-light/50 text-primary' : 'text-text'
                              }`}
                            >
                              <span className="text-base">{lang.flag}</span>
                              <span>{lang.name}</span>
                              {language === lang.code && <Check size={14} className="ml-auto text-primary" />}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Search input */}
                    <div className="flex-1 relative">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Search work items... e.g. 'concrete wall', 'steel beam', '03.31'"
                        className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-surface text-text placeholder:text-text-secondary/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                      />
                    </div>

                    <Button onClick={handleSearch} loading={isSearching} icon={<Search size={16} />}>
                      Search
                    </Button>
                  </div>
                </Card>

                {/* Search Results */}
                {searchResults.length > 0 && (
                  <Card
                    title="Search Results"
                    subtitle={`${searchResults.length} items found for "${searchQuery}" in ${currentLang.name}`}
                  >
                    <Table<WorkItem & Record<string, unknown>>
                      columns={searchColumns as any}
                      data={searchResults as any}
                      keyField="id"
                      emptyMessage="No results found. Try a different query."
                    />
                  </Card>
                )}

                {/* Empty state */}
                {searchResults.length === 0 && !isSearching && (
                  <Card>
                    <div className="text-center py-12">
                      <Search size={48} className="mx-auto text-text-secondary/30 mb-3" />
                      <p className="text-text-secondary">Search for construction work items</p>
                      <p className="text-text-secondary/60 text-xs mt-1">
                        Try "concrete", "steel beam", "insulation", or a work item code
                      </p>
                    </div>
                  </Card>
                )}
              </div>
            )
          }

          // ── Classification Tab ──────────────────────────
          if (activeTab === 'classify') {
            return (
              <div className="space-y-6">
                <Card
                  title="BIM Element Classification"
                  subtitle="Upload an Excel file with BIM elements to auto-classify using Gemini AI"
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div
                        className="border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors border-border hover:border-primary/50 hover:bg-surface-alt"
                        onClick={() => handleClassifyUpload()}
                      >
                        <Upload size={32} className="mx-auto text-text-secondary mb-3" />
                        <p className="font-medium text-text">Drop Excel file with BIM elements</p>
                        <p className="text-sm text-text-secondary mt-1">
                          Supports .xlsx with columns: Element Name, Type, Quantity
                        </p>
                      </div>
                    </div>
                    <div className="text-center px-6">
                      <Sparkles size={24} className="mx-auto text-primary mb-2" />
                      <p className="text-xs text-text-secondary">Powered by</p>
                      <p className="text-sm font-semibold text-text">Gemini AI</p>
                    </div>
                  </div>

                  <div className="mt-4 flex justify-end">
                    <Button
                      onClick={handleClassifyUpload}
                      loading={isClassifying}
                      icon={<Sparkles size={16} />}
                    >
                      {isClassifying ? 'Classifying with AI...' : 'Classify Elements'}
                    </Button>
                  </div>
                </Card>

                {/* Classification results */}
                {classificationResults.length > 0 && (
                  <Card
                    title="Classification Results"
                    subtitle={`${classificationResults.length} elements classified`}
                    actions={
                      <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={addClassifiedToCost}>
                        Add All to Estimate
                      </Button>
                    }
                  >
                    <Table<ClassificationResult & Record<string, unknown>>
                      columns={classifyColumns as any}
                      data={classificationResults as any}
                      keyField="elementName"
                      emptyMessage="No classification results yet"
                    />
                    <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                      <p className="text-sm text-text-secondary">
                        Total estimated cost from classification:
                      </p>
                      <p className="text-lg font-bold text-text">
                        {formatCurrency(
                          classificationResults.reduce((sum, cr) => sum + cr.quantity * cr.unitPrice, 0),
                        )}
                      </p>
                    </div>
                  </Card>
                )}
              </div>
            )
          }

          // ── Cost Calculation Tab ────────────────────────
          if (activeTab === 'estimate') {
            return (
              <div className="space-y-6">
                <Card
                  title="Cost Calculation"
                  subtitle={`${costItems.length} line items`}
                  actions={
                    <div className="flex items-center gap-2">
                      <Button variant="outline" size="sm" icon={<FileSpreadsheet size={14} />} onClick={exportToExcel}>
                        Export Excel
                      </Button>
                      <Button variant="outline" size="sm" icon={<FileText size={14} />} onClick={exportToPdf}>
                        Export PDF
                      </Button>
                    </div>
                  }
                >
                  {costItems.length === 0 ? (
                    <div className="text-center py-12">
                      <Calculator size={48} className="mx-auto text-text-secondary/30 mb-3" />
                      <p className="text-text-secondary">No items added yet</p>
                      <p className="text-text-secondary/60 text-xs mt-1">
                        Search for work items or classify BIM elements to add items
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* Cost items table */}
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="border-b border-border">
                              <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3">Code</th>
                              <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3">Description</th>
                              <th className="text-left text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3">Unit</th>
                              <th className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3">Unit Price</th>
                              <th className="text-center text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3">Quantity</th>
                              <th className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3">Total</th>
                              <th className="text-right text-xs font-semibold text-text-secondary uppercase tracking-wider px-4 py-3 w-16"></th>
                            </tr>
                          </thead>
                          <tbody>
                            {costItems.map((item) => (
                              <tr key={item.id} className="border-b border-border/50 hover:bg-surface-alt transition-colors">
                                <td className="px-4 py-3 text-sm font-mono text-primary">{item.workItem.code}</td>
                                <td className="px-4 py-3 text-sm text-text">{item.workItem.description}</td>
                                <td className="px-4 py-3"><Badge variant="default">{item.workItem.unit}</Badge></td>
                                <td className="px-4 py-3 text-sm text-text text-right">{formatCurrency(item.workItem.unitPrice)}</td>
                                <td className="px-4 py-3">
                                  <div className="flex items-center justify-center gap-1">
                                    <button
                                      onClick={() => updateQuantity(item.id, -1)}
                                      className="p-1 rounded hover:bg-surface-alt text-text-secondary"
                                    >
                                      <Minus size={14} />
                                    </button>
                                    <input
                                      type="number"
                                      value={item.quantity}
                                      onChange={(e) => setQuantityDirect(item.id, parseInt(e.target.value) || 0)}
                                      className="w-16 text-center py-1 border border-border rounded text-sm bg-surface text-text"
                                    />
                                    <button
                                      onClick={() => updateQuantity(item.id, 1)}
                                      className="p-1 rounded hover:bg-surface-alt text-text-secondary"
                                    >
                                      <Plus size={14} />
                                    </button>
                                  </div>
                                </td>
                                <td className="px-4 py-3 text-sm font-medium text-text text-right">
                                  {formatCurrency(item.total)}
                                </td>
                                <td className="px-4 py-3 text-right">
                                  <button
                                    onClick={() => removeCostItem(item.id)}
                                    className="p-1 rounded hover:bg-red-50 text-text-secondary hover:text-danger transition-colors"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* Totals */}
                      <div className="mt-4 pt-4 border-t-2 border-border">
                        <div className="flex justify-between items-center">
                          <div>
                            <p className="text-sm text-text-secondary">{costItems.length} line items</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm text-text-secondary">Grand Total</p>
                            <p className="text-2xl font-bold text-text">{formatCurrency(grandTotal)}</p>
                          </div>
                        </div>
                      </div>
                    </>
                  )}
                </Card>
              </div>
            )
          }

          // ── History Tab ─────────────────────────────────
          if (activeTab === 'history') {
            return (
              <Card
                title="Recent Estimates"
                subtitle={`${recentEstimates.length} estimates in the last 7 days`}
                actions={
                  <Button variant="outline" size="sm" icon={<Download size={14} />}>
                    Export All
                  </Button>
                }
              >
                <Table<RecentEstimate & Record<string, unknown>>
                  columns={historyColumns as any}
                  data={recentEstimates as any}
                  keyField="id"
                  emptyMessage="No recent estimates"
                />
              </Card>
            )
          }

          return null
        }}
      </Tabs>
    </div>
  )
}
