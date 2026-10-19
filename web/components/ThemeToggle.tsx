'use client'

import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

export function ThemeToggle({ compact = false, className = '' }: { compact?: boolean; className?: string }) {
  const [theme, setTheme] = useState<Theme>('light')

  useEffect(() => {
    setTheme(document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light')
  }, [])

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    document.documentElement.style.colorScheme = next
    localStorage.setItem('tud-web-theme', next)
    setTheme(next)
  }

  const nextLabel = theme === 'dark' ? 'Usar tema claro' : 'Usar tema escuro'
  return <button type="button" className={`theme-toggle${compact ? ' compact' : ''}${className ? ` ${className}` : ''}`} onClick={toggle} aria-label={nextLabel} title={nextLabel}>
    {theme === 'dark' ? <Sun size={16}/> : <Moon size={16}/>} {!compact && <span>{theme === 'dark' ? 'Tema claro' : 'Tema escuro'}</span>}
  </button>
}
