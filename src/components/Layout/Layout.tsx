import { Outlet } from 'react-router-dom'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Notifications from './Notifications'
import { useAppStore } from '../../store/appStore'

export default function Layout() {
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)

  return (
    <div className="flex h-screen bg-surface-alt">
      <Sidebar />
      <div className={`flex flex-col flex-1 transition-all duration-300 ${sidebarOpen ? 'ml-64' : 'ml-16'}`}>
        <TopBar />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
      <Notifications />
    </div>
  )
}
