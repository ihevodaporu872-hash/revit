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
      animate={{ width: sidebarOpen ? 262 : 72 }}
      transition={defaultTransition}
      className="sidebar-sheen relative h-full shrink-0 overflow-hidden border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <div className="absolute right-2 top-3 z-20">
        <button
          onClick={toggleSidebar}
          className="rounded-lg border border-sidebar-border bg-sidebar-accent/40 p-1.5 text-sidebar-foreground/80 transition-colors hover:bg-sidebar-accent"
          title={sidebarOpen ? 'Свернуть меню' : 'Развернуть меню'}
        >
          {sidebarOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        </button>
      </div>

      <div className="flex h-full flex-col">
        <div className="border-b border-sidebar-border/90 px-4 pb-3 pt-4">
          <AnimatePresence mode="wait">
            {sidebarOpen ? (
              <motion.div
                key="expanded-brand"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -8 }}
                transition={{ duration: 0.2 }}
                className="flex items-center gap-3"
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-b from-primary to-primary/70 text-base font-bold text-primary-foreground shadow-[var(--shadow-glow)]">
                  J
                </div>
                <div className="min-w-0">
                  <span className="block truncate text-[17px] font-semibold leading-none tracking-tight">Йенс</span>
                  <p className="mt-0.5 truncate text-[11px] text-sidebar-foreground/70">Строительная платформа</p>
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
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-sm font-bold text-primary-foreground shadow-[var(--shadow-glow)]"
              >
                J
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        <nav className="flex-1 overflow-y-auto px-2 py-3.5">
          {modules.map((mod) => {
            const Icon = mod.icon
            const active = location.pathname === mod.path
            return (
              <div key={mod.id} className="group relative mb-1.5">
                <button
                  onClick={() => navigate(mod.path)}
                  className={`relative flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-left transition-all ${
                    active
                      ? 'bg-gradient-to-r from-primary/30 to-primary/10 text-sidebar-primary-foreground'
                      : 'text-sidebar-foreground/78 hover:bg-sidebar-accent/80 hover:text-sidebar-accent-foreground'
                  }`}
                  title={!sidebarOpen ? mod.label : undefined}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1.5 bottom-1.5 w-1 rounded-r-full bg-primary shadow-[var(--shadow-glow)]"
                      transition={layoutIndicator}
                    />
                  )}
                  <span className={`ml-1 rounded-md p-1.5 ${active ? 'bg-primary/20 text-primary' : 'bg-sidebar-accent/35'}`}>
                    <Icon size={16} className="shrink-0" />
                  </span>
                  <AnimatePresence>
                    {sidebarOpen && (
                      <motion.span
                        variants={sidebarLabelVariants}
                        initial="collapsed"
                        animate="expanded"
                        exit="collapsed"
                        className="truncate text-[14px] font-semibold leading-none tracking-tight"
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
              className="border-t border-sidebar-border px-4 py-3"
            >
              <div className="flex items-center gap-2 text-[11px] text-sidebar-foreground/55">
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
              className="border-t border-sidebar-border p-3"
            >
              <button
                onClick={toggleSidebar}
                className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg border border-sidebar-border bg-sidebar-accent/50 text-sidebar-foreground/70"
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
