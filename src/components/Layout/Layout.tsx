import { Outlet, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import Sidebar from './Sidebar'
import TopBar from './TopBar'
import Notifications from './Notifications'

export default function Layout() {
  const location = useLocation()

  return (
    <div className="flex h-screen bg-background">
      <Sidebar />
      <div className="flex flex-col flex-1 transition-all duration-300 min-w-0">
        <TopBar />
        <main className="flex-1 overflow-auto p-6 relative">
          {/* Subtle dot pattern background */}
          <div
            className="pointer-events-none absolute inset-0 opacity-[0.03] dark:opacity-[0.04]"
            style={{
              backgroundImage: 'radial-gradient(circle, currentColor 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div className="relative z-10">
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
