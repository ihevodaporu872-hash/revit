import { useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../../lib/utils'
import { defaultTransition } from '../../lib/animations'

interface Tab {
  id: string
  label: string
  icon?: React.ReactNode
}

interface TabsProps {
  tabs: Tab[]
  defaultTab?: string
  onChange?: (tabId: string) => void
  children: (activeTab: string) => React.ReactNode
  className?: string
}

export function Tabs({ tabs, defaultTab, onChange, children, className }: TabsProps) {
  const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || '')

  const handleChange = (tabId: string) => {
    setActiveTab(tabId)
    onChange?.(tabId)
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-1 border-b border-border relative">
        {/* Animated underline indicator */}
        {tabs.map((tab) => {
          if (activeTab === tab.id) {
            return (
              <motion.div
                key={`indicator-${tab.id}`}
                layoutId="tab-underline"
                className="absolute bottom-0 h-0.5 bg-primary"
                transition={defaultTransition}
                style={{
                  left: 0,
                  right: 0,
                }}
              />
            )
          }
          return null
        })}

        {tabs.map((tab) => (
          <motion.button
            key={tab.id}
            onClick={() => handleChange(tab.id)}
            whileHover={{ opacity: 0.8 }}
            whileTap={{ scale: 0.98 }}
            className={cn(
              'flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors relative z-10',
              activeTab === tab.id
                ? 'text-primary'
                : 'text-text-secondary hover:text-text',
            )}
          >
            {tab.icon}
            {tab.label}
          </motion.button>
        ))}
      </div>

      <motion.div
        key={activeTab}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        transition={defaultTransition}
        className="pt-4"
      >
        {children(activeTab)}
      </motion.div>
    </div>
  )
}
