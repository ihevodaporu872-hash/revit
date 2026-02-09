import { useState } from 'react'
import { cn } from '../../lib/utils'
import { motion, AnimatePresence } from 'framer-motion'
import { layoutIndicator, tabContent } from '../../lib/animations'

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
      <div role="tablist" className="flex items-center gap-1 border-b border-border relative">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            data-state={activeTab === tab.id ? 'active' : 'inactive'}
            aria-selected={activeTab === tab.id}
            onClick={() => handleChange(tab.id)}
            className={cn(
              'relative flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors -mb-px',
              activeTab === tab.id
                ? 'text-primary'
                : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {tab.icon}
            {tab.label}
            {activeTab === tab.id && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-full"
                transition={layoutIndicator}
              />
            )}
          </button>
        ))}
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabContent}
          initial="initial"
          animate="animate"
          exit="exit"
          className="pt-4"
        >
          {children(activeTab)}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
