import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { defaultTransition, layoutIndicator, sidebarLabelVariants } from '../../lib/animations'
import {
  ArrowLeftRight, FileType, Box, DollarSign, ShieldCheck,
  BrainCircuit, FolderKanban, FileText, BarChart3,
  ChevronLeft, ChevronRight, Workflow, PanelLeftClose,
} from 'lucide-react'

const modules = [
  { id: 'converter', path: '/converter', label: 'CAD-преобразователь', icon: ArrowLeftRight },
  { id: 'cad-viewer', path: '/cad-viewer', label: 'CAD-просмотрщик', icon: FileType },
  { id: 'viewer', path: '/viewer', label: '3D-просмотрщик', icon: Box },
  { id: 'cost', path: '/cost', label: 'Смета стоимости', icon: DollarSign },
  { id: 'validation', path: '/validation', label: 'Валидация BIM', icon: ShieldCheck },
  { id: 'ai-analysis', path: '/ai-analysis', label: 'Анализ ИИ', icon: BrainCircuit },
  { id: 'project', path: '/project', label: 'Управление проектом', icon: FolderKanban },
  { id: 'documents', path: '/documents', label: 'Документы', icon: FileText },
  { id: 'qto', path: '/qto', label: 'Отчёты QTO', icon: BarChart3 },
  { id: 'n8n', path: '/n8n', label: 'Рабочие процессы n8n', icon: Workflow },
] as const

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarOpen, toggleSidebar } = useAppStore()

  return (
    <motion.aside
      animate={{ width: sidebarOpen ? 332 : 74 }}
      transition={defaultTransition}
      className="sidebar-shell relative h-full shrink-0 overflow-hidden border-r border-sidebar-border/70 text-sidebar-foreground"
    >
      <div className="absolute right-2 top-3 z-30">
        <button
          onClick={toggleSidebar}
          className="rounded-full border border-sidebar-border/70 bg-sidebar-accent/50 p-1.5 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent"
          title={sidebarOpen ? 'Свернуть меню' : 'Развернуть меню'}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <div className="flex h-full flex-col">
        <div className="border-b border-sidebar-border/70 px-5 pb-4 pt-5">
          <AnimatePresence mode="wait">
            {sidebarOpen ? (
              <motion.div
                key="expanded-brand"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3.5"
              >
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-b from-primary to-primary/70 text-3xl font-bold text-primary-foreground shadow-[var(--shadow-glow)]">
                  J
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[19px] font-semibold leading-none tracking-tight">Йенс</span>
                  <p className="mt-1 truncate text-[13px] text-sidebar-foreground/74">Строительная платформа</p>
                </div>
              </motion.div>
            ) : (
              <motion.button
                key="collapsed-brand"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={() => navigate('/converter')}
                className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-lg font-bold text-primary-foreground shadow-[var(--shadow-glow)]"
              >
                J
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <nav className="sidebar-nav flex-1 overflow-y-auto py-3">
          {modules.map((mod) => {
            const Icon = mod.icon
            const active = location.pathname === mod.path
            return (
              <div key={mod.id} className="group relative">
                <button
                  onClick={() => navigate(mod.path)}
                  className={`sidebar-nav-item relative flex w-full items-center gap-3 text-left transition-all ${
                    active
                      ? 'sidebar-nav-item-active text-sidebar-primary-foreground'
                      : 'sidebar-nav-item-idle text-sidebar-foreground/82 hover:text-sidebar-accent-foreground'
                  } ${sidebarOpen ? 'px-5 py-2.5' : 'justify-center px-0 py-2.5'}`}
                  title={!sidebarOpen ? mod.label : undefined}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="sidebar-active-rail absolute left-0 top-1 bottom-1 w-1 rounded-r-full bg-primary shadow-[var(--shadow-glow)]"
                      transition={layoutIndicator}
                    />
                  )}
                  <span className={`rounded-lg p-1.5 ${active ? 'bg-primary/20 text-primary shadow-[0_0_22px_oklch(0.66_0.2_251/0.42)]' : 'bg-sidebar-accent/45 text-sidebar-foreground/80'}`}>
                    <Icon size={20} className="shrink-0" />
                  </span>
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span
                        variants={sidebarLabelVariants}
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                        className="truncate text-[16px] font-medium leading-none tracking-tight"
                      >
                        {mod.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </button>

                {!sidebarOpen && (
                  <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs font-medium text-popover-foreground opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
                    {mod.label}
                  </div>
                )}
              </div>
            )
          })}
        </nav>

        <AnimatePresence>
          {sidebarOpen ? (
            <motion.div
              key="footer-full"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="border-t border-sidebar-border/70 px-5 py-3"
            >
              <div className="flex items-center gap-2 text-xs text-sidebar-foreground/58">
                <PanelLeftClose size={14} />
                <span>Jens v1.0</span>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="footer-mini"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="border-t border-sidebar-border/70 p-3"
            >
              <button
                onClick={toggleSidebar}
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl border border-sidebar-border/70 bg-sidebar-accent/50 text-sidebar-foreground/70"
                title="Развернуть меню"
              >
                <ChevronRight size={16} />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.aside>
  )
}
