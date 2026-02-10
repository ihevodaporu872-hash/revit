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
  '/n8n': { title: 'Рабочие процессы n8n', parent: 'Модули' },
}

export default function TopBar() {
  const location = useLocation()
  const page = pageTitles[location.pathname] || { title: 'Платформа Йенс' }
  const [searchQuery, setSearchQuery] = useState('')
  const [searchFocused, setSearchFocused] = useState(false)

  return (
    <header className="sticky top-0 z-20 border-b border-border/70 bg-card/70 backdrop-blur-xl">
      <div className="mx-auto flex h-[60px] w-full max-w-[1560px] items-center justify-between gap-4 px-6 lg:px-8">
        <div className="flex min-w-0 items-center gap-2.5">
          {page.parent && (
            <>
              <span className="text-[13px] text-muted-foreground">{page.parent}</span>
              <ChevronRight size={15} className="text-muted-foreground/70" />
            </>
          )}
          <h1 className="truncate text-[19px] font-semibold leading-none tracking-tight text-foreground">{page.title}</h1>
        </div>

        <div className="flex items-center gap-2.5">
          <motion.div
            className="relative"
            animate={{ width: searchFocused ? 300 : 230 }}
            transition={fastTransition}
          >
            <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Поиск..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setSearchFocused(true)}
              onBlur={() => setSearchFocused(false)}
              className="h-9 w-full rounded-full border border-border bg-card/70 pl-10 pr-4 text-[12.5px] text-foreground placeholder:text-muted-foreground/80 focus:border-primary/70 focus:outline-none focus:ring-2 focus:ring-primary/25"
            />
          </motion.div>

          <button className="relative rounded-full border border-border bg-card/50 p-2 text-muted-foreground transition-colors hover:text-foreground">
            <Bell size={16} />
            <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-destructive" />
          </button>
          <button className="rounded-full border border-border bg-card/50 p-2 text-muted-foreground transition-colors hover:text-foreground">
            <Settings size={16} />
          </button>
          <ThemeToggle />
          <div className="flex h-9 w-9 items-center justify-center rounded-full border border-primary/45 bg-primary/18">
            <User size={16} className="text-primary" />
          </div>
        </div>
      </div>
    </header>
  )
}
