'use client'

import {
  Activity,
  AlertCircle,
  ArrowUp,
  BarChart3,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsDownUp,
  ChevronsUpDown,
  Code2,
  Maximize2,
  Minimize2,
  PanelRightClose,
  PanelRightOpen,
  Plus,
  Route,
  Square,
} from 'lucide-react'
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import {
  CONFIG_KEY,
  formatTokens,
  formatUsd,
  PEOPLE,
  previewAgent,
  REQUEST_TYPES,
  type Person,
  type RequestType,
} from '@/lib/demo'
import { cn } from '@/lib/cn'
import { agentDot } from './agents'
import { Brand, SectionNav } from './brand'
import { CodeWorkspace } from './code-workspace'
import { FileIcon } from './file-icon'
import { Markdown } from './markdown'
import { ThemeToggle } from './theme-toggle'
import { TraceWaterfall } from './trace-waterfall'
import type { ChatMessage, FileMeta, PanelTab, ProjectFile, TurnTrace } from './types'
import { UsageView } from './usage-view'

type PanelMode = 'split' | 'collapsed' | 'expanded'

const PANEL_KEY = 'codebench-panel'
const MIN_PANEL = 420
const MIN_CHAT = 380

const STARTERS: { label: string; requestType: RequestType; text: string }[] = [
  {
    label: 'Quick fix',
    requestType: 'quick-fix',
    text: 'Add a TypeScript helper that checks a password has 12+ characters, a number, and a symbol. Put the function in src/password.ts and a few examples in src/password.test.ts.',
  },
  {
    label: 'Feature',
    requestType: 'feature',
    text: 'Build a small TypeScript expense splitter: a type for people and expenses, a function that returns who owes what, and a README that shows one example.',
  },
  {
    label: 'Architecture',
    requestType: 'architecture',
    text: 'Sketch a feature-flag client. Write docs/architecture.md with the runtime flow, and src/flags.ts with the interfaces a product app would call. Keep it small.',
  },
  {
    label: 'Repo review',
    requestType: 'quick-fix',
    text: 'Review https://github.com/Connor-Tluck/Job_Tracker_LaunchDarkly. Read the repository, find one concrete bug, and write the fix into this project with a short note on why it breaks.',
  },
]

const TABS: { key: PanelTab; label: string; Icon: typeof Code2 }[] = [
  { key: 'code', label: 'Code', Icon: Code2 },
  { key: 'traces', label: 'Traces', Icon: Activity },
  { key: 'usage', label: 'Usage', Icon: BarChart3 },
]

function requestLabel(key: string) {
  return REQUEST_TYPES.find((item) => item.key === key)?.label ?? key
}

function formatSeconds(ms: number) {
  return `${(ms / 1000).toFixed(1)} s`
}

function clampWidth(width: number) {
  return Math.round(Math.min(Math.max(width, MIN_PANEL), window.innerWidth - MIN_CHAT))
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .map((part) => part[0])
    .join('')
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-semibold text-muted-foreground ring-1 ring-border">
      {initials}
    </span>
  )
}

function IconButton({
  title,
  onClick,
  children,
  active,
}: {
  title: string
  onClick: () => void
  children: ReactNode
  active?: boolean
}) {
  return (
    <button
      title={title}
      aria-label={title}
      onClick={onClick}
      className={cn(
        'flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground',
        active && 'bg-accent text-foreground',
      )}
    >
      {children}
    </button>
  )
}

