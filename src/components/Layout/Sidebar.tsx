import { useNavigate, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/appStore'
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
    <aside className={`h-full bg-sidebar text-white flex flex-col transition-all duration-300 shrink-0 ${sidebarOpen ? 'w-64' : 'w-16'}`}>
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        {sidebarOpen && (
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center font-bold text-lg">J</div>
            <span className="font-bold text-lg">Jens</span>
          </div>
        )}
        <button onClick={toggleSidebar} className="p-1.5 rounded-lg hover:bg-sidebar-hover transition-colors">
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
                active ? 'bg-sidebar-active text-white' : 'text-white/70 hover:bg-sidebar-hover hover:text-white'
              }`}
              title={mod.label}
            >
              <Icon size={20} className="shrink-0" />
              {sidebarOpen && <span className="text-sm font-medium">{mod.label}</span>}
            </button>
          )
        })}
      </nav>

      <div className="p-4 border-t border-white/10">
        {sidebarOpen && (
          <div className="text-xs text-white/40">
            Jens Platform v1.0
          </div>
        )}
      </div>
    </aside>
  )
}
