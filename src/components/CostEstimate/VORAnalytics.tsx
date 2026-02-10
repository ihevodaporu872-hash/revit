import { useMemo } from 'react'
import { motion } from 'framer-motion'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { TrendingUp, Layers, DollarSign, BarChart3 } from 'lucide-react'
import { Card, StatCard } from '../ui/Card'
import { formatCurrency } from '../../lib/utils'
import { staggerContainer, fadeInUp } from '../../lib/animations'

interface ClassificationResult {
  elementName: string
  matchedCode: string
  matchedDescription: string
  confidence: number
  unit: string
  unitPrice: number
  quantity: number
}

interface VORAnalyticsProps {
  results: ClassificationResult[]
}

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#7c3aed', '#5b21b6', '#4f46e5', '#4338ca', '#3730a3']

export default function VORAnalytics({ results }: VORAnalyticsProps) {
  const analytics = useMemo(() => {
    if (results.length === 0) return null

    const totalCost = results.reduce((s, r) => s + r.quantity * r.unitPrice, 0)
    const avgConfidence = results.reduce((s, r) => s + r.confidence, 0) / results.length

    // Category breakdown
    const categoryMap = new Map<string, { count: number; total: number }>()
    results.forEach(r => {
      const prefix = r.matchedCode.split(' ')[0] || r.matchedCode.substring(0, 2)
      const existing = categoryMap.get(prefix) || { count: 0, total: 0 }
      existing.count++
      existing.total += r.quantity * r.unitPrice
      categoryMap.set(prefix, existing)
    })

    const pieData = Array.from(categoryMap.entries())
      .map(([name, { total }]) => ({ name: `Кат. ${name}`, value: Math.round(total) }))
      .sort((a, b) => b.value - a.value)
      .slice(0, 10)

    // Top-10 most expensive items
    const barData = results
      .map(r => ({
        name: r.elementName.length > 30 ? r.elementName.substring(0, 30) + '…' : r.elementName,
        cost: Math.round(r.quantity * r.unitPrice),
      }))
      .sort((a, b) => b.cost - a.cost)
      .slice(0, 10)

    const uniqueCategories = categoryMap.size

    return { totalCost, avgConfidence, pieData, barData, uniqueCategories }
  }, [results])

  if (!analytics) return null

  return (
    <motion.div variants={fadeInUp} initial="hidden" animate="visible" className="space-y-6">
      {/* Stats */}
      <motion.div
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
      >
        <motion.div variants={fadeInUp}>
          <StatCard label="Общая стоимость" value={formatCurrency(analytics.totalCost)} icon={DollarSign} color="primary" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="Позиций" value={results.length} icon={Layers} color="success" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard label="Категорий" value={analytics.uniqueCategories} icon={BarChart3} color="warning" />
        </motion.div>
        <motion.div variants={fadeInUp}>
          <StatCard
            label="Средняя точность"
            value={`${Math.round(analytics.avgConfidence * 100)}%`}
            icon={TrendingUp}
            color="primary"
          />
        </motion.div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pie Chart — Cost by Category */}
        <Card title="Стоимость по категориям" hover>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={analytics.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {analytics.pieData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                />
                <Legend
                  wrapperStyle={{ fontSize: '12px', color: 'hsl(var(--muted-foreground))' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        {/* Bar Chart — Top 10 Expensive */}
        <Card title="Топ-10 дорогих позиций" hover>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={analytics.barData} layout="vertical" margin={{ left: 10, right: 20 }}>
                <XAxis
                  type="number"
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)}
                  stroke="hsl(var(--muted-foreground))"
                  fontSize={11}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={120}
                  tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                />
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: '8px', color: 'hsl(var(--foreground))' }}
                />
                <Bar dataKey="cost" fill="#6366f1" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </motion.div>
  )
}