function PersonPicker({ value, onChange }: { value: string; onChange: (key: string) => void }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const person = PEOPLE.find((item) => item.key === value) ?? PEOPLE[1]

  useEffect(() => {
    if (!open) return
    const onDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false)
    }
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false)
    window.addEventListener('pointerdown', onDown)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((current) => !current)}
        className="flex h-8 items-center gap-2 rounded-md border bg-surface pl-1 pr-2 text-[13px] hover:bg-accent"
      >
        <Avatar name={person.name} />
        <span className="font-medium">{person.name}</span>
        <span className="hidden capitalize text-muted-foreground sm:inline">{person.team}</span>
        <ChevronDown className="h-3.5 w-3.5 text-subtle" />
      </button>
      {open && (
        <div className="absolute right-0 top-10 z-50 w-80 rounded-lg border bg-raised p-1 shadow-xl">
          <div className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-muted-foreground">Act as</div>
          {PEOPLE.map((item) => {
            const agent = previewAgent(item.team, 'feature')
            return (
              <button
                key={item.key}
                onClick={() => {
                  onChange(item.key)
                  setOpen(false)
                }}
                className={cn(
                  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left hover:bg-accent',
                  item.key === value && 'bg-accent',
                )}
              >
                <Avatar name={item.name} />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium">{item.name}</span>
                  <span className="block text-[11.5px] capitalize text-muted-foreground">
                    {item.role} · {item.team}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1 text-[11px] text-muted-foreground">
                  <span className={cn('h-1.5 w-1.5 rounded-full', agentDot(agent.variationKey))} />
                  {agent.name}
                </span>
                <Check className={cn('h-3.5 w-3.5 shrink-0', item.key === value ? 'opacity-100' : 'opacity-0')} />
              </button>
            )
          })}
          <p className="px-2 pb-1.5 pt-2 text-[11px] leading-4 text-subtle">
            Team is part of the LaunchDarkly context. It decides which agent serves feature work.
          </p>
        </div>
      )}
    </div>
  )
}

function ChipRow({ count, children }: { count: number; children: ReactNode }) {
  const [expanded, setExpanded] = useState(false)
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)
  const [edges, setEdges] = useState({ left: false, right: false })

  const measure = useCallback(() => {
    const node = scroller.current
    if (!node) return
    const left = node.scrollLeft > 4
    const right = node.scrollLeft + node.clientWidth < node.scrollWidth - 4
    setEdges((current) => (current.left === left && current.right === right ? current : { left, right }))
  }, [])

  useLayoutEffect(() => {
    const node = scroller.current
    if (!node) return
    if (stick.current) node.scrollLeft = node.scrollWidth
    measure()
  }, [count, expanded, measure])

  if (count <= 3) {
    return <div className="mt-2 flex flex-wrap gap-1.5">{children}</div>
  }

  if (expanded) {
    return (
      <div className="mt-2">
        <button
          type="button"
          onClick={() => setExpanded(false)}
          className="mb-1.5 flex items-center gap-1 rounded-md border bg-surface px-2 py-1 text-[11.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ChevronsDownUp className="h-3 w-3" />
          Shrink
        </button>
        <div className="flex flex-wrap gap-1.5">{children}</div>
      </div>
    )
  }

  const page = (direction: number) => {
    const node = scroller.current
    if (!node) return
    stick.current = false
    node.scrollBy({ left: direction * Math.max(180, node.clientWidth * 0.75), behavior: 'smooth' })
  }

  return (
    <div className="mt-2 flex items-center gap-1">
      <button
        type="button"
        aria-label="Previous tool calls"
        disabled={!edges.left}
        onClick={() => page(-1)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <div
        ref={scroller}
        onScroll={() => {
          const node = scroller.current
          if (!node) return
          stick.current = node.scrollWidth - node.scrollLeft - node.clientWidth < 8
          measure()
        }}
        className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>
      <button
        type="button"
        aria-label="Next tool calls"
        disabled={!edges.right}
        onClick={() => page(1)}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border bg-surface text-muted-foreground hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-30"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        aria-label={`Show all ${count} tool calls`}
        title="Show all"
        onClick={() => setExpanded(true)}
        className="flex h-7 shrink-0 items-center gap-1 rounded-md border bg-surface px-1.5 font-mono text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
      >
        <ChevronsUpDown className="h-3 w-3" />
        {count}
      </button>
    </div>
  )
}

function Thinking({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((index) => (
          <span
            key={index}
            className="h-1 w-1 animate-bounce rounded-full bg-current"
            style={{ animationDelay: `${index * 120}ms` }}
          />
        ))}
      </span>
      {label}
    </div>
  )
}

