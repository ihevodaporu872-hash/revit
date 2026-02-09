import { useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAppStore } from '../../store/appStore'
import { ThemeToggle } from '../ThemeToggle'
import {
  ArrowLeftRight, Box, DollarSign, ShieldCheck,
  BrainCircuit, FolderKanban, FileText, BarChart3,
  ChevronLeft, ChevronRight
} from 'lucide-react'

const modules = [
  { id: 'converter', path: '/converter', label: 'CAD Converter', icon: ArrowLeftRight },
  { id: 'viewer', path: '/viewer', label: '3D Viewer', icon: Box },
  { id: 'cost', path: '/cost', label: 'Cost Estimate', icon: DollarSign },
  { id: 'validation', path: '/validation', label: 'BIM Validation', icon: ShieldCheck },
  { id: 'ai-analysis', path: '/ai-analysis', label: 'AI Analysis', icon: BrainCircuit },
  { id: 'project', path: '/project', label: 'Project Mgmt', icon: FolderKanban },
  { id: 'documents', path: '/documents', label: 'Documents', icon: FileText },
  { id: 'qto', path: '/qto', label: 'QTO Reports', icon: BarChart3 },
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
      <div className="flex items-center justify-between p-4 border-b border-sidebar-border">
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center gap-2"
          >
            <div className="w-8 h-8 bg-sidebar-primary rounded-lg flex items-center justify-center font-bold text-lg text-sidebar-primary-foreground">J</div>
            <span className="font-bold text-lg">Jens</span>
          </motion.div>
        )}
        <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-sidebar-accent transition-colors">
          {sidebarOpen ? <ChevronLeft size={18} /> : <ChevronRight size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-2 overflow-y-auto">
        {modules.map((mod) => {
          const Icon = mod.icon
          const active = location.pathname === mod.path
          return (
            <button
              key={mod.id}
              onClick={() => navigate(mod.path)}
              className={`w-full flex items-center gap-3 px-4 py-3 transition-colors ${
                active
                  ? 'bg-sidebar-primary text-sidebar-primary-foreground'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground'
              }`}
              title={mod.label}
            >
              <Icon size={20} className="shrink-0" />
              {sidebarOpen && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-sm font-medium whitespace-nowrap"
                >
                  {mod.label}
                </motion.span>
              )}
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border">
        <div className="flex items-center justify-between">
          <ThemeToggle />
          {sidebarOpen && (
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-xs text-sidebar-foreground/40"
            >
              Jens v1.0
            </motion.span>
          )}
        </div>
      </div>
    </motion.aside>
  )
}
