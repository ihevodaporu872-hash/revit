import { useLocation } from 'react-router-dom'
import { Bell, Settings, Search, ChevronRight, User } from 'lucide-react'
import { useState } from 'react'
import { motion } from 'framer-motion'
import { ThemeToggle } from '../ThemeToggle'
import { fastTransition } from '../../lib/animations'

const pageTitles: Record<string, { title: string; parent?: string }> = {
  '/converter': { title: 'Преобразователь CAD/BIM', parent: 'Модули' },
  '/cad-viewer': { title: 'Просмотр CAD-чертежей', parent: 'Модули' },
  '/viewer': { title: '3D-просмотрщик модели', parent: 'Модули' },
  '/cost': { title: 'Смета стоимости CWICR', parent: 'Модули' },
  '/validation': { title: 'Валидация BIM', parent: 'Модули' },
  '/ai-analysis': { title: 'Анализ данных ИИ', parent: 'Модули' },
  '/project': { title: 'Управление проектом', parent: 'Модули' },
  '/documents': { title: 'Контроль документов', parent: 'Модули' },
  '/qto': { title: 'Отчёты QTO', parent: 'Модули' },
  '/engines': { title: 'Автоматизация', parent: 'Модули' },
}

export default function TopBar() {
  const location = useLocation()
  const page = pageTitles[location.pathname] || { title: 'Платформа Йенс' }
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="topbar-shell sticky top-0 z-20">
      <div className="mx-auto flex h-[74px] w-full max-w-[1700px] items-center justify-between gap-4 px-6 lg:px-8">
        <div className="topbar-crumb-wrap flex min-w-0 items-center gap-2.5">
          {page.parent && (
            <>
              <span className="text-[14px] text-muted-foreground/80">{page.parent}</span>
              <ChevronRight size={16} className="text-muted-foreground/50" />
            </>
          )}
          <h1 className="truncate text-[19px] font-semibold leading-none tracking-tight text-foreground">{page.title}</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <motion.div
            className="topbar-search relative"
            animate={{ width: searchFocused ? 350 : 298 }}
            transition={fastTransition}
          >
            <Search size={16} className="absolute left-3.5 top-1/2 z-10 -translate-y-1/2 text-muted-foreground/70" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="h-11 w-full pl-10 pr-4 text-sm text-foreground placeholder:text-muted-foreground/60 focus:outline-none"
            />
          </motion.div>

          <button className="topbar-icon-btn relative p-2.5 text-muted-foreground/70 hover:text-foreground">
            <Bell size={16} />
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-destructive" />
          </button>
          <button className="topbar-icon-btn p-2.5 text-muted-foreground/70 hover:text-foreground">
            <Settings size={16} />
          </button>
          <ThemeToggle />
          <div className="topbar-icon-btn flex h-10 w-10 items-center justify-center !border-primary/25 !bg-primary/10">
            <User size={16} className="text-primary" />
          </div>
        </div>
      </div>
    </header>
  )
}
