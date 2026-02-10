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
      className="rounded-full border border-border bg-card/50 p-2.5 text-muted-foreground transition-colors hover:text-foreground"
      title={`Theme: ${theme}`}
    >
      {theme === 'dark' && <Moon size={18} />}
      {theme === 'light' && <Sun size={18} />}
      {theme === 'system' && <Monitor size={18} />}
    </button>
  )
}
