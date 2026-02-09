import { useLocation } from 'react-router-dom'
import { Bell, Settings, Search, ChevronRight, User } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ThemeToggle } from '../ThemeToggle'

const pageTitles: Record<string, { title: string; parent?: string }> = {
  '/converter': { title: 'CAD/BIM Converter', parent: 'Modules' },
  '/cad-viewer': { title: 'CAD Drawing Viewer', parent: 'Modules' },
  '/viewer': { title: '3D Model Viewer', parent: 'Modules' },
  '/cost': { title: 'CWICR Cost Estimation', parent: 'Modules' },
  '/validation': { title: 'BIM Validation', parent: 'Modules' },
  '/ai-analysis': { title: 'AI Data Analysis', parent: 'Modules' },
  '/project': { title: 'Project Management', parent: 'Modules' },
  '/documents': { title: 'Document Control', parent: 'Modules' },
  '/qto': { title: 'QTO Reports', parent: 'Modules' },
}

export default function TopBar() {
  const location = useLocation()
  const page = pageTitles[location.pathname] || { title: 'Jens Platform' }
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="h-14 bg-card border-b border-border flex items-center justify-between px-6 shrink-0">
      {/* Breadcrumb */}
      <div className="flex items-center gap-1.5">
        {page.parent && (
          <>
            <span className="text-sm text-muted-foreground">{page.parent}</span>
            <ChevronRight size={14} className="text-muted-foreground/50" />
          </>
        )}
        <h1 className="text-sm font-semibold text-foreground">{page.title}</h1>
      </div>

      <div className="flex items-center gap-2">
        {/* Animated Search */}
        <motion.div
          className="relative"
          animate={{ width: searchFocused ? 280 : 200 }}
          transition={{ duration: 0.2 }}
        >
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            className="w-full pl-9 pr-4 py-1.5 text-sm border border-border rounded-lg bg-muted text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/30 focus:border-ring"
          />
        </motion.div>

        {/* Notifications with dot */}
        <button className="relative p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Bell size={18} />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-destructive rounded-full" />
        </button>

        <button className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
          <Settings size={18} />
        </button>

        <ThemeToggle />

        {/* User Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center ml-1">
          <User size={16} className="text-primary" />
        </div>
      </div>
    </header>
  )
}
