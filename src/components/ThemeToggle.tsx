import { Moon, Sun, Monitor } from 'lucide-react'
import { useTheme } from './ThemeProvider'

export function ThemeToggle() {
  const { theme, setTheme } = useTheme()

  const cycle = () => {
    if (theme === 'dark') setTheme('light')
    else if (theme === 'light') setTheme('system')
    else setTheme('dark')
  }

  return (
    <button
      onClick={cycle}
      className="p-2 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
      title={`Theme: ${theme}`}
    >
      {theme === 'dark' && <Moon size={18} />}
      {theme === 'light' && <Sun size={18} />}
      {theme === 'system' && <Monitor size={18} />}
    </button>
  )
}
