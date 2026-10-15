'use client'

import { Monitor, Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { cn } from '@/lib/cn'

type Theme = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'codebench-theme'

function apply(theme: Theme) {
  const dark = theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

const OPTIONS: { value: Theme; label: string; Icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', Icon: Sun },
  { value: 'dark', label: 'Dark', Icon: Moon },
  { value: 'system', label: 'System', Icon: Monitor },
]

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('system')

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'light' || stored === 'dark' || stored === 'system') setTheme(stored)
  }, [])

  useEffect(() => {
    if (theme !== 'system') return
    const media = matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => apply('system')
    media.addEventListener('change', onChange)
    return () => media.removeEventListener('change', onChange)
  }, [theme])

  function choose(next: Theme) {
    setTheme(next)
    localStorage.setItem(STORAGE_KEY, next)
    apply(next)
  }

  return (
    <div className="flex items-center rounded-md border bg-surface p-0.5" role="radiogroup" aria-label="Theme">
      {OPTIONS.map(({ value, label, Icon }) => (
        <button
          key={value}
          role="radio"
          aria-checked={theme === value}
          title={label}
          onClick={() => choose(value)}
          className={cn(
            'flex h-6 w-7 items-center justify-center rounded-[5px] text-muted-foreground transition-colors hover:text-foreground',
            theme === value && 'bg-raised text-foreground shadow-sm ring-1 ring-border',
          )}
        >
          <Icon className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  )
}