function EmptyState({ person, onPick }: { person: Person; onPick: (text: string, type: RequestType) => void }) {
  return (
    <div className="pt-[9vh]">
      <h2 className="text-[22px] font-semibold tracking-tight">What should we build, {person.name.split(' ')[0]}?</h2>
      <p className="mt-2 max-w-[560px] text-[14px] leading-6 text-muted-foreground">
        Describe a change in plain language. Agent Control picks the coding agent for each request, and every step is
        traced with Claude&apos;s OpenTelemetry spans.
      </p>
      <div className="mt-7 grid gap-2.5 sm:grid-cols-2">
        {STARTERS.map((starter) => {
          const agent = previewAgent(person.team, starter.requestType)
          return (
            <button
              key={starter.label}
              onClick={() => onPick(starter.text, starter.requestType)}
              className="flex flex-col rounded-lg border bg-surface p-3.5 text-left transition-colors hover:border-border-strong hover:bg-raised"
            >
              <span className="text-[12.5px] font-medium">{starter.label}</span>
              <span className="mt-1.5 line-clamp-3 text-[12.5px] leading-5 text-muted-foreground">{starter.text}</span>
              <span className="mt-auto flex items-center gap-1.5 pt-3 text-[11.5px] text-muted-foreground">
                <span className={cn('h-1.5 w-1.5 rounded-full', agentDot(agent.variationKey))} />
                {agent.name}
                <span className="truncate font-mono text-subtle">{agent.model}</span>
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

export function Workbench() {
  const [personKey, setPersonKey] = useState(PEOPLE[1].key)
  const [requestType, setRequestType] = useState<RequestType>('feature')
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [fileMeta, setFileMeta] = useState<Record<string, FileMeta>>({})
  const [openTabs, setOpenTabs] = useState<string[]>([])
  const [activePath, setActivePath] = useState<string>()
  const [recentPath, setRecentPath] = useState<string>()
  const [tab, setTab] = useState<PanelTab>('code')
  const [turns, setTurns] = useState<TurnTrace[]>([])
  const [activeTurn, setActiveTurn] = useState<string>()
  const [busy, setBusy] = useState(false)
  const [sessionId, setSessionId] = useState(() => crypto.randomUUID())
  const [panelMode, setPanelMode] = useState<PanelMode>('split')
  const [panelWidth, setPanelWidth] = useState<number>()
  const [dragging, setDragging] = useState(false)

  const chatRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortRef = useRef<AbortController | null>(null)
  const stickRef = useRef(true)
  const turnCounter = useRef(0)
  const openedDrafts = useRef(new Set<string>())
  const panelModeRef = useRef(panelMode)
  panelModeRef.current = panelMode

  const person = PEOPLE.find((item) => item.key === personKey) ?? PEOPLE[1]
  const preview = previewAgent(person.team, requestType)
  const totals = turns.reduce(
    (sum, turn) => ({ tokens: sum.tokens + turn.inputTokens + turn.outputTokens, cost: sum.cost + turn.costUsd }),
    { tokens: 0, cost: 0 },
  )

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PANEL_KEY) ?? '{}') as { mode?: PanelMode; width?: number }
      const fallback = window.innerWidth * 0.54
      setPanelWidth(clampWidth(saved.width ?? fallback))
      if (window.innerWidth < 900) setPanelMode('collapsed')
      else if (saved.mode === 'split' || saved.mode === 'collapsed' || saved.mode === 'expanded') setPanelMode(saved.mode)
    } catch {
      setPanelWidth(clampWidth(window.innerWidth * 0.54))
    }
  }, [])

  useEffect(() => {
    if (panelWidth === undefined) return
    localStorage.setItem(PANEL_KEY, JSON.stringify({ mode: panelMode, width: panelWidth }))
  }, [panelMode, panelWidth])

  useEffect(() => {
    const onResize = () => setPanelWidth((width) => (width === undefined ? width : clampWidth(width)))
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'b') {
        event.preventDefault()
        setPanelMode((mode) => (mode === 'collapsed' ? 'split' : 'collapsed'))
      } else if (event.key === 'Escape' && panelModeRef.current === 'expanded') {
        setPanelMode('split')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    const node = chatRef.current
    if (node && stickRef.current) node.scrollTop = node.scrollHeight
  }, [messages])

  useEffect(() => {
    const node = inputRef.current
    if (!node) return
    node.style.height = 'auto'
    node.style.height = `${Math.min(node.scrollHeight, 200)}px`
  }, [draft])

  const startDrag = useCallback((event: React.PointerEvent) => {
    event.preventDefault()
    setDragging(true)
    const onMove = (move: PointerEvent) => setPanelWidth(clampWidth(window.innerWidth - move.clientX))
    const onUp = () => {
      setDragging(false)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  function openFile(path: string) {
    setOpenTabs((current) => (current.includes(path) ? current : [...current, path]))
    setActivePath(path)
    setTab('code')
    setPanelMode((mode) => (mode === 'collapsed' ? 'split' : mode))
  }

  function closeTab(path: string) {
    const index = openTabs.indexOf(path)
    const next = openTabs.filter((item) => item !== path)
    setOpenTabs(next)
    if (path === activePath) setActivePath(next[Math.min(index, next.length - 1)])
  }

  function openTrace(id: string) {
    setActiveTurn(id)
    setTab('traces')
    setPanelMode((mode) => (mode === 'collapsed' ? 'split' : mode))
  }

  function openTab(key: PanelTab) {
    setTab(key)
    setPanelMode((mode) => (mode === 'collapsed' ? 'split' : mode))
  }

  function reset() {
    abortRef.current?.abort()
    setMessages([])
    setFiles([])
    setFileMeta({})
    setOpenTabs([])
    setActivePath(undefined)
    setRecentPath(undefined)
    setTurns([])
    setActiveTurn(undefined)
    setSessionId(crypto.randomUUID())
    setBusy(false)
    turnCounter.current = 0
    openedDrafts.current.clear()
  }

  function stop() {
    abortRef.current?.abort()
  }

  function patchMessage(id: string, patch: (message: ChatMessage) => Partial<ChatMessage>) {
    setMessages((current) => current.map((message) => (message.id === id ? { ...message, ...patch(message) } : message)))
  }

  async function send(text: string, nextType = requestType) {
    const trimmed = text.trim()
    if (!trimmed || busy) return
    setRequestType(nextType)
    setDraft('')
    stickRef.current = true

    const turnIndex = ++turnCounter.current
    const history = messages
      .filter((message) => message.text && !message.error)
      .map((message) => ({ role: message.role, content: message.text }))
    const assistantId = crypto.randomUUID()
    const guess = previewAgent(person.team, nextType)
    const served = { name: guess.name, model: guess.model, variationKey: guess.variationKey }

    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: 'user', text: trimmed, files: [], requestType: nextType, author: person.name },
      { id: assistantId, role: 'assistant', text: '', files: [] },
    ])
    setBusy(true)
    openedDrafts.current.clear()
    const controller = new AbortController()
    abortRef.current = controller

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({ sessionId, personKey: person.key, requestType: nextType, userText: trimmed, history, files }),
      })
      if (!response.ok || !response.body) {
        const body = await response.json().catch(() => ({}))
        throw new Error(body.error ?? 'The coding agent could not start.')
      }
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop() ?? ''
        for (const part of parts) {
          const line = part.split('\n').find((item) => item.startsWith('data: '))
          if (!line) continue
          const event = JSON.parse(line.slice(6))

          if (event.type === 'meta') {
            served.name = event.agent.variationName
            served.model = event.agent.model
            served.variationKey = event.agent.variationKey
            patchMessage(assistantId, () => ({
              agentName: event.agent.variationName,
              variationKey: event.agent.variationKey,
              model: event.agent.model,
              reason: event.agent.reason,
            }))
          } else if (event.type === 'draft') {
            const path: string = event.path
            const content: string = event.content ?? ''
            const label = `Writing ${path} in the code view`
            setFiles((current) =>
              [...current.filter((file) => file.path !== path), { path, content }].sort((a, b) =>
                a.path.localeCompare(b.path),
              ),
            )
            setFileMeta((current) => {
              const previous = current[path]
              return {
                ...current,
                [path]: {
                  status: previous?.status ?? 'added',
                  agentName: served.name,
                  model: served.model,
                  turn: turnIndex,
                  writing: true,
                },
              }
            })
            setOpenTabs((current) => (current.includes(path) ? current : [...current, path]))
            if (!openedDrafts.current.has(path)) {
              openedDrafts.current.add(path)
              setActivePath(path)
              setRecentPath(path)
              setTab('code')
              setPanelMode((mode) => (mode === 'collapsed' ? 'split' : mode))
            }
            patchMessage(assistantId, (message) => ({
              writing: path,
              reads: message.reads?.includes(label) ? message.reads : [...(message.reads ?? []), label],
            }))
            // Drafts can arrive in one network chunk. Yield so each snapshot paints in the editor.
            await new Promise((resolve) => setTimeout(resolve, 16))
          } else if (event.type === 'note') {
            patchMessage(assistantId, (message) => ({
              reads: message.reads?.includes(event.text) ? message.reads : [...(message.reads ?? []), event.text],
            }))
          } else if (event.type === 'text') {
            patchMessage(assistantId, (message) => ({ text: message.text + event.text }))
          } else if (event.type === 'file') {
            const path: string = event.path
            setFiles((current) =>
              [...current.filter((file) => file.path !== path), { path, content: event.content }].sort((a, b) =>
                a.path.localeCompare(b.path),
              ),
            )
            setFileMeta((current) => {
              const previous = current[path]
              const status = previous?.writing
                ? previous.status
                : previous && previous.turn !== turnIndex
                  ? 'modified'
                  : (previous?.status ?? 'added')
              return {
                ...current,
                [path]: { status, agentName: served.name, model: served.model, turn: turnIndex, writing: false },
              }
            })
            setOpenTabs((current) => (current.includes(path) ? current : [...current, path]))
            setActivePath(path)
            setRecentPath(path)
            if (panelModeRef.current !== 'collapsed') setTab('code')
            patchMessage(assistantId, (message) => ({
              files: message.files.includes(path) ? message.files : [...message.files, path],
              writing: message.writing === path ? undefined : message.writing,
            }))
          } else if (event.type === 'done') {
            const usage = event.usage ?? {}
            setTurns((current) => [
              ...current,
              {
                id: assistantId,
                index: turnIndex,
                prompt: trimmed,
                agentName: served.name,
                variationKey: event.variationKey ?? served.variationKey,
                model: event.model || served.model,
                requestType: requestLabel(nextType),
                person: person.name,
                inputTokens: usage.inputTokens ?? 0,
                outputTokens: usage.outputTokens ?? 0,
                costUsd: usage.costUsd ?? 0,
                latencyMs: usage.latencyMs ?? 0,
                traceId: event.traceId,
                spans: event.spans ?? [],
              },
            ])
            setActiveTurn(assistantId)
            patchMessage(assistantId, (message) => ({ done: true, text: message.text || event.text || '' }))
          } else if (event.type === 'error') {
            patchMessage(assistantId, () => ({ error: event.message, done: true }))
          }
        }
      }
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        patchMessage(assistantId, (message) => ({ done: true, text: message.text || 'Stopped.' }))
      } else {
        patchMessage(assistantId, () => ({
          done: true,
          error: error instanceof Error ? error.message : 'Request failed',
        }))
      }
    } finally {
      patchMessage(assistantId, () => ({ done: true }))
      setFileMeta((current) => {
        if (!Object.values(current).some((meta) => meta.writing)) return current
        return Object.fromEntries(
          Object.entries(current).map(([path, meta]) => [path, meta.writing ? { ...meta, writing: false } : meta]),
        )
      })
      setBusy(false)
      inputRef.current?.focus()
    }
  }

  const counts: Record<PanelTab, number> = { code: files.length, traces: turns.length, usage: 0 }
  const compactPanel = panelMode === 'split' && (panelWidth ?? 800) < 600

  return (
    <div className={cn('flex h-screen flex-col bg-background', dragging && 'cursor-col-resize select-none')}>
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <Brand />
        <SectionNav />
        <span className="hidden h-4 w-px bg-border xl:block" />
        <div className="hidden min-w-0 items-center gap-2 text-[12px] text-muted-foreground xl:flex">
          <span className="truncate">Governed by LaunchDarkly Agent Control</span>
          <span className="rounded border bg-surface px-1.5 py-px font-mono text-[11px]">{CONFIG_KEY}</span>
          <span className="flex items-center gap-1 rounded border bg-surface px-1.5 py-px text-[11px]">
            <span className="h-1.5 w-1.5 rounded-full bg-success" />
            production
          </span>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <PersonPicker value={personKey} onChange={setPersonKey} />
          <ThemeToggle />
          <button
            onClick={reset}
            title="Start a new session"
            className="flex h-8 items-center gap-1.5 rounded-md border px-2.5 text-[12.5px] text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">New session</span>
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <section
          className={cn('flex min-w-0 flex-1 flex-col', panelMode === 'expanded' && 'hidden')}
          style={{ minWidth: panelMode === 'split' ? MIN_CHAT : undefined }}
        >
          <div
            ref={chatRef}
            onScroll={(event) => {
              const node = event.currentTarget
              stickRef.current = node.scrollHeight - node.scrollTop - node.clientHeight < 80
            }}
            className="thin-scroll min-h-0 flex-1 overflow-y-auto"
          >
            <div className="mx-auto max-w-[760px] px-6 pb-6 pt-8">
              {messages.length === 0 ? (
                <EmptyState person={person} onPick={(text, type) => send(text, type)} />
              ) : (
                messages.map((message) => {
                  if (message.role === 'user') {
                    return (
                      <div key={message.id} className="mb-6 flex flex-col items-end">
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-muted px-4 py-2.5 text-[14px] leading-6">
                          {message.text}
                        </div>
                        <span className="mt-1 pr-1 text-[11px] text-subtle">
                          {message.author} · {requestLabel(message.requestType ?? '')}
                        </span>
                      </div>
                    )
                  }
                  const turn = turns.find((item) => item.id === message.id)
                  const lastFile = message.files[message.files.length - 1]
                  const lastRead = message.reads?.[message.reads.length - 1]
                  return (
                    <div key={message.id} className="mb-8">
                      <div className="mb-1.5 flex items-center gap-2 text-[12.5px]">
                        <span className={cn('h-2 w-2 rounded-full', agentDot(message.variationKey))} />
                        <span className="font-medium">{message.agentName ?? 'Agent Control'}</span>
                        {message.model && (
                          <span className="font-mono text-[11.5px] text-muted-foreground">{message.model}</span>
                        )}
                      </div>
                      {message.reason && (
                        <div className="mb-2.5 flex items-start gap-1.5 text-[12px] leading-5 text-muted-foreground">
                          <Route className="mt-0.5 h-3 w-3 shrink-0 text-subtle" />
                          {message.reason}
                        </div>
                      )}
                      <div className="text-[14px] leading-6">
                        {message.text ? (
                          <div className={cn(!message.done && 'streaming-caret')}>
                            <Markdown text={message.text} />
                          </div>
                        ) : (
                          !message.done && (
                            <Thinking
                              label={
                                message.writing
                                  ? `Writing ${message.writing} in the code view`
                                  : (lastRead ??
                                    (lastFile
                                      ? `Writing ${lastFile}`
                                      : message.agentName
                                        ? 'Thinking'
                                        : 'Asking Agent Control for an agent'))
                              }
                            />
                          )
                        )}
                      </div>
                      {message.writing && !message.done && (
                        <div className="mt-2 flex items-center gap-2 text-[12.5px] text-muted-foreground">
                          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
                          Writing {message.writing} in the code view
                        </div>
                      )}
                      {!!message.reads?.length && (
                        <ChipRow count={message.reads.length}>
                          {message.reads.map((read) => (
                            <span
                              key={read}
                              className="shrink-0 whitespace-nowrap rounded-md border bg-surface px-2 py-1 font-mono text-[11.5px] text-muted-foreground"
                            >
                              {read}
                            </span>
                          ))}
                        </ChipRow>
                      )}
                      {message.files.length > 0 && (
                        <ChipRow count={message.files.length}>
                          {message.files.map((path) => (
                            <button
                              key={path}
                              onClick={() => openFile(path)}
                              className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-md border bg-surface px-2 py-1 font-mono text-[11.5px] hover:border-border-strong hover:bg-accent"
                            >
                              <FileIcon path={path} className="h-3 w-3" />
                              {path}
                            </button>
                          ))}
                        </ChipRow>
                      )}
                      {message.error && (
                        <div className="mt-3 flex items-start gap-2 rounded-md border border-danger/30 bg-danger/5 px-3 py-2 text-[12.5px] text-danger">
                          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                          {message.error}
                        </div>
                      )}
                      {turn && (
                        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
                          <span className="font-mono">
                            {formatTokens(turn.inputTokens)} in · {formatTokens(turn.outputTokens)} out
                          </span>
                          <span className="font-mono">{formatUsd(turn.costUsd)}</span>
                          <span className="font-mono">{formatSeconds(turn.latencyMs)}</span>
                          <button
                            onClick={() => openTrace(turn.id)}
                            className="-ml-1 flex items-center gap-1 rounded px-1.5 py-0.5 hover:bg-accent hover:text-foreground"
                          >
                            <Activity className="h-3 w-3" />
                            View trace
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <div className="shrink-0 px-6 pb-4">
            <div className="mx-auto max-w-[760px]">
              <div className="rounded-xl border bg-raised shadow-composer transition-colors focus-within:border-border-strong">
                <textarea
                  ref={inputRef}
                  value={draft}
                  rows={1}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                      event.preventDefault()
                      send(draft)
                    }
                  }}
                  placeholder="Describe what to build or change…"
                  className="block min-h-[52px] w-full resize-none bg-transparent px-4 pt-3.5 text-[14px] leading-6 outline-none placeholder:text-subtle"
                />
                <div className="flex items-center gap-2 px-2.5 pb-2.5 pt-1">
                  <div className="flex shrink-0 items-center rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Request type">
                    {REQUEST_TYPES.map((item) => (
                      <button
                        key={item.key}
                        role="radio"
                        aria-checked={requestType === item.key}
                        title={item.hint}
                        onClick={() => setRequestType(item.key)}
                        className={cn(
                          'rounded-md px-2.5 py-1 text-[12px] text-muted-foreground transition-colors hover:text-foreground',
                          requestType === item.key && 'bg-raised text-foreground shadow-sm ring-1 ring-border',
                        )}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                  <div
                    title={preview.reason}
                    className="ml-auto flex min-w-0 items-center gap-1.5 text-[11.5px] text-muted-foreground"
                  >
                    <Route className="h-3.5 w-3.5 shrink-0 text-subtle" />
                    <span className="hidden truncate lg:inline">Agent Control serves</span>
                    <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', agentDot(preview.variationKey))} />
                    <span className="truncate text-foreground">{preview.name}</span>
                  </div>
                  <button
                    onClick={() => (busy ? stop() : send(draft))}
                    disabled={!busy && !draft.trim()}
                    title={busy ? 'Stop' : 'Send'}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-opacity disabled:opacity-25"
                  >
                    {busy ? <Square className="h-3 w-3 fill-current" /> : <ArrowUp className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="mt-2 flex items-center justify-between gap-3 px-1 text-[11px] text-subtle">
                <span className="truncate">Enter to send · Shift+Enter for a new line · ⌘B toggles the panel</span>
                <span className="shrink-0 font-mono">
                  {turns.length} turns · {formatTokens(totals.tokens)} tok · {formatUsd(totals.cost)}
                </span>
              </div>
            </div>
          </div>
        </section>

        {panelMode === 'split' && (
          <div
            onPointerDown={startDrag}
            onDoubleClick={() => setPanelWidth(clampWidth(window.innerWidth * 0.54))}
            title="Drag to resize · double-click to reset"
            className="group relative w-px shrink-0 cursor-col-resize bg-border"
          >
            <span className="absolute inset-y-0 -left-2 -right-2 z-20" />
            <span
              className={cn(
                'absolute inset-y-0 -left-px w-[3px] transition-colors group-hover:bg-brand/60',
                dragging && 'bg-brand/60',
              )}
            />
          </div>
        )}

        {panelMode === 'collapsed' ? (
          <aside className="flex w-12 shrink-0 flex-col items-center gap-1 border-l bg-surface py-2">
            <IconButton title="Open panel (⌘B)" onClick={() => setPanelMode('split')}>
              <PanelRightOpen className="h-4 w-4" />
            </IconButton>
            <span className="my-1 h-px w-6 bg-border" />
            {TABS.map(({ key, label, Icon }) => (
              <button
                key={key}
                title={label}
                onClick={() => openTab(key)}
                className="relative flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <Icon className="h-4 w-4" />
                {counts[key] > 0 && (
                  <span className="absolute right-0.5 top-0.5 min-w-[15px] rounded-full bg-primary px-1 text-center text-[9.5px] font-medium leading-[15px] text-primary-foreground">
                    {counts[key]}
                  </span>
                )}
              </button>
            ))}
          </aside>
        ) : (
          <aside
            className={cn('flex min-w-0 flex-col bg-background', panelMode === 'expanded' ? 'flex-1' : 'shrink-0')}
            style={panelMode === 'split' ? { width: panelWidth ?? '54%' } : undefined}
          >
            <div className="flex h-10 shrink-0 items-center gap-1 border-b px-2">
              {TABS.map(({ key, label, Icon }) => (
                <button
                  key={key}
                  onClick={() => setTab(key)}
                  className={cn(
                    'flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[12.5px] text-muted-foreground hover:text-foreground',
                    tab === key && 'bg-accent text-foreground',
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                  {counts[key] > 0 && (
                    <span className="rounded bg-background px-1 font-mono text-[10.5px] text-muted-foreground ring-1 ring-border">
                      {counts[key]}
                    </span>
                  )}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-0.5">
                {panelMode === 'expanded' ? (
                  <IconButton title="Restore split view (Esc)" onClick={() => setPanelMode('split')}>
                    <Minimize2 className="h-3.5 w-3.5" />
                  </IconButton>
                ) : (
                  <IconButton title="Expand to full width" onClick={() => setPanelMode('expanded')}>
                    <Maximize2 className="h-3.5 w-3.5" />
                  </IconButton>
                )}
                <IconButton title="Minimize panel (⌘B)" onClick={() => setPanelMode('collapsed')}>
                  <PanelRightClose className="h-4 w-4" />
                </IconButton>
              </div>
            </div>
            <div className="min-h-0 flex-1">
              {tab === 'code' && (
                <CodeWorkspace
                  files={files}
                  meta={fileMeta}
                  openTabs={openTabs}
                  activePath={activePath}
                  recentPath={recentPath}
                  onOpen={openFile}
                  onClose={closeTab}
                  compact={compactPanel}
                />
              )}
              {tab === 'traces' && (
                <TraceWaterfall turns={turns} activeId={activeTurn} onSelectTurn={setActiveTurn} sessionId={sessionId} />
              )}
              {tab === 'usage' && <UsageView turns={turns} onOpenTrace={openTrace} />}
            </div>
          </aside>
        )}
      </div>
    </div>
  )
}
