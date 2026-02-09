import { useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { ThemeToggle } from '../ThemeToggle'
import {
  ArrowLeftRight, FileType, Box, DollarSign, ShieldCheck,
  BrainCircuit, FolderKanban, FileText, BarChart3,
  ChevronLeft, ChevronRight, Workflow
} from 'lucide-react'

const modules = [
  { id: 'converter', path: '/converter', label: 'CAD Converter', icon: ArrowLeftRight },
  { id: 'cad-viewer', path: '/cad-viewer', label: 'CAD Viewer', icon: FileType },
  { id: 'viewer', path: '/viewer', label: '3D Viewer', icon: Box },
  { id: 'cost', path: '/cost', label: 'Cost Estimate', icon: DollarSign },
  { id: 'validation', path: '/validation', label: 'BIM Validation', icon: ShieldCheck },
  { id: 'ai-analysis', path: '/ai-analysis', label: 'AI Analysis', icon: BrainCircuit },
  { id: 'project', path: '/project', label: 'Project Mgmt', icon: FolderKanban },
  { id: 'documents', path: '/documents', label: 'Documents', icon: FileText },
  { id: 'qto', path: '/qto', label: 'QTO Reports', icon: BarChart3 },
  { id: 'n8n', path: '/n8n', label: 'n8n Workflows', icon: Workflow },
] as const

export default function Sidebar() {
  const navigate = useNavigate()
  const location = useLocation()
  const { sidebarOpen, toggleSidebar } = useAppStore()

  return (
    <motion.aside
      animate={{ width: sidebarOpen ? 256 : 64 }}
      transition={{ duration: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
      className="h-full bg-sidebar text-sidebar-foreground flex flex-col shrink-0 overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        <AnimatePresence>
          {sidebarOpen && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.2 }}
              className="flex items-center gap-2.5"
            >
              <motion.div
                className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center font-bold text-lg text-sidebar-primary-foreground"
                whileHover={{ rotate: [0, -5, 5, 0] }}
                transition={{ duration: 0.4 }}
              >
                J
              </motion.div>
              <div>
                <span className="font-bold text-lg leading-none">Jens</span>
                <p className="text-[10px] text-sidebar-foreground/40 leading-none mt-0.5">Construction Platform</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
        <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors">
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-2 overflow-y-auto">
        {modules.map((mod) => {
          const Icon = mod.icon
          const active = location.pathname === mod.path
          return (
            <div key={mod.id} className="relative group">
              <button
                onClick={() => navigate(mod.path)}
                className={`w-full flex items-center gap-3 px-4 py-3 transition-all relative ${
                  active
                    ? 'bg-sidebar-primary/15 text-sidebar-primary-foreground'
                    : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
                }`}
                title={!sidebarOpen ? mod.label : undefined}
              >
                {/* Active indicator bar */}
                {active && (
                  <motion.div
                    layoutId="sidebar-active"
                    className="absolute left-0 top-1 bottom-1 w-[3px] rounded-r-full bg-sidebar-primary shadow-[0_0_8px_var(--sidebar-primary)]"
                    transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                  />
                )}
                <Icon size={20} className={`shrink-0 ${active ? 'text-sidebar-primary' : ''}`} />
                <AnimatePresence>
                  {sidebarOpen && (
                    <motion.span
                      initial={{ opacity: 0, width: 0 }}
                      animate={{ opacity: 1, width: 'auto' }}
                      exit={{ opacity: 0, width: 0 }}
                      className="text-sm font-medium whitespace-nowrap overflow-hidden"
                    >
                      {mod.label}
                    </motion.span>
                  )}
                </AnimatePresence>
              </button>

              {/* Tooltip for collapsed state */}
              {!sidebarOpen && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2.5 py-1.5 bg-popover text-popover-foreground text-xs font-medium rounded-md shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  {mod.label}
                </div>
              )}
            </div>
          )
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          <AnimatePresence>
            {sidebarOpen && (
              <motion.span
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-xs text-sidebar-foreground/40"
              >
                Jens v1.0
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.aside>
  )
}
