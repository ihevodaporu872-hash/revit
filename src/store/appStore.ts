import { create } from 'zustand'

export type ModuleId = 'converter' | 'cad-viewer' | 'viewer' | 'cost' | 'validation' | 'ai-analysis' | 'project' | 'documents' | 'qto' | 'n8n'

interface Notification {
  id: string
  type: 'success' | 'error' | 'info' | 'warning'
  message: string
  timestamp: number
}

interface AppState {
  activeModule: ModuleId
  sidebarOpen: boolean
  notifications: Notification[]
  isLoading: boolean
  setActiveModule: (module: ModuleId) => void
  toggleSidebar: () => void
  addNotification: (type: Notification['type'], message: string) => void
  removeNotification: (id: string) => void
  setLoading: (loading: boolean) => void
}

export const useAppStore = create<AppState>((set) => ({
  activeModule: 'converter',
  sidebarOpen: true,
  notifications: [],
  isLoading: false,
  setActiveModule: (module) => set({ activeModule: module }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  addNotification: (type, message) =>
    set((state) => ({
      notifications: [
        ...state.notifications,
        { id: Date.now().toString(), type, message, timestamp: Date.now() },
      ],
    })),
  removeNotification: (id) =>
    set((state) => ({
      notifications: state.notifications.filter((n) => n.id !== id),
    })),
  setLoading: (loading) => set({ isLoading: loading }),
}))
