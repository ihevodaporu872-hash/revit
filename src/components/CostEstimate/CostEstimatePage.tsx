import { useState, useMemo, useEffect, lazy, Suspense } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { fetchCostEstimates } from '../../services/supabase-api'
import { classifyVOR } from '../../services/api'
import {
  Search,
  Globe,
  Calculator,
  Clock,
  Database,
  Download,
  Sparkles,
  ChevronDown,
  ChevronRight,
  Trash2,
  Plus,
  Minus,
  BarChart3,
  Check,
  GitCompare,
  Brain,
  Loader2,
  Hammer,
  Package,
  Truck,
  Wind,
  ShieldAlert,
} from 'lucide-react'
import { VORExportButtons, EstimateExportButtons } from './VORExport'
import VORValidation from './VORValidation'
import VORAnalytics from './VORAnalytics'
import VORCompare from './VORCompare'
import SmartEstimator from './SmartEstimator'
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

interface ResourceItem {
  resource_code: string
  name: string
  unit: string
  type: string
  quantity: number
  price_per_unit: number
  total_cost: number
}

interface WorkItem {
  id: string
  code: string
  description: string
  unit: string
  unitPrice: number
  category: string
  subcategory?: string
  labor: number
  materials: number
  machines: number
  laborHours: number
  resources: ResourceItem[]
}

type SystemType = 'general' | 'smoke'

interface CostLineItem {
  id: string
  workItem: WorkItem
  quantity: number
  total: number
  labor: number
  materials: number
  machines: number
  laborHours: number
  expanded: boolean
  systemType: SystemType
}

const SYSTEM_SECTIONS: { type: SystemType; label: string; icon: typeof Wind }[] = [
  { type: 'general', label: 'Общеобменная система', icon: Wind },
  { type: 'smoke', label: 'Противодымная вентиляция', icon: ShieldAlert },
]

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

const API_BASE = (import.meta.env.VITE_API_URL || '') + '/api'

// ── Mock Data ──────────────────────────────────────────────────────────

const emptyRates = { labor: 0, materials: 0, machines: 0, laborHours: 0, resources: [] as ResourceItem[] }

