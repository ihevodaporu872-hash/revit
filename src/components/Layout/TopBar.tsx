import { useLocation } from 'react-router-dom'
import { Bell, Settings, Search } from 'lucide-react'
import { useState } from 'react'

const pageTitles: Record<string, string> = {
  '/converter': 'CAD/BIM Converter',
  '/viewer': '3D Model Viewer',
  '/cost': 'CWICR Cost Estimation',
  '/validation': 'BIM Validation',
  '/ai-analysis': 'AI Data Analysis',
  '/project': 'Project Management',
  '/documents': 'Document Control',
  '/qto': 'QTO Reports',
}

export default function TopBar() {
  const location = useLocation()
  const title = pageTitles[location.pathname] || 'Jens Platform'
  const [searchQuery, setSearchQuery] = useState('')

  return (
    <header className="h-14 bg-surface border-b border-border flex items-center justify-between px-6 shrink-0">
      <h1 className="text-lg font-semibold text-text">{title}</h1>
      <div className="flex items-center gap-3">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 text-sm border border-border rounded-lg bg-surface-alt focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary w-60"
          />
        </div>
        <button className="p-2 rounded-lg hover:bg-surface-alt transition-colors text-text-secondary">
          <Bell size={18} />
        </button>
        <button className="p-2 rounded-lg hover:bg-surface-alt transition-colors text-text-secondary">
          <Settings size={18} />
        </button>
      </div>
    </header>
  )
}
