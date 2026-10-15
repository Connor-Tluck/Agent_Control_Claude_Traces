'use client'

import { ArrowUpRight, BarChart3, Search } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatTokens, formatUsd, REQUEST_TYPES } from '@/lib/demo'
import { monitoringUrl, traceUrl, tracesUrl } from '@/lib/launchdarkly'
import { cn } from '@/lib/cn'
import { filterUsage, summarizeUsage, type RangeKey, type UsageEvent, type UsageGroup, type UsageSummary } from '@/lib/usage'
import { agentDot } from './agents'
import { Brand, SectionNav } from './brand'
import { ThemeToggle } from './theme-toggle'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '24h', label: '24h' },
  { key: '7d', label: '7d' },
  { key: '30d', label: '30d' },
  { key: 'all', label: 'All' },
]

const TEAMS = ['all', 'support', 'product', 'platform'] as const

const REQUEST_COLOR: Record<string, string> = {
  'quick-fix': 'bg-sky-500',
  feature: 'bg-blue-500',
  architecture: 'bg-indigo-500',
}

const TEAM_COLOR: Record<string, string> = {
  support: 'bg-teal-500',
  product: 'bg-blue-500',
  platform: 'bg-violet-500',
}

function requestLabel(key: string) {
  return REQUEST_TYPES.find((item) => item.key === key)?.label ?? key
}