const MOCK_SEARCH_RESULTS: WorkItem[] = [
  { id: 'w1', code: '03.31.13.10', description: 'Structural concrete, cast-in-place, walls, 200mm thick', unit: 'm\u00B3', unitPrice: 285.50, category: 'Concrete', subcategory: 'Cast-in-place', labor: 95.20, materials: 162.30, machines: 28.00, laborHours: 2.8, resources: [] },
  { id: 'w2', code: '03.31.13.20', description: 'Structural concrete, cast-in-place, slabs, 250mm thick', unit: 'm\u00B3', unitPrice: 312.00, category: 'Concrete', subcategory: 'Cast-in-place', labor: 104.00, materials: 178.00, machines: 30.00, laborHours: 3.1, resources: [] },
  { id: 'w3', code: '03.31.13.30', description: 'Structural concrete, cast-in-place, columns, 400x400mm', unit: 'm\u00B3', unitPrice: 445.00, category: 'Concrete', subcategory: 'Cast-in-place', labor: 178.00, materials: 221.00, machines: 46.00, laborHours: 5.2, resources: [] },
  { id: 'w4', code: '03.31.13.40', description: 'Structural concrete, cast-in-place, beams, 300x500mm', unit: 'm\u00B3', unitPrice: 398.75, category: 'Concrete', subcategory: 'Cast-in-place', labor: 159.50, materials: 199.25, machines: 40.00, laborHours: 4.7, resources: [] },
  { id: 'w5', code: '03.21.11.10', description: 'Reinforcement steel bars, Grade 60, #4 to #8', unit: 'kg', unitPrice: 1.85, category: 'Concrete', subcategory: 'Reinforcement', labor: 0.65, materials: 1.10, machines: 0.10, laborHours: 0.02, resources: [] },
  { id: 'w6', code: '04.21.13.10', description: 'Clay masonry, standard brick, running bond', unit: 'm\u00B2', unitPrice: 95.20, category: 'Masonry', subcategory: 'Clay brick', labor: 42.30, materials: 48.90, machines: 4.00, laborHours: 1.2, resources: [] },
  { id: 'w7', code: '05.12.13.10', description: 'Structural steel, wide flange beams, W12 to W18', unit: 'kg', unitPrice: 3.45, category: 'Steel', subcategory: 'Structural', labor: 1.20, materials: 2.05, machines: 0.20, laborHours: 0.03, resources: [] },
  { id: 'w8', code: '07.21.13.10', description: 'Thermal insulation, rigid board, 50mm thick', unit: 'm\u00B2', unitPrice: 28.40, category: 'Insulation', subcategory: 'Board', labor: 8.50, materials: 18.40, machines: 1.50, laborHours: 0.25, resources: [] },
  { id: 'w9', code: '09.29.10.10', description: 'Gypsum board partition, 12.5mm, single layer each side', unit: 'm\u00B2', unitPrice: 42.60, category: 'Finishes', subcategory: 'Drywall', labor: 18.90, materials: 21.70, machines: 2.00, laborHours: 0.55, resources: [] },
  { id: 'w10', code: '22.11.13.10', description: 'Water supply piping, copper, 15mm to 25mm diameter', unit: 'm', unitPrice: 38.90, category: 'Plumbing', subcategory: 'Piping', labor: 14.60, materials: 22.30, machines: 2.00, laborHours: 0.42, resources: [] },
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

  useEffect(() => {
    fetchCostEstimates()
      .then((rows) => { if (rows.length > 0) setRecentEstimates(rows as RecentEstimate[]) })
      .catch(() => {})
  }, [])

  // ── Computed values ────────────────────────────────────

  const grandTotal = useMemo(() => costItems.reduce((sum, item) => sum + item.total, 0), [costItems])
  const laborTotal = useMemo(() => costItems.reduce((sum, item) => sum + item.labor, 0), [costItems])
  const materialsTotal = useMemo(() => costItems.reduce((sum, item) => sum + item.materials, 0), [costItems])
  const machinesTotal = useMemo(() => costItems.reduce((sum, item) => sum + item.machines, 0), [costItems])
  const laborHoursTotal = useMemo(() => costItems.reduce((sum, item) => sum + item.laborHours, 0), [costItems])

  const currentLang = LANGUAGES.find((l) => l.code === language)!

  // Section collapse state
  const [collapsedSections, setCollapsedSections] = useState<Record<SystemType, boolean>>({ general: false, smoke: false })

  const toggleSection = (type: SystemType) => {
    setCollapsedSections(prev => ({ ...prev, [type]: !prev[type] }))
  }

  const sectionTotals = useMemo(() => {
    const result: Record<SystemType, { labor: number; materials: number; total: number }> = {
      general: { labor: 0, materials: 0, total: 0 },
      smoke: { labor: 0, materials: 0, total: 0 },
    }
    for (const item of costItems) {
      const s = result[item.systemType]
      s.labor += item.labor
      s.materials += item.materials
      s.total += item.total
    }
    return result
  }, [costItems])

  const changeSystemType = (itemId: string, newType: SystemType) => {
    setCostItems(prev => prev.map(ci => ci.id === itemId ? { ...ci, systemType: newType } : ci))
  }

  // Inline search for estimate tab
  const [estimateSearch, setEstimateSearch] = useState('')
  const [estimateSearchResults, setEstimateSearchResults] = useState<WorkItem[]>([])
  const [isEstimateSearching, setIsEstimateSearching] = useState(false)

  const handleEstimateSearch = async () => {
    if (!estimateSearch.trim()) return
    setIsEstimateSearching(true)
    try {
      const res = await fetch(`${API_BASE}/cwicr/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: estimateSearch, language, topK: 5 }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results && data.results.length > 0) {
          const mapped: WorkItem[] = data.results.map((r: Record<string, unknown>, i: number) => {
            const costSummary = (r.cost_summary || {}) as Record<string, unknown>
            const resources = (r.resources || []) as Record<string, unknown>[]
            const rateUnit = String(r.rate_unit || r.unit || '')
            const totalCostPosition = Number(costSummary.total_cost_position || 0)
            const unitDivisor = rateUnit.includes('100') ? 100 : 1
            const unitCost = Number(r.unit_cost || r.unitPrice || (unitDivisor > 0 ? totalCostPosition / unitDivisor : totalCostPosition) || 0)

            const mappedResources: ResourceItem[] = resources.map((res) => ({
              resource_code: String(res.resource_code || res.code || ''),
              name: String(res.name || ''),
              unit: String(res.unit || ''),
              type: String(res.type || ''),
              quantity: Number(res.quantity || 0),
              price_per_unit: Number(res.pricePerUnit || res.price || 0),
              total_cost: Number(res.quantity || 0) * Number(res.pricePerUnit || res.price || 0),
            }))

            const laborRes = mappedResources.filter(r => r.type === 'labor' || r.type === 'Labour')
            const matRes = mappedResources.filter(r => r.type === 'material' || r.type === 'Materials')
            const machRes = mappedResources.filter(r => r.type === 'machine' || r.type === 'Machines' || r.type === 'Equipment')

            const laborPerUnit = laborRes.reduce((s, r) => s + r.total_cost, 0) / unitDivisor
            const matPerUnit = matRes.reduce((s, r) => s + r.total_cost, 0) / unitDivisor
            const machPerUnit = machRes.reduce((s, r) => s + r.total_cost, 0) / unitDivisor
            const hoursPerUnit = laborRes.filter(r => r.unit === 'h' || r.unit === 'час' || r.unit === 'Std').reduce((s, r) => s + r.quantity, 0) / unitDivisor

            return {
              id: `est-${i}`,
              code: String(r.rate_code || r.code || ''),
              description: String(r.rate_name || r.name || r.description || ''),
              unit: rateUnit,
              unitPrice: unitCost,
              category: String(r.category || 'CWICR'),
              labor: laborPerUnit || Number(costSummary.labor || 0) / unitDivisor,
              materials: matPerUnit || Number(costSummary.materials || 0) / unitDivisor,
              machines: machPerUnit || Number(costSummary.machines || 0) / unitDivisor,
              laborHours: hoursPerUnit,
              resources: mappedResources,
            }
          })
          setEstimateSearchResults(mapped)
          setIsEstimateSearching(false)
          return
        }
      }
    } catch {
      // fallback
    }
    const filtered = MOCK_SEARCH_RESULTS.filter(
      (item) =>
        item.description.toLowerCase().includes(estimateSearch.toLowerCase()) ||
        item.code.includes(estimateSearch) ||
        item.category.toLowerCase().includes(estimateSearch.toLowerCase()),
    )
    setEstimateSearchResults(filtered.length > 0 ? filtered : MOCK_SEARCH_RESULTS.slice(0, 5))
    setIsEstimateSearching(false)
  }

  const addFromEstimateSearch = (workItem: WorkItem) => {
    addToCostItems(workItem)
    setEstimateSearchResults([])
    setEstimateSearch('')
  }

  // ── Handlers ───────────────────────────────────────────

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      addNotification('warning', 'Please enter a search query')
      return
    }

    setIsSearching(true)

    try {
      const res = await fetch(`${API_BASE}/cwicr/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: searchQuery, language, topK: 10 }),
      })
      if (res.ok) {
        const data = await res.json()
        if (data.results && data.results.length > 0) {
          const mapped: WorkItem[] = data.results.map((r: Record<string, unknown>, i: number) => {
            const costSummary = (r.cost_summary || {}) as Record<string, unknown>
            const resources = (r.resources || []) as Record<string, unknown>[]
            const rateUnit = String(r.rate_unit || r.unit || '')
            const totalCostPosition = Number(costSummary.total_cost_position || 0)
            const unitDivisor = rateUnit.includes('100') ? 100 : 1
            const unitCost = Number(r.unit_cost || r.unitPrice || (unitDivisor > 0 ? totalCostPosition / unitDivisor : totalCostPosition) || 0)

            const mappedResources: ResourceItem[] = resources.map((res) => ({
              resource_code: String(res.resource_code || res.code || ''),
              name: String(res.name || ''),
              unit: String(res.unit || ''),
              type: String(res.type || ''),
              quantity: Number(res.quantity || 0),
              price_per_unit: Number(res.pricePerUnit || res.price || 0),
              total_cost: Number(res.quantity || 0) * Number(res.pricePerUnit || res.price || 0),
            }))

            const laborRes = mappedResources.filter(r => r.type === 'labor' || r.type === 'Labour')
            const matRes = mappedResources.filter(r => r.type === 'material' || r.type === 'Materials')
            const machRes = mappedResources.filter(r => r.type === 'machine' || r.type === 'Machines' || r.type === 'Equipment')

            const laborPerUnit = laborRes.reduce((s, r) => s + r.total_cost, 0) / unitDivisor
            const matPerUnit = matRes.reduce((s, r) => s + r.total_cost, 0) / unitDivisor
            const machPerUnit = machRes.reduce((s, r) => s + r.total_cost, 0) / unitDivisor
            const hoursPerUnit = laborRes.filter(r => r.unit === 'h' || r.unit === 'час' || r.unit === 'Std').reduce((s, r) => s + r.quantity, 0) / unitDivisor

            return {
              id: `cwicr-${i}`,
              code: String(r.rate_code || r.code || ''),
              description: String(r.rate_name || r.name || r.description || ''),
              unit: rateUnit,
              unitPrice: unitCost,
              category: String(r.category || 'CWICR'),
              labor: laborPerUnit || Number(costSummary.labor || 0) / unitDivisor,
              materials: matPerUnit || Number(costSummary.materials || 0) / unitDivisor,
              machines: machPerUnit || Number(costSummary.machines || 0) / unitDivisor,
              laborHours: hoursPerUnit,
              resources: mappedResources,
            }
          })
          setSearchResults(mapped)
          setIsSearching(false)
          return
        }
      }
    } catch {
      // Fallback to mock
    }

    // Fallback: filter mock data based on query
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
      const newQty = existing.quantity + 1
      setCostItems((prev) =>
        prev.map((ci) =>
          ci.workItem.id === workItem.id
            ? {
                ...ci,
                quantity: newQty,
                total: newQty * ci.workItem.unitPrice,
                labor: newQty * ci.workItem.labor,
                materials: newQty * ci.workItem.materials,
                machines: newQty * ci.workItem.machines,
                laborHours: newQty * ci.workItem.laborHours,
              }
            : ci,
        ),
      )
    } else {
      setCostItems((prev) => [
        ...prev,
        {
          id: `ci-${Date.now()}`,
          workItem,
          quantity: 1,
          total: workItem.unitPrice,
          labor: workItem.labor,
          materials: workItem.materials,
          machines: workItem.machines,
          laborHours: workItem.laborHours,
          expanded: false,
          systemType: 'general',
        },
      ])
    }
    addNotification('success', `Добавлено "${workItem.code}" в расчёт`)
  }

  const updateQuantity = (itemId: string, delta: number) => {
    setCostItems((prev) =>
      prev
        .map((ci) => {
          if (ci.id !== itemId) return ci
          const newQty = Math.max(0, ci.quantity + delta)
          return {
            ...ci,
            quantity: newQty,
            total: newQty * ci.workItem.unitPrice,
            labor: newQty * ci.workItem.labor,
            materials: newQty * ci.workItem.materials,
            machines: newQty * ci.workItem.machines,
            laborHours: newQty * ci.workItem.laborHours,
          }
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
        ci.id === itemId
          ? {
              ...ci,
              quantity: qty,
              total: qty * ci.workItem.unitPrice,
              labor: qty * ci.workItem.labor,
              materials: qty * ci.workItem.materials,
              machines: qty * ci.workItem.machines,
              laborHours: qty * ci.workItem.laborHours,
            }
          : ci,
      ),
    )
  }

  const toggleExpanded = (itemId: string) => {
    setCostItems((prev) =>
      prev.map((ci) =>
        ci.id === itemId ? { ...ci, expanded: !ci.expanded } : ci,
      ),
    )
  }

  const removeCostItem = (itemId: string) => {
    setCostItems((prev) => prev.filter((ci) => ci.id !== itemId))
  }

  const handleClassifyUpload = async () => {
    if (!vorFile) {
      addNotification('warning', '\u0421\u043D\u0430\u0447\u0430\u043B\u0430 \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 Excel-\u0444\u0430\u0439\u043B \u0441 \u0412\u041E\u0420')
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
      addNotification('success', `\u041A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u043D\u043E ${mapped.length} \u0438\u0437 ${result.summary.totalRows} \u0441\u0442\u0440\u043E\u043A \u0412\u041E\u0420`)
    } catch (err: any) {
      addNotification('error', err.message || '\u041E\u0448\u0438\u0431\u043A\u0430 \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438')
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
        ...emptyRates,
      },
      quantity: cr.quantity,
      total: cr.quantity * cr.unitPrice,
      labor: 0,
      materials: 0,
      machines: 0,
      laborHours: 0,
      expanded: false,
      systemType: 'general',
    }))
    setCostItems((prev) => [...prev, ...newItems])
    addNotification('success', `Добавлено ${newItems.length} позиций в расчёт`)
  }

  // ── Column definitions ──────────────────────────────────

  const searchColumns = [
    { key: 'code', header: 'Код', render: (item: WorkItem) => (
      <span className="font-mono text-xs font-medium text-primary">{item.code}</span>
    )},
    { key: 'description', header: 'Описание', render: (item: WorkItem) => (
      <span className="text-sm">{item.description}</span>
    )},
    { key: 'unit', header: 'Ед.', render: (item: WorkItem) => (
      <Badge variant="default">{item.unit}</Badge>
    )},
    { key: 'unitPrice', header: 'Цена/ед.', render: (item: WorkItem) => (
      <span className="font-medium">{formatCurrency(item.unitPrice)}</span>
    )},
    { key: 'breakdown', header: 'Расценки', render: (item: WorkItem) => (
      <div className="flex items-center gap-2 text-xs">
        {item.labor > 0 && <span className="text-blue-500">Р: {formatCurrency(item.labor)}</span>}
        {item.materials > 0 && <span className="text-emerald-500">М: {formatCurrency(item.materials)}</span>}
        {item.machines > 0 && <span className="text-amber-500">Мех: {formatCurrency(item.machines)}</span>}
        {item.labor === 0 && item.materials === 0 && item.machines === 0 && <span className="text-muted-foreground">—</span>}
      </div>
    )},
    { key: 'category', header: 'Категория', render: (item: WorkItem) => (
      <Badge variant="primary">{item.category}</Badge>
    )},
    { key: 'actions', header: '', className: 'w-20', render: (item: WorkItem) => (
      <Button variant="ghost" size="sm" icon={<Plus size={14} />} onClick={() => addToCostItems(item)}>
        Добавить
      </Button>
    )},
  ]

  const classifyColumns = [
    { key: 'elementName', header: '\u041D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u0435', render: (cr: ClassificationResult) => (
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
    { id: 'search', label: '\u0421\u0435\u043C\u0430\u043D\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u043E\u0438\u0441\u043A', icon: <Search size={16} /> },
    { id: 'classify', label: '\u041A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0418\u0418', icon: <Sparkles size={16} /> },
    { id: 'smart', label: '\u0423\u043C\u043D\u0430\u044F \u0441\u043C\u0435\u0442\u0430', icon: <Brain size={16} /> },
    { id: 'estimate', label: '\u0420\u0430\u0441\u0447\u0451\u0442 \u0441\u043C\u0435\u0442\u044B', icon: <Calculator size={16} /> },
    { id: 'compare', label: '\u0421\u0440\u0430\u0432\u043D\u0435\u043D\u0438\u0435 \u0412\u041E\u0420', icon: <GitCompare size={16} /> },
    { id: 'history', label: '\u0418\u0441\u0442\u043E\u0440\u0438\u044F', icon: <Clock size={16} /> },
  ]

  // ── Render ──────────────────────────────────────────────

  return (
    <MotionPage>
      <div className="space-y-6">
        {/* Header */}
        <motion.div variants={fadeInUp} initial="hidden" animate="visible">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold text-foreground">\u0421\u043C\u0435\u0442\u0430 \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u0438 CWICR</h1>
          </div>
          <p className="text-muted-foreground mt-1">
            \u0421\u0435\u043C\u0430\u043D\u0442\u0438\u0447\u0435\u0441\u043A\u0438\u0439 \u043F\u043E\u0438\u0441\u043A \u043F\u043E \u0441\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u043C \u043F\u043E\u0437\u0438\u0446\u0438\u044F\u043C \u043D\u0430 9 \u044F\u0437\u044B\u043A\u0430\u0445 \u0441 BIM-\u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0435\u0439 \u043D\u0430 \u0431\u0430\u0437\u0435 \u0418\u0418
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
          <StatCard label="\u0421\u0442\u0430\u0442\u0443\u0441 \u0431\u0430\u0437\u044B" value="\u0410\u043A\u0442\u0438\u0432\u043D\u0430" icon={Database} color="primary" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="\u042F\u0437\u044B\u043A\u0438" value={LANGUAGES.length} icon={Globe} color="success" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="\u0421\u0440\u0435\u0434\u043D\u0435\u0435 \u0432\u0440\u0435\u043C\u044F \u043E\u0442\u0432\u0435\u0442\u0430" value="0.3s" icon={Clock} color="warning" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="\u0421\u043C\u0435\u0442 \u0441\u0435\u0433\u043E\u0434\u043D\u044F" value={7} icon={BarChart3} color="primary" trend={{ value: 15, label: '\u043A \u0432\u0447\u0435\u0440\u0430' }} />
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
                        placeholder="\u041F\u043E\u0438\u0441\u043A \u043F\u043E\u0437\u0438\u0446\u0438\u0439... \u043D\u0430\u043F\u0440\u0438\u043C\u0435\u0440: '\u0431\u0435\u0442\u043E\u043D\u043D\u0430\u044F \u0441\u0442\u0435\u043D\u0430', '\u0431\u0430\u043B\u043A\u0430', '03.31'"
                        className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                      />
                    </div>

                    <Button onClick={handleSearch} loading={isSearching} icon={<Search size={16} />}>
                      \u041D\u0430\u0439\u0442\u0438
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
                        title="\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043F\u043E\u0438\u0441\u043A\u0430"
                        subtitle={`${searchResults.length} \u043D\u0430\u0439\u0434\u0435\u043D\u043E \u043F\u043E \u0437\u0430\u043F\u0440\u043E\u0441\u0443 "${searchQuery}" \u043D\u0430 \u044F\u0437\u044B\u043A\u0435 ${currentLang.name}`}
                        hover
                      >
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                          <Table<WorkItem & Record<string, unknown>>
                            columns={searchColumns as any}
                            data={searchResults as any}
                            keyField="id"
                            emptyMessage="\u041D\u0438\u0447\u0435\u0433\u043E \u043D\u0435 \u043D\u0430\u0439\u0434\u0435\u043D\u043E. \u041F\u043E\u043F\u0440\u043E\u0431\u0443\u0439\u0442\u0435 \u0434\u0440\u0443\u0433\u043E\u0439 \u0437\u0430\u043F\u0440\u043E\u0441."
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
                        <p className="text-muted-foreground">\u0412\u044B\u043F\u043E\u043B\u043D\u0438\u0442\u0435 \u043F\u043E\u0438\u0441\u043A \u0441\u0442\u0440\u043E\u0438\u0442\u0435\u043B\u044C\u043D\u044B\u0445 \u043F\u043E\u0437\u0438\u0446\u0438\u0439</p>
                        <p className="text-muted-foreground/60 text-xs mt-1">
                          \u041F\u0440\u0438\u043C\u0435\u0440: "\u0431\u0435\u0442\u043E\u043D", "\u0431\u0430\u043B\u043A\u0430", "\u0443\u0442\u0435\u043F\u043B\u0435\u043D\u0438\u0435" \u0438\u043B\u0438 \u043A\u043E\u0434 \u043F\u043E\u0437\u0438\u0446\u0438\u0438
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
                  title="\u041A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0412\u041E\u0420 (\u0440\u0430\u0431\u043E\u0442\u044B \u0438 \u043C\u0430\u0442\u0435\u0440\u0438\u0430\u043B\u044B)"
                  subtitle="\u0417\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u0435 Excel-\u0444\u0430\u0439\u043B \u0441 \u0412\u041E\u0420 \u0434\u043B\u044F \u0430\u0432\u0442\u043E-\u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438 \u0447\u0435\u0440\u0435\u0437 Gemini AI + CWICR"
                  hover
                >
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <FileUpload
                        accept=".xlsx,.xls"
                        onFilesSelected={(files) => setVorFile(files[0] || null)}
                        label="\u041F\u0435\u0440\u0435\u0442\u0430\u0449\u0438\u0442\u0435 Excel-\u0444\u0430\u0439\u043B \u0441 \u0412\u041E\u0420"
                        description="\u041F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430 .xlsx \u0438 .xls \u2014 \u043D\u0430\u0438\u043C\u0435\u043D\u043E\u0432\u0430\u043D\u0438\u044F \u0440\u0430\u0431\u043E\u0442, \u0435\u0434\u0438\u043D\u0438\u0446\u044B, \u043E\u0431\u044A\u0451\u043C\u044B"
                      />
                    </div>
                    <div className="text-center px-6">
                      <Sparkles size={24} className="mx-auto text-primary mb-2" />
                      <p className="text-xs text-muted-foreground">\u0420\u0430\u0431\u043E\u0442\u0430\u0435\u0442 \u043D\u0430</p>
                      <p className="text-sm font-semibold text-foreground">Gemini AI</p>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-end gap-3">
                    <Button
                      onClick={handleClassifyUpload}
                      loading={isClassifying}
                      disabled={!vorFile}
                      icon={<Sparkles size={16} />}
                    >
                      {isClassifying ? '\u041A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u044F \u0418\u0418...' : '\u041A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0412\u041E\u0420'}
                    </Button>
                  </div>
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
                        title="\u0420\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u044B \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438"
                        subtitle={`\u041A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u0446\u0438\u0440\u043E\u0432\u0430\u043D\u043E \u0441\u0442\u0440\u043E\u043A \u0412\u041E\u0420: ${classificationResults.length}`}
                        hover
                        actions={
                          <div className="flex items-center gap-2">
                            <VORExportButtons results={classificationResults} />
                            <Button variant="primary" size="sm" icon={<Plus size={14} />} onClick={addClassifiedToCost}>
                              \u0414\u043E\u0431\u0430\u0432\u0438\u0442\u044C \u0432\u0441\u0451 \u0432 \u0441\u043C\u0435\u0442\u0443
                            </Button>
                          </div>
                        }
                      >
                        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                          <Table<ClassificationResult & Record<string, unknown>>
                            columns={classifyColumns as any}
                            data={classificationResults as any}
                            keyField="elementName"
                            emptyMessage="\u041F\u043E\u043A\u0430 \u043D\u0435\u0442 \u0440\u0435\u0437\u0443\u043B\u044C\u0442\u0430\u0442\u043E\u0432 \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438"
                          />
                        </motion.div>
                        <div className="mt-4 pt-4 border-t border-border flex justify-between items-center">
                          <p className="text-sm text-muted-foreground">
                            \u041E\u0431\u0449\u0430\u044F \u0441\u0442\u043E\u0438\u043C\u043E\u0441\u0442\u044C \u043F\u043E \u043A\u043B\u0430\u0441\u0441\u0438\u0444\u0438\u043A\u0430\u0446\u0438\u0438:
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

          // ── Smart Estimator Tab ──────────────────────────
          if (activeTab === 'smart') {
            return <SmartEstimator language={language} />
          }

          // ── Compare Tab ─────────────────────────────────
          if (activeTab === 'compare') {
            return <VORCompare />
          }

          // ── Cost Calculation Tab ────────────────────────
          if (activeTab === 'estimate') {
            return (
              <div className="space-y-6">
                {/* Summary Cards */}
                {costItems.length > 0 && (
                  <motion.div
                    className="grid grid-cols-2 lg:grid-cols-5 gap-3"
                    variants={staggerContainer}
                    initial="hidden"
                    animate="visible"
                  >
                    <motion.div variants={fadeInUp}>
                      <div className="p-4 bg-card rounded-lg border border-border">
                        <p className="text-xs text-muted-foreground">Общая стоимость</p>
                        <motion.p
                          key={grandTotal}
                          initial={{ opacity: 0, scale: 0.9 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={springTransition}
                          className="text-xl font-bold text-foreground"
                        >
                          {formatCurrency(grandTotal)}
                        </motion.p>
                      </div>
                    </motion.div>
                    <motion.div variants={fadeInUp}>
                      <div className="p-4 bg-card rounded-lg border border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Hammer size={12} className="text-blue-500" />
                          <p className="text-xs text-muted-foreground">Работа</p>
                        </div>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(laborTotal)}</p>
                        {grandTotal > 0 && <p className="text-xs text-muted-foreground">{((laborTotal / grandTotal) * 100).toFixed(0)}%</p>}
                      </div>
                    </motion.div>
                    <motion.div variants={fadeInUp}>
                      <div className="p-4 bg-card rounded-lg border border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Package size={12} className="text-emerald-500" />
                          <p className="text-xs text-muted-foreground">Материалы</p>
                        </div>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(materialsTotal)}</p>
                        {grandTotal > 0 && <p className="text-xs text-muted-foreground">{((materialsTotal / grandTotal) * 100).toFixed(0)}%</p>}
                      </div>
                    </motion.div>
                    <motion.div variants={fadeInUp}>
                      <div className="p-4 bg-card rounded-lg border border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Truck size={12} className="text-amber-500" />
                          <p className="text-xs text-muted-foreground">Механизмы</p>
                        </div>
                        <p className="text-lg font-bold text-foreground">{formatCurrency(machinesTotal)}</p>
                        {grandTotal > 0 && <p className="text-xs text-muted-foreground">{((machinesTotal / grandTotal) * 100).toFixed(0)}%</p>}
                      </div>
                    </motion.div>
                    <motion.div variants={fadeInUp}>
                      <div className="p-4 bg-card rounded-lg border border-border">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Clock size={12} className="text-violet-500" />
                          <p className="text-xs text-muted-foreground">Трудозатраты</p>
                        </div>
                        <p className="text-lg font-bold text-foreground">{laborHoursTotal.toFixed(1)} ч</p>
                      </div>
                    </motion.div>
                  </motion.div>
                )}

                {/* Inline Search */}
                <Card hover>
                  <div className="flex gap-3">
                    <div className="flex-1 relative">
                      <Search size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <input
                        type="text"
                        value={estimateSearch}
                        onChange={(e) => setEstimateSearch(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleEstimateSearch()}
                        placeholder="Найти и добавить расценку... например: 'бетонная стена', 'штукатурка', '03.31'"
                        className="w-full pl-10 pr-4 py-2.5 border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary text-sm"
                      />
                    </div>
                    <Button onClick={handleEstimateSearch} loading={isEstimateSearching} icon={<Search size={16} />}>
                      Найти
                    </Button>
                  </div>

                  {/* Inline search results dropdown */}
                  <AnimatePresence>
                    {estimateSearchResults.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="mt-3 border border-border rounded-lg overflow-hidden"
                      >
                        {estimateSearchResults.map((item) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/80 transition-colors border-b border-border/50 last:border-b-0 cursor-pointer"
                            onClick={() => addFromEstimateSearch(item)}
                          >
                            <span className="font-mono text-xs text-primary min-w-[100px]">{item.code}</span>
                            <span className="text-sm text-foreground flex-1 truncate">{item.description}</span>
                            <Badge variant="default">{item.unit}</Badge>
                            <span className="text-sm font-medium text-foreground min-w-[80px] text-right">{formatCurrency(item.unitPrice)}</span>
                            {(item.labor > 0 || item.materials > 0) && (
                              <div className="flex items-center gap-2 text-xs text-muted-foreground min-w-[180px]">
                                {item.labor > 0 && <span className="text-blue-500">Р: {formatCurrency(item.labor)}</span>}
                                {item.materials > 0 && <span className="text-emerald-500">М: {formatCurrency(item.materials)}</span>}
                                {item.machines > 0 && <span className="text-amber-500">Мех: {formatCurrency(item.machines)}</span>}
                              </div>
                            )}
                            <Plus size={16} className="text-primary shrink-0" />
                          </div>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>

                {/* Cost items grouped by system */}
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
                          Используйте поиск выше, чтобы найти и добавить расценки
                        </p>
                      </div>
                    </motion.div>
                  ) : (
                    <>
                      <div className="space-y-4">
                        {SYSTEM_SECTIONS.map((section) => {
                          const sectionItems = costItems.filter(ci => ci.systemType === section.type)
                          const totals = sectionTotals[section.type]
                          const isCollapsed = collapsedSections[section.type]
                          const SectionIcon = section.icon

                          return (
                            <div key={section.type} className="border border-border rounded-lg overflow-hidden">
                              {/* Accordion Header */}
                              <button
                                onClick={() => toggleSection(section.type)}
                                className="w-full flex items-center gap-3 px-4 py-3 bg-muted/50 hover:bg-muted transition-colors"
                              >
                                <div className="flex items-center gap-2 shrink-0">
                                  {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                                  <SectionIcon size={18} className={section.type === 'general' ? 'text-blue-500' : 'text-orange-500'} />
                                  <span className="font-semibold text-foreground">{section.label}</span>
                                  <Badge variant="default">{sectionItems.length}</Badge>
                                </div>
                                <div className="flex-1" />
                                <div className="flex items-center gap-4 text-right">
                                  <span className="text-xs text-muted-foreground">
                                    Работа: <span className="font-medium text-blue-500">{formatCurrency(totals.labor)}</span>
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    Мат-лы: <span className="font-medium text-emerald-500">{formatCurrency(totals.materials)}</span>
                                  </span>
                                  <span className="text-sm font-bold text-foreground">
                                    Итого: {formatCurrency(totals.total)}
                                  </span>
                                </div>
                              </button>

                              {/* Accordion Body */}
                              <AnimatePresence initial={false}>
                                {!isCollapsed && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    {sectionItems.length === 0 ? (
                                      <div className="text-center py-8 text-muted-foreground text-sm">
                                        Нет позиций в этом разделе
                                      </div>
                                    ) : (
                                      <div className="overflow-x-auto">
                                        <table className="w-full">
                                          <thead>
                                            <tr className="border-b border-border">
                                              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3 w-8"></th>
                                              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Код</th>
                                              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Описание</th>
                                              <th className="text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Ед.</th>
                                              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Цена/ед.</th>
                                              <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Кол-во</th>
                                              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">
                                                <span className="flex items-center justify-end gap-1"><Hammer size={12} className="text-blue-500" />Работа</span>
                                              </th>
                                              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">
                                                <span className="flex items-center justify-end gap-1"><Package size={12} className="text-emerald-500" />Мат-лы</span>
                                              </th>
                                              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">
                                                <span className="flex items-center justify-end gap-1"><Truck size={12} className="text-amber-500" />Мех.</span>
                                              </th>
                                              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3">Итого</th>
                                              <th className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3 w-20">Раздел</th>
                                              <th className="text-right text-xs font-semibold text-muted-foreground uppercase tracking-wider px-3 py-3 w-10"></th>
                                            </tr>
                                          </thead>
                                          <AnimatePresence mode="popLayout">
                                            <motion.tbody
                                              variants={staggerContainer}
                                              initial="hidden"
                                              animate="visible"
                                            >
                                              {sectionItems.map((item) => (
                                                <>
                                                  <motion.tr
                                                    key={item.id}
                                                    variants={listItem}
                                                    initial="hidden"
                                                    animate="visible"
                                                    exit="exit"
                                                    layout
                                                    className="border-b border-border/50 hover:bg-muted transition-colors"
                                                  >
                                                    <td className="px-3 py-3">
                                                      {item.workItem.resources.length > 0 && (
                                                        <button
                                                          onClick={() => toggleExpanded(item.id)}
                                                          className="p-0.5 rounded hover:bg-muted text-muted-foreground"
                                                        >
                                                          {item.expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                                                        </button>
                                                      )}
                                                    </td>
                                                    <td className="px-3 py-3 text-sm font-mono text-primary">{item.workItem.code}</td>
                                                    <td className="px-3 py-3 text-sm text-foreground">{item.workItem.description}</td>
                                                    <td className="px-3 py-3"><Badge variant="default">{item.workItem.unit}</Badge></td>
                                                    <td className="px-3 py-3 text-sm text-foreground text-right">{formatCurrency(item.workItem.unitPrice)}</td>
                                                    <td className="px-3 py-3">
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
                                                          onChange={(e) => setQuantityDirect(item.id, parseFloat(e.target.value) || 0)}
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
                                                    <td className="px-3 py-3 text-sm text-blue-500 text-right">{item.labor > 0 ? formatCurrency(item.labor) : '—'}</td>
                                                    <td className="px-3 py-3 text-sm text-emerald-500 text-right">{item.materials > 0 ? formatCurrency(item.materials) : '—'}</td>
                                                    <td className="px-3 py-3 text-sm text-amber-500 text-right">{item.machines > 0 ? formatCurrency(item.machines) : '—'}</td>
                                                    <td className="px-3 py-3 text-sm font-medium text-foreground text-right">
                                                      {formatCurrency(item.total)}
                                                    </td>
                                                    <td className="px-3 py-3 text-center">
                                                      <select
                                                        value={item.systemType}
                                                        onChange={(e) => changeSystemType(item.id, e.target.value as SystemType)}
                                                        className="text-xs px-1.5 py-1 border border-border rounded bg-card text-foreground cursor-pointer"
                                                      >
                                                        {SYSTEM_SECTIONS.map(s => (
                                                          <option key={s.type} value={s.type}>
                                                            {s.type === 'general' ? 'ОВ' : 'ПД'}
                                                          </option>
                                                        ))}
                                                      </select>
                                                    </td>
                                                    <td className="px-3 py-3 text-right">
                                                      <button
                                                        onClick={() => removeCostItem(item.id)}
                                                        className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                                                      >
                                                        <Trash2 size={14} />
                                                      </button>
                                                    </td>
                                                  </motion.tr>
                                                  {/* Expanded resource rows */}
                                                  {item.expanded && item.workItem.resources.length > 0 && (
                                                    <motion.tr
                                                      key={`${item.id}-resources`}
                                                      initial={{ opacity: 0, height: 0 }}
                                                      animate={{ opacity: 1, height: 'auto' }}
                                                      exit={{ opacity: 0, height: 0 }}
                                                    >
                                                      <td colSpan={12} className="px-3 py-0">
                                                        <div className="ml-8 my-2 rounded-lg border border-border/50 bg-muted/30 overflow-hidden">
                                                          <table className="w-full">
                                                            <thead>
                                                              <tr className="border-b border-border/30">
                                                                <th className="text-left text-xs text-muted-foreground px-3 py-1.5">Код ресурса</th>
                                                                <th className="text-left text-xs text-muted-foreground px-3 py-1.5">Наименование</th>
                                                                <th className="text-left text-xs text-muted-foreground px-3 py-1.5">Тип</th>
                                                                <th className="text-left text-xs text-muted-foreground px-3 py-1.5">Ед.</th>
                                                                <th className="text-right text-xs text-muted-foreground px-3 py-1.5">Расход</th>
                                                                <th className="text-right text-xs text-muted-foreground px-3 py-1.5">Цена</th>
                                                                <th className="text-right text-xs text-muted-foreground px-3 py-1.5">Стоимость</th>
                                                              </tr>
                                                            </thead>
                                                            <tbody>
                                                              {item.workItem.resources.map((r, ri) => {
                                                                const scaledQty = r.quantity * item.quantity
                                                                const scaledCost = scaledQty * r.price_per_unit
                                                                const typeColor = (r.type === 'labor' || r.type === 'Labour') ? 'text-blue-500'
                                                                  : (r.type === 'material' || r.type === 'Materials') ? 'text-emerald-500'
                                                                  : 'text-amber-500'
                                                                const typeLabel = (r.type === 'labor' || r.type === 'Labour') ? 'Работа'
                                                                  : (r.type === 'material' || r.type === 'Materials') ? 'Материал'
                                                                  : 'Механизм'
                                                                return (
                                                                  <tr key={ri} className="border-b border-border/20 last:border-b-0">
                                                                    <td className="px-3 py-1.5 text-xs font-mono text-muted-foreground">{r.resource_code}</td>
                                                                    <td className="px-3 py-1.5 text-xs text-foreground">{r.name}</td>
                                                                    <td className={`px-3 py-1.5 text-xs font-medium ${typeColor}`}>{typeLabel}</td>
                                                                    <td className="px-3 py-1.5 text-xs text-muted-foreground">{r.unit}</td>
                                                                    <td className="px-3 py-1.5 text-xs text-foreground text-right">{scaledQty.toFixed(3)}</td>
                                                                    <td className="px-3 py-1.5 text-xs text-foreground text-right">{formatCurrency(r.price_per_unit)}</td>
                                                                    <td className={`px-3 py-1.5 text-xs font-medium text-right ${typeColor}`}>{formatCurrency(scaledCost)}</td>
                                                                  </tr>
                                                                )
                                                              })}
                                                            </tbody>
                                                          </table>
                                                        </div>
                                                      </td>
                                                    </motion.tr>
                                                  )}
                                                </>
                                              ))}
                                            </motion.tbody>
                                          </AnimatePresence>
                                          <tfoot>
                                            <tr className="border-t-2 border-border bg-muted/30">
                                              <td colSpan={6} className="px-3 py-2.5 text-xs font-semibold text-muted-foreground text-right">Итого по разделу:</td>
                                              <td className="px-3 py-2.5 text-xs font-bold text-blue-500 text-right">{formatCurrency(totals.labor)}</td>
                                              <td className="px-3 py-2.5 text-xs font-bold text-emerald-500 text-right">{formatCurrency(totals.materials)}</td>
                                              <td className="px-3 py-2.5 text-xs font-bold text-amber-500 text-right">
                                                {formatCurrency(totals.total - totals.labor - totals.materials)}
                                              </td>
                                              <td className="px-3 py-2.5 text-sm font-bold text-foreground text-right">{formatCurrency(totals.total)}</td>
                                              <td colSpan={2}></td>
                                            </tr>
                                          </tfoot>
                                        </table>
                                      </div>
                                    )}
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          )
                        })}
                      </div>

                      {/* Bottom summary */}
                      <div className="mt-4 pt-4 border-t-2 border-border">
                        <div className="flex justify-between items-center">
                          <div className="flex items-center gap-4 text-sm text-muted-foreground">
                            <span>{costItems.length} позиций</span>
                            {laborHoursTotal > 0 && <span>Трудозатраты: {laborHoursTotal.toFixed(1)} ч</span>}
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

          // ── History Tab ─────────────────────────────────
          if (activeTab === 'history') {
            return (
              <Card
                title="\u041F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 \u0441\u043C\u0435\u0442\u044B"
                subtitle={`\u0421\u043C\u0435\u0442 \u0437\u0430 \u043F\u043E\u0441\u043B\u0435\u0434\u043D\u0438\u0435 7 \u0434\u043D\u0435\u0439: ${recentEstimates.length}`}
                hover
                actions={
                  <Button variant="outline" size="sm" icon={<Download size={14} />}>
                    \u042D\u043A\u0441\u043F\u043E\u0440\u0442 \u0432\u0441\u0435\u0433\u043E
                  </Button>
                }
              >
                <motion.div variants={staggerContainer} initial="hidden" animate="visible">
                  <Table<RecentEstimate & Record<string, unknown>>
                    columns={historyColumns as any}
                    data={recentEstimates as any}
                    keyField="id"
                    emptyMessage="\u0418\u0441\u0442\u043E\u0440\u0438\u044F \u0441\u043C\u0435\u0442 \u043F\u043E\u043A\u0430 \u043F\u0443\u0441\u0442\u0430"
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
