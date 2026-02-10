import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Notifications from './Notifications'
import { useN8nNotifications } from '../../hooks/useN8nNotifications'

export default function Layout() {
  const location = useLocation()
  useN8nNotifications()

  return (
    <div className="app-shell flex h-screen text-foreground">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main className="app-grid-bg relative flex-1 overflow-auto">
          <div className="relative z-10 mx-auto w-full max-w-[1560px] px-6 pb-10 pt-6 lg:px-8">
            <AnimatePresence mode="wait">
              <Outlet key={location.pathname} />
            </AnimatePresence>
          </div>
        </main>
      </div>
      <Notifications />
    </div>
  )
}