function seconds(ms: number) {
  if (!ms) return '0s'
  if (ms < 1000) return `${Math.round(ms)}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

function ago(iso: string, now: number) {
  const secondsAgo = Math.max(0, (now - Date.parse(iso)) / 1000)
  if (secondsAgo < 60) return 'just now'
  if (secondsAgo < 3600) return `${Math.floor(secondsAgo / 60)}m ago`
  if (secondsAgo < 86400) return `${Math.floor(secondsAgo / 3600)}h ago`
  return `${Math.floor(secondsAgo / 86400)}d ago`
}

function ExternalButton({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="flex h-8 items-center gap-1.5 rounded-md border bg-surface px-2.5 text-[12.5px] text-foreground hover:bg-accent"
    >
      {children}
      <ArrowUpRight className="h-3.5 w-3.5 text-subtle" />
    </a>
  )
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="bg-background px-4 py-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className="mt-0.5 text-[22px] font-semibold tabular-nums tracking-tight">{value}</div>
      {hint && <div className="mt-0.5 truncate text-[11.5px] text-subtle">{hint}</div>}
    </div>
  )
}

function SpendChart({ summary }: { summary: UsageSummary }) {
  const variations = [...new Set(summary.series.flatMap((bucket) => Object.keys(bucket.byVariation)))]
  const max = Math.max(...summary.series.map((bucket) => bucket.cost), 0)
  const labels = summary.series.filter((_, index) => index === 0 || index === summary.series.length - 1 || index === Math.floor(summary.series.length / 2))
  return (
    <div>
      <div className="flex h-40 items-end gap-[3px]">
        {summary.series.map((bucket) => {
          const barPx = max > 0 && bucket.cost > 0 ? Math.max(4, Math.round((bucket.cost / max) * 160)) : 0
          const entries = Object.entries(bucket.byVariation).filter(([, value]) => value > 0)
          const segmentTotal = entries.reduce((sum, [, value]) => sum + value, 0) || 1
          return (
            <div key={bucket.start} className="group relative flex h-full min-w-0 flex-1 items-end">
              <div className="flex w-full flex-col-reverse overflow-hidden rounded-[3px]" style={{ height: barPx }}>
                {entries.map(([key, value]) => (
                  <div
                    key={key}
                    className={cn('w-full', agentDot(key))}
                    style={{ height: Math.max(1, Math.round((value / segmentTotal) * barPx)) }}
                  />
                ))}
              </div>
              <div
                className="pointer-events-none absolute left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-md border bg-raised px-2 py-1 text-[11px] shadow-md group-hover:block"
                style={{ bottom: barPx + 6 }}
              >
                <div className="font-medium">{bucket.label}</div>
                <div className="text-muted-foreground">
                  {formatUsd(bucket.cost)} · {bucket.requests} requests
                </div>
              </div>
            </div>
          )
        })}
      </div>
      <div className="mt-2 flex justify-between text-[10.5px] text-subtle">
        {labels.map((bucket) => (
          <span key={bucket.start}>{bucket.label}</span>
        ))}
      </div>
      {variations.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-[11.5px] text-muted-foreground">
          {summary.byModel.map((row) => (
            <span key={row.key} className="flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', agentDot(row.key))} />
              {row.label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

function RankBars({ rows, colorOf, format = 'cost' }: { rows: UsageGroup[]; colorOf: (key: string) => string; format?: 'cost' | 'requests' }) {
  const max = Math.max(...rows.map((row) => (format === 'cost' ? row.costUsd : row.requests)), 0)
  if (!rows.length) return <p className="py-6 text-[12.5px] text-muted-foreground">No requests in this range.</p>
  return (
    <div className="space-y-2.5">
      {rows.map((row) => {
        const value = format === 'cost' ? row.costUsd : row.requests
        return (
          <div key={row.key}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-[12.5px]">
              <span className={cn('min-w-0 truncate', format === 'requests' && 'capitalize')}>
                <span className="font-medium">{requestLabel(row.label)}</span>
                {row.detail && <span className="ml-1.5 font-mono text-[11px] text-muted-foreground">{row.detail}</span>}
              </span>
              <span className="shrink-0 font-mono text-[11.5px] text-muted-foreground">
                {format === 'cost' ? `${formatUsd(row.costUsd)} · ${row.requests}` : row.requests}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <div className={cn('h-full rounded-full', colorOf(row.key))} style={{ width: `${max ? (value / max) * 100 : 0}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function AnalyticsDashboard() {
  const [events, setEvents] = useState<UsageEvent[] | null>(null)
  const [error, setError] = useState<string>()
  const [range, setRange] = useState<RangeKey>('7d')
  const [team, setTeam] = useState<(typeof TEAMS)[number]>('all')
  const [query, setQuery] = useState('')
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let active = true
    const load = async () => {
      try {
        const response = await fetch('/api/analytics', { cache: 'no-store' })
        if (!response.ok) throw new Error('Analytics could not be loaded.')
        const body = (await response.json()) as { events: UsageEvent[] }
        if (!active) return
        setEvents(body.events ?? [])
        setNow(Date.now())
        setError(undefined)
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Analytics could not be loaded.')
      }
    }
    load()
    const timer = window.setInterval(load, 8000)
    return () => {
      active = false
      window.clearInterval(timer)
    }
  }, [])

  const filtered = useMemo(
    () => (events ? filterUsage(events, range, team, query, now) : []),
    [events, range, team, query, now],
  )
  const summary = useMemo(() => summarizeUsage(filtered, range, now), [filtered, range, now])
  const saved = summary.baselineUsd > 0 ? 1 - summary.costUsd / summary.baselineUsd : 0
  const recent = [...filtered].sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 80)

  return (
    <div className="flex h-screen flex-col bg-background">
      <header className="flex h-12 shrink-0 items-center gap-3 border-b px-4">
        <Brand />
        <SectionNav />
        <div className="ml-auto flex items-center gap-2">
          <ExternalButton href={monitoringUrl()}>Monitoring</ExternalButton>
          <ExternalButton href={tracesUrl()}>Traces</ExternalButton>
          <ThemeToggle />
        </div>
      </header>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[1180px] px-6 py-6">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-[22px] font-semibold tracking-tight">Product usage</h1>
              <p className="mt-1 max-w-xl text-[13.5px] leading-5 text-muted-foreground">
                Every coding request across Northwind: who asked, which agent served it, what it cost, and the trace
                LaunchDarkly stored.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Time range">
                {RANGES.map((item) => (
                  <button
                    key={item.key}
                    role="radio"
                    aria-checked={range === item.key}
                    onClick={() => setRange(item.key)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[12.5px] text-muted-foreground hover:text-foreground',
                      range === item.key && 'bg-raised text-foreground shadow-sm ring-1 ring-border',
                    )}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
              <div className="flex rounded-lg bg-muted p-0.5" role="radiogroup" aria-label="Team">
                {TEAMS.map((item) => (
                  <button
                    key={item}
                    role="radio"
                    aria-checked={team === item}
                    onClick={() => setTeam(item)}
                    className={cn(
                      'rounded-md px-2.5 py-1 text-[12.5px] capitalize text-muted-foreground hover:text-foreground',
                      team === item && 'bg-raised text-foreground shadow-sm ring-1 ring-border',
                    )}
                  >
                    {item === 'all' ? 'All teams' : item}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {error && <p className="mt-4 text-[13px] text-danger">{error}</p>}
          {events === null && !error && <p className="mt-8 text-[13px] text-muted-foreground">Loading usage…</p>}

          {events && events.length === 0 && (
            <div className="mt-16 flex flex-col items-center text-center">
              <BarChart3 className="h-6 w-6 text-subtle" />
              <p className="mt-3 text-sm font-medium">No requests recorded yet</p>
              <p className="mt-1 max-w-md text-[13px] leading-5 text-muted-foreground">
                Send a request from the workbench. It lands here with its cost and a link to the same trace in
                LaunchDarkly. Generations already tracked by the SDK are on the monitoring tab.
              </p>
              <div className="mt-4 flex gap-2">
                <Link href="/" className="rounded-md bg-primary px-3 py-1.5 text-[12.5px] text-primary-foreground">
                  Open the workbench
                </Link>
                <ExternalButton href={monitoringUrl()}>LaunchDarkly monitoring</ExternalButton>
              </div>
            </div>
          )}

          {events && events.length > 0 && (
            <>
              <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border bg-border sm:grid-cols-3 xl:grid-cols-6">
                <Stat label="Requests" value={String(summary.requests)} hint={`${summary.sessions} sessions`} />
                <Stat
                  label="People"
                  value={String(summary.people)}
                  hint={summary.errors ? `${summary.errors} ${summary.errors === 1 ? 'error' : 'errors'}` : 'No errors'}
                />
                <Stat label="Input tokens" value={formatTokens(summary.inputTokens)} />
                <Stat label="Output tokens" value={formatTokens(summary.outputTokens)} />
                <Stat label="Spend" value={formatUsd(summary.costUsd)} hint={`vs ${formatUsd(summary.baselineUsd)} on Opus`} />
                <Stat label="Avg latency" value={seconds(summary.avgLatencyMs)} />
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-surface px-4 py-3">
                <p className="text-[13px] leading-5 text-muted-foreground">
                  <span className="font-medium text-foreground">
                    {saved > 0 ? `${Math.round(saved * 100)}% less` : 'No savings yet'}
                  </span>{' '}
                  than sending every request to the deep agent. Agent Control monitoring shows the same generations,
                  broken out by variation.
                </p>
                <a
                  href={monitoringUrl()}
                  target="_blank"
                  rel="noreferrer"
                  className="flex shrink-0 items-center gap-1 text-[12.5px] font-medium hover:underline"
                >
                  Open monitoring
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </a>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-5">
                <section className="rounded-xl border p-4 lg:col-span-3">
                  <h2 className="text-[13px] font-medium">Spend</h2>
                  <p className="mb-4 text-[12px] text-muted-foreground">Estimated cost, stacked by the agent that served it</p>
                  <SpendChart summary={summary} />
                </section>
                <div className="flex flex-col gap-4 lg:col-span-2">
                  <section className="rounded-xl border p-4">
                    <h2 className="mb-3 text-[13px] font-medium">By agent</h2>
                    <RankBars rows={summary.byModel} colorOf={agentDot} />
                  </section>
                  <section className="rounded-xl border p-4">
                    <h2 className="mb-3 text-[13px] font-medium">By team</h2>
                    <RankBars rows={summary.byTeam} colorOf={(key) => TEAM_COLOR[key] ?? 'bg-zinc-400'} format="requests" />
                  </section>
                </div>
              </div>

              <section className="mt-4 rounded-xl border p-4">
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className="text-[13px] font-medium">Request type</h2>
                  <span className="text-[12px] text-muted-foreground">Quick fixes stay on the cost agent. Architecture always uses the deep agent.</span>
                </div>
                <div className="flex h-2 overflow-hidden rounded-full bg-muted">
                  {summary.byRequest.map((row) => (
                    <div
                      key={row.key}
                      className={REQUEST_COLOR[row.key] ?? 'bg-zinc-400'}
                      style={{ width: `${summary.requests ? (row.requests / summary.requests) * 100 : 0}%` }}
                      title={`${requestLabel(row.label)} · ${row.requests}`}
                    />
                  ))}
                </div>
                <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-muted-foreground">
                  {summary.byRequest.map((row) => (
                    <span key={row.key} className="flex items-center gap-1.5">
                      <span className={cn('h-2 w-2 rounded-full', REQUEST_COLOR[row.key] ?? 'bg-zinc-400')} />
                      {requestLabel(row.label)}
                      <span className="font-mono">{row.requests}</span>
                      <span className="font-mono text-subtle">{formatUsd(row.costUsd)}</span>
                    </span>
                  ))}
                </div>
              </section>

              <section className="mt-4 overflow-hidden rounded-xl border">
                <div className="border-b px-4 py-3">
                  <h2 className="text-[13px] font-medium">People</h2>
                </div>
                <div className="thin-scroll overflow-x-auto">
                  <table className="w-full min-w-[720px] text-[12.5px]">
                    <thead className="bg-surface text-left text-[11.5px] text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2 font-medium">Person</th>
                        <th className="px-3 py-2 text-right font-medium">Requests</th>
                        <th className="px-3 py-2 text-right font-medium">Input</th>
                        <th className="px-3 py-2 text-right font-medium">Output</th>
                        <th className="px-3 py-2 text-right font-medium">Avg latency</th>
                        <th className="px-4 py-2 text-right font-medium">Spend</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {summary.byPerson.map((row) => (
                        <tr key={row.key}>
                          <td className="px-4 py-2.5">
                            <div className="font-medium">{row.label}</div>
                            <div className="text-[11.5px] capitalize text-muted-foreground">{row.detail}</div>
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{row.requests}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatTokens(row.inputTokens)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{formatTokens(row.outputTokens)}</td>
                          <td className="px-3 py-2.5 text-right tabular-nums">{seconds(row.latencyMs / row.requests)}</td>
                          <td className="px-4 py-2.5 text-right font-medium tabular-nums">{formatUsd(row.costUsd)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="mt-4 overflow-hidden rounded-xl border">
                <div className="flex flex-wrap items-center gap-3 border-b px-4 py-3">
                  <h2 className="text-[13px] font-medium">Queries</h2>
                  <span className="text-[12px] text-muted-foreground">
                    {recent.length} of {filtered.length}
                  </span>
                  <label className="ml-auto flex h-8 min-w-[220px] items-center gap-1.5 rounded-md border bg-surface px-2 text-muted-foreground focus-within:border-border-strong">
                    <Search className="h-3.5 w-3.5" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Search people, prompts, models"
                      className="w-full bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-subtle"
                    />
                  </label>
                </div>
                {recent.length === 0 ? (
                  <p className="px-4 py-8 text-center text-[13px] text-muted-foreground">Nothing matches this filter.</p>
                ) : (
                  <div className="divide-y">
                    {recent.map((event) => (
                      <div key={event.id} className="flex items-start gap-3 px-4 py-3">
                        <span className={cn('mt-1.5 h-2 w-2 shrink-0 rounded-full', agentDot(event.variationKey))} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px]">{event.prompt}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-muted-foreground">
                            <span>{event.personName}</span>
                            <span className="capitalize">{event.team}</span>
                            <span>{requestLabel(event.requestType)}</span>
                            <span>{event.agentName || 'No agent'}</span>
                            {event.model && <span className="font-mono">{event.model}</span>}
                            {event.status === 'error' && <span className="text-danger">error</span>}
                            {event.files.length > 0 && <span>{event.files.length} files</span>}
                          </p>
                        </div>
                        <div className="shrink-0 text-right font-mono text-[11.5px] text-muted-foreground">
                          <div className="text-foreground">{formatUsd(event.costUsd)}</div>
                          <div>
                            {formatTokens(event.inputTokens + event.outputTokens)} tok · {seconds(event.latencyMs)}
                          </div>
                          <div className="font-sans">{ago(event.at, now)}</div>
                        </div>
                        {event.traceId ? (
                          <a
                            href={traceUrl(event.traceId)}
                            target="_blank"
                            rel="noreferrer"
                            title="Open this trace in LaunchDarkly"
                            className="mt-1 flex shrink-0 items-center gap-1 rounded-md border px-2 py-1 text-[11.5px] hover:bg-accent"
                          >
                            Trace
                            <ArrowUpRight className="h-3 w-3 text-subtle" />
                          </a>
                        ) : (
                          <span className="mt-1 w-14 shrink-0 text-center text-[11px] text-subtle">No trace</span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <p className="mt-3 pb-2 text-[11.5px] leading-5 text-subtle">
                Spend is estimated from token counts. LaunchDarkly monitoring uses the generations the SDK tracked, and
                each Trace link opens that request in Observability.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
