import { FileSpreadsheet, FileText } from 'lucide-react'
import { Button } from '../ui/Button'
import { formatCurrency } from '../../lib/utils'

// ── Types ──────────────────────────────────────────────────────────────

interface ClassificationResult {
  elementName: string
  matchedCode: string
  matchedDescription: string
  confidence: number
  unit: string
  unitPrice: number
  quantity: number
}

interface CostLineItem {
  id: string
  workItem: {
    code: string
    description: string
    unit: string
    unitPrice: number
    category: string
  }
  quantity: number
  total: number
}

// ── Utilities ──────────────────────────────────────────────────────────

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function downloadBlob(content: string | ArrayBuffer, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function openPrintWindow(html: string) {
  const win = window.open('', '_blank')
  if (win) {
    win.document.write(html)
    win.document.close()
  }
}

// ── VOR Classification Export ──────────────────────────────────────────

interface VORExportButtonsProps {
  results: ClassificationResult[]
}

export function VORExportButtons({ results }: VORExportButtonsProps) {
  if (results.length === 0) return null

  const exportClassificationExcel = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    // Sheet 1: Classification data
    const data = results.map((r, i) => ({
      '№': i + 1,
      'Наименование': r.elementName,
      'Код CWICR': r.matchedCode,
      'Описание': r.matchedDescription,
      'Достоверность': `${Math.round(r.confidence * 100)}%`,
      'Ед.': r.unit,
      'Цена за ед.': r.unitPrice,
      'Кол-во': r.quantity,
      'Итого': Math.round(r.quantity * r.unitPrice * 100) / 100,
    }))
    const ws1 = XLSX.utils.json_to_sheet(data)
    ws1['!cols'] = [
      { wch: 5 }, { wch: 40 }, { wch: 14 }, { wch: 40 },
      { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 14 },
    ]
    XLSX.utils.book_append_sheet(wb, ws1, 'Классификация')

    // Sheet 2: Category summary
    const categories = new Map<string, { count: number; total: number }>()
    results.forEach(r => {
      const cat = r.matchedCode.split(' ')[0] || 'Другое'
      const existing = categories.get(cat) || { count: 0, total: 0 }
      existing.count++
      existing.total += r.quantity * r.unitPrice
      categories.set(cat, existing)
    })
    const summaryData = Array.from(categories.entries()).map(([cat, { count, total }]) => ({
      'Категория (код)': cat,
      'Позиций': count,
      'Сумма': Math.round(total * 100) / 100,
    }))
    const grandTotal = results.reduce((s, r) => s + r.quantity * r.unitPrice, 0)
    summaryData.push({ 'Категория (код)': 'ИТОГО', 'Позиций': results.length, 'Сумма': Math.round(grandTotal * 100) / 100 })
    const ws2 = XLSX.utils.json_to_sheet(summaryData)
    ws2['!cols'] = [{ wch: 18 }, { wch: 10 }, { wch: 16 }]
    XLSX.utils.book_append_sheet(wb, ws2, 'Сводка')

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(buffer, `vor-classification-${Date.now()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  const exportClassificationPdf = () => {
    const total = results.reduce((s, r) => s + r.quantity * r.unitPrice, 0)
    const rows = results.map((r, i) =>
      `<tr><td>${i + 1}</td><td>${escapeHtml(r.elementName)}</td><td class="mono">${escapeHtml(r.matchedCode)}</td><td>${escapeHtml(r.matchedDescription)}</td><td>${Math.round(r.confidence * 100)}%</td><td>${escapeHtml(r.unit)}</td><td class="num">${formatCurrency(r.unitPrice)}</td><td class="num">${r.quantity}</td><td class="num">${formatCurrency(r.quantity * r.unitPrice)}</td></tr>`
    ).join('\n')

    const html = `<!DOCTYPE html><html><head><title>Классификация ВОР — Jens</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:2rem;color:#1a1a2e;max-width:1200px;margin:0 auto}
h1{font-size:1.5rem;margin-bottom:0.25rem}h2{font-size:0.9rem;color:#666;font-weight:400;margin-bottom:1.5rem}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
th{background:#f0f0f5;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px}
tr:nth-child(even){background:#f8f8fc}
.mono{font-family:monospace;font-size:12px;color:#6366f1}
.num{text-align:right;font-variant-numeric:tabular-nums}
tfoot td{font-weight:700;background:#f0f0f5;border-top:2px solid #999}
.footer{margin-top:2rem;font-size:11px;color:#999}
@media print{body{padding:0.5cm}}
</style></head><body>
<h1>Классификация ВОР</h1>
<h2>Jens Construction Platform | ${new Date().toLocaleDateString('ru-RU')} | ${results.length} позиций</h2>
<table><thead><tr><th>№</th><th>Наименование</th><th>Код</th><th>Описание</th><th>%</th><th>Ед.</th><th>Цена</th><th>Кол-во</th><th>Итого</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="8" style="text-align:right">Общий итог</td><td class="num">${formatCurrency(total)}</td></tr></tfoot>
</table>
<p class="footer">Сгенерировано Jens Construction Platform</p>
</body></html>`
    openPrintWindow(html)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" icon={<FileSpreadsheet size={14} />} onClick={exportClassificationExcel}>
        Excel
      </Button>
      <Button variant="outline" size="sm" icon={<FileText size={14} />} onClick={exportClassificationPdf}>
        PDF
      </Button>
    </div>
  )
}

// ── Cost Estimate Export ───────────────────────────────────────────────

interface EstimateExportButtonsProps {
  costItems: CostLineItem[]
  grandTotal: number
}

export function EstimateExportButtons({ costItems, grandTotal }: EstimateExportButtonsProps) {
  if (costItems.length === 0) return null

  const exportEstimateExcel = async () => {
    const XLSX = await import('xlsx')
    const wb = XLSX.utils.book_new()

    const data = costItems.map((item, i) => ({
      '№': i + 1,
      'Код': item.workItem.code,
      'Описание': item.workItem.description,
      'Ед.': item.workItem.unit,
      'Цена за ед.': item.workItem.unitPrice,
      'Кол-во': item.quantity,
      'Итого': Math.round(item.total * 100) / 100,
    }))
    data.push({ '№': '' as any, 'Код': '', 'Описание': 'ИТОГО', 'Ед.': '', 'Цена за ед.': '' as any, 'Кол-во': '' as any, 'Итого': Math.round(grandTotal * 100) / 100 })

    const ws = XLSX.utils.json_to_sheet(data)
    ws['!cols'] = [{ wch: 5 }, { wch: 14 }, { wch: 45 }, { wch: 8 }, { wch: 14 }, { wch: 10 }, { wch: 14 }]
    XLSX.utils.book_append_sheet(wb, ws, 'Смета')

    const buffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' })
    downloadBlob(buffer, `cost-estimate-${Date.now()}.xlsx`, 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
  }

  const exportEstimatePdf = () => {
    const rows = costItems.map((item, i) =>
      `<tr><td>${i + 1}</td><td class="mono">${escapeHtml(item.workItem.code)}</td><td>${escapeHtml(item.workItem.description)}</td><td>${escapeHtml(item.workItem.unit)}</td><td class="num">${formatCurrency(item.workItem.unitPrice)}</td><td class="num">${item.quantity}</td><td class="num">${formatCurrency(item.total)}</td></tr>`
    ).join('\n')

    const html = `<!DOCTYPE html><html><head><title>Смета — Jens</title>
<style>
body{font-family:system-ui,-apple-system,sans-serif;padding:2rem;color:#1a1a2e;max-width:1100px;margin:0 auto}
h1{font-size:1.5rem;margin-bottom:0.25rem}h2{font-size:0.9rem;color:#666;font-weight:400;margin-bottom:1.5rem}
table{width:100%;border-collapse:collapse;font-size:13px}
th,td{border:1px solid #ddd;padding:6px 10px;text-align:left}
th{background:#f0f0f5;font-weight:600;font-size:11px;text-transform:uppercase;letter-spacing:0.5px}
tr:nth-child(even){background:#f8f8fc}
.mono{font-family:monospace;font-size:12px;color:#6366f1}
.num{text-align:right;font-variant-numeric:tabular-nums}
tfoot td{font-weight:700;background:#f0f0f5;border-top:2px solid #999}
.footer{margin-top:2rem;font-size:11px;color:#999}
@media print{body{padding:0.5cm}}
</style></head><body>
<h1>Смета стоимости</h1>
<h2>Jens Construction Platform | ${new Date().toLocaleDateString('ru-RU')} | ${costItems.length} позиций</h2>
<table><thead><tr><th>№</th><th>Код</th><th>Описание</th><th>Ед.</th><th>Цена</th><th>Кол-во</th><th>Итого</th></tr></thead>
<tbody>${rows}</tbody>
<tfoot><tr><td colspan="6" style="text-align:right">Общий итог</td><td class="num">${formatCurrency(grandTotal)}</td></tr></tfoot>
</table>
<p class="footer">Сгенерировано Jens Construction Platform</p>
</body></html>`
    openPrintWindow(html)
  }

  return (
    <div className="flex items-center gap-2">
      <Button variant="outline" size="sm" icon={<FileSpreadsheet size={14} />} onClick={exportEstimateExcel}>
        Экспорт Excel
      </Button>
      <Button variant="outline" size="sm" icon={<FileText size={14} />} onClick={exportEstimatePdf}>
        Экспорт PDF
      </Button>
    </div>
  )
}
