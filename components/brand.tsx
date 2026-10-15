'use client'

import { SquareTerminal } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/cn'

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5">
      <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground">
        <SquareTerminal className="h-4 w-4" />
      </div>
      <span className="text-[14px] font-semibold tracking-tight">Codebench</span>
    </Link>
  )
}

const SECTIONS = [
  { href: '/', label: 'Workbench' },
  { href: '/analytics', label: 'Analytics' },
]

export function SectionNav() {
  const path = usePathname()
  return (
    <nav className="flex items-center gap-0.5 rounded-lg bg-muted p-0.5" aria-label="Sections">
      {SECTIONS.map((item) => {
        const active = item.href === '/' ? path === '/' : path.startsWith(item.href)
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? 'page' : undefined}
            className={cn(
              'rounded-md px-2.5 py-1 text-[12.5px] transition-colors',
              active ? 'bg-raised text-foreground shadow-sm ring-1 ring-border' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {item.label}
          </Link>
        )
      })}
    </nav>
  )
}
