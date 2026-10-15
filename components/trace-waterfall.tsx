'use client'

import { Activity, Check, Copy, Info } from 'lucide-react'
import { Fragment, useEffect, useMemo, useState } from 'react'
import { formatTokens, formatUsd, type SpanView } from '@/lib/demo'
import { cn } from '@/lib/cn'
import type { TurnTrace } from './types'

type Row = { span: SpanView; depth: number; guides: boolean[]; last: boolean }

const GUIDE = 14

function buildRows(spans: SpanView[]): Row[] {
  const ids = new Set(spans.map((span) => span.spanId))
  const children = new Map<string, SpanView[]>()
  for (const span of spans) {
    const parent = span.parentSpanId && ids.has(span.parentSpanId) ? span.parentSpanId : ''
    const list = children.get(parent) ?? []
    list.push(span)
    children.set(parent, list)
  }
  children.forEach((list) => list.sort((a, b) => a.startMs - b.startMs || b.durationMs - a.durationMs))

  const rows: Row[] = []
  const walk = (parent: string, depth: number, guides: boolean[]) => {
    const list = children.get(parent) ?? []
    list.forEach((span, index) => {
      const last = index === list.length - 1
      rows.push({ span, depth, guides, last })
      walk(span.spanId, depth + 1, depth === 0 ? [] : [...guides, !last])
    })
  }
  walk('', 0, [])
  return rows
}

function displayName(span: SpanView) {
  return span.name
}

function barClass(span: SpanView) {
  const name = span.name
  if (span.source === 'your code') return 'bg-trace-code'
  if (span.source === 'Agent Control') return 'bg-trace-control'
  if (name.includes('model_request')) return 'bg-trace-model'
  if (name.includes('tool_use')) return 'bg-trace-tool'
  if (name.includes('messages.create')) return 'bg-trace-request ring-1 ring-inset ring-trace-request-border'
  return 'bg-trace-runner'
}

function annotate(span: SpanView, agentName: string) {
  const stop = span.attributes['anthropic.message.stop_reason']
  if (span.source === 'Agent Control') return `serves ${agentName}`
  if (span.name.includes('model_request')) return undefined
  if (span.name.startsWith('anthropic.messages.create')) {
    if (span.kind === 'server') return undefined
    if (stop === 'tool_use') return 'asks to use a tool'
    if (stop === 'end_turn') return 'final answer'
    if (stop === 'max_tokens') return 'hit max tokens'
    if (stop === 'pause_turn') return 'pauses for a server tool'
    return undefined
  }
  if (span.name.startsWith('anthropic.custom_tool_use')) return 'runs your tool'
  if (span.name.startsWith('anthropic.tool_use')) return 'the API runs the tool'
  return undefined
}

function formatMs(ms: number) {
  if (ms < 1) return '<1 ms'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toFixed(ms < 10_000 ? 2 : 1)} s`
}

function tickStep(total: number) {
  const steps = [50, 100, 200, 250, 500, 1000, 2000, 2500, 5000, 10_000, 20_000, 30_000, 60_000]
  return steps.find((step) => total / step <= 6) ?? 60_000
}

function tickLabel(ms: number) {
  if (ms === 0) return '0'
  return ms >= 1000 ? `${ms / 1000} s` : `${ms} ms`
}

function Connectors({ row }: { row: Row }) {
  if (row.depth === 0) return null
  return (
    <div className="flex h-full shrink-0 self-stretch">
      {row.guides.map((open, index) => (
        <span key={index} className="relative h-full" style={{ width: GUIDE }}>
          {open && <span className="absolute bottom-0 left-[6px] top-0 w-px bg-border-strong" />}
        </span>
      ))}
      <span className="relative h-full" style={{ width: GUIDE }}>
        <span
          className={cn('absolute left-[6px] top-0 w-px bg-border-strong', row.last ? 'h-1/2' : 'h-full')}
        />
        <span className="absolute left-[6px] top-1/2 h-px w-[7px] bg-border-strong" />
      </span>
    </div>
  )
}

function KindBadge({ kind }: { kind: SpanView['kind'] }) {
  if (kind === 'internal') return null
  return (
    <span className="shrink-0 rounded border px-1 py-px font-mono text-[9.5px] font-medium uppercase tracking-wide text-muted-foreground">
      {kind}
    </span>
  )
}

function Attribute({ name, value }: { name: string; value: string | number | boolean }) {
  return (
    <>
      <dt className="truncate font-mono text-[11.5px] text-muted-foreground" title={name}>
        {name}
      </dt>
      <dd className="break-all font-mono text-[11.5px]">{String(value)}</dd>
    </>
  )
}

function SpanDetails({ span, origin }: { span: SpanView; origin: number }) {
  const attributes = Object.entries(span.attributes).sort(([a], [b]) => a.localeCompare(b))
  return (
    <div className="border-t bg-surface px-4 py-3">
      <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
        <span className="font-mono text-[12.5px] font-medium">{displayName(span)}</span>
        <KindBadge kind={span.kind} />
        <span className="text-[12px] text-muted-foreground">{span.source}</span>
        <span className="font-mono text-[12px] text-muted-foreground">
          +{formatMs(span.startMs - origin)} · {formatMs(span.durationMs)}
        </span>
        {span.status === 'error' && <span className="text-[12px] font-medium text-danger">error</span>}
      </div>
      {attributes.length ? (
        <dl className="grid grid-cols-[minmax(160px,40%)_1fr] gap-x-4 gap-y-1">
          <Attribute name="span_id" value={span.spanId} />
          {attributes.map(([name, value]) => (
            <Attribute key={name} name={name} value={value} />
          ))}
        </dl>
      ) : (
        <p className="text-[12px] text-muted-foreground">No attributes recorded.</p>
      )}
    </div>
  )
}

const LEGEND: { label: string; className: string }[] = [
  { label: 'Your code', className: 'bg-trace-code' },
  { label: 'Agent Control', className: 'bg-trace-control' },
  { label: 'Agent loop', className: 'bg-trace-runner' },
  { label: 'Model call', className: 'bg-trace-request ring-1 ring-inset ring-trace-request-border' },
  { label: 'Tool', className: 'bg-trace-tool' },
]

export function TraceWaterfall({
  turns,
  activeId,
  onSelectTurn,
  sessionId,
}: {
  turns: TurnTrace[]
  activeId?: string
  onSelectTurn: (id: string) => void
  sessionId: string
}) {
  const turn = turns.find((item) => item.id === activeId) ?? turns[turns.length - 1]
  const [selected, setSelected] = useState<string>()
  const [copied, setCopied] = useState(false)

  useEffect(() => setSelected(undefined), [turn?.id])

  const rows = useMemo(() => buildRows(turn?.spans ?? []), [turn])
  const origin = rows.length ? Math.min(...rows.map((row) => row.span.startMs)) : 0
  const end = rows.length ? Math.max(...rows.map((row) => row.span.startMs + row.span.durationMs)) : 0
  const total = Math.max(end - origin, 1)
  const step = tickStep(total)
  const ticks = Array.from({ length: Math.floor(total / step) + 1 }, (_, index) => index * step)
  const selectedSpan = rows.find((row) => row.span.spanId === selected)?.span

  if (!turn) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
        <Activity className="h-6 w-6 text-subtle" />
        <p className="text-sm font-medium">No traces yet</p>
        <p className="max-w-xs text-[13px] leading-5 text-muted-foreground">
          Every turn is traced with Claude&apos;s OpenTelemetry spans and shows up here as a waterfall.
        </p>
      </div>
    )
  }

  async function copyTrace() {
    if (!turn?.traceId) return
    await navigator.clipboard.writeText(turn.traceId)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="thin-scroll flex shrink-0 items-center gap-1 overflow-x-auto border-b bg-surface px-2 py-1.5">
        {turns.map((item) => (
          <button
            key={item.id}
            onClick={() => onSelectTurn(item.id)}
            className={cn(
              'flex shrink-0 items-center gap-2 rounded-md px-2.5 py-1 text-[12px]',
              item.id === turn.id
                ? 'bg-raised text-foreground shadow-sm ring-1 ring-border'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground',
            )}
          >
            <span className="font-mono text-subtle">#{item.index}</span>
            <span>{item.agentName}</span>
            <span className="font-mono text-subtle">{formatMs(item.latencyMs)}</span>
          </button>
        ))}
      </div>

      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
        <div className="grid grid-cols-2 gap-px border-b bg-border sm:grid-cols-5">
          {[
            ['Agent', turn.agentName],
            ['Model', turn.model],
            ['Tokens', `${formatTokens(turn.inputTokens)} in · ${formatTokens(turn.outputTokens)} out`],
            ['Cost', formatUsd(turn.costUsd)],
            ['Duration', formatMs(turn.latencyMs)],
          ].map(([label, value]) => (
            <div key={label} className="bg-background px-4 py-2.5">
              <div className="text-[11px] text-muted-foreground">{label}</div>
              <div className={cn('truncate text-[13px] font-medium', label === 'Model' && 'font-mono text-[12.5px]')}>
                {value}
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2 text-[11.5px] text-muted-foreground">
          <button onClick={copyTrace} className="flex items-center gap-1 font-mono hover:text-foreground" title="Copy trace ID">
            trace {turn.traceId?.slice(0, 16)}
            {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          </button>
          <span className="font-mono">conversation {sessionId.slice(0, 8)}</span>
          <span>{rows.length} spans</span>
        </div>

        <div className="mx-4 mb-3 overflow-hidden rounded-lg border">
          <div className="grid grid-cols-[minmax(250px,42%)_92px_1fr] border-b bg-surface text-[11.5px] font-medium text-muted-foreground">
            <div className="px-3 py-2">Span</div>
            <div className="px-2 py-2">Source</div>
            <div className="relative px-2 py-2">
              Time →
              <div className="pointer-events-none absolute inset-x-2 bottom-0.5 h-3">
                {ticks.map((tick) => (
                  <span
                    key={tick}
                    className="absolute -translate-x-1/2 font-mono text-[9.5px] font-normal text-subtle first:translate-x-0"
                    style={{ left: `${(tick / total) * 100}%` }}
                  >
                    {tick > 0 && (tick / total) * 100 > 92 ? '' : tickLabel(tick)}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {rows.map((row, index) => {
            const { span } = row
            const left = ((span.startMs - origin) / total) * 100
            const width = Math.max((span.durationMs / total) * 100, 0.4)
            const right = left + width
            const note = annotate(span, turn.agentName)
            const ttft = Number(span.attributes['gen_ai.response.time_to_first_chunk'] ?? 0) * 1000
            const isSelected = span.spanId === selected
            return (
              <Fragment key={span.spanId}>
                <button
                  onClick={() => setSelected(isSelected ? undefined : span.spanId)}
                  className={cn(
                    'grid h-8 w-full grid-cols-[minmax(250px,42%)_92px_1fr] text-left text-[12.5px]',
                    index % 2 === 1 && 'bg-trace-stripe',
                    isSelected ? 'bg-brand-soft' : 'hover:bg-accent/60',
                  )}
                >
                  <div className="flex h-8 min-w-0 items-center gap-1.5 pl-3 pr-2">
                    <Connectors row={row} />
                    <span className={cn('truncate font-mono', span.status === 'error' && 'text-danger')}>
                      {displayName(span)}
                    </span>
                    <KindBadge kind={span.kind} />
                    <span className="ml-auto shrink-0 pl-2 font-mono text-[11px] text-subtle">
                      {formatMs(span.durationMs)}
                    </span>
                  </div>
                  <div className="flex h-8 items-center px-2 text-[12px] text-muted-foreground">{span.source}</div>
                  <div className="relative mx-2 h-8">
                    {ticks.map((tick) => (
                      <span
                        key={tick}
                        className="absolute bottom-0 top-0 w-px bg-trace-grid"
                        style={{ left: `${(tick / total) * 100}%` }}
                      />
                    ))}
                    <span
                      className={cn(
                        'absolute top-1/2 h-3.5 -translate-y-1/2 rounded-[3px]',
                        barClass(span),
                        span.status === 'error' && 'ring-2 ring-danger',
                      )}
                      style={{ left: `${left}%`, width: `${width}%`, minWidth: 3 }}
                    >
                      {ttft > 0 && ttft < span.durationMs && (
                        <span
                          title={`First token after ${formatMs(ttft)}`}
                          className="absolute bottom-0 top-0 w-px bg-trace-request-border"
                          style={{ left: `${(ttft / span.durationMs) * 100}%` }}
                        />
                      )}
                    </span>
                    {note && (
                      <span
                        className="absolute top-1/2 -translate-y-1/2 whitespace-nowrap text-[11.5px] italic text-muted-foreground"
                        style={
                          right < 68
                            ? { left: `calc(${right}% + 8px)` }
                            : left > 28
                              ? { right: `calc(${100 - left}% + 8px)` }
                              : { left: `calc(${left}% + 8px)` }
                        }
                      >
                        {note}
                      </span>
                    )}
                  </div>
                </button>
                {isSelected && <SpanDetails span={span} origin={origin} />}
              </Fragment>
            )
          })}
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 pb-2 text-[11.5px] text-muted-foreground">
          {LEGEND.map((item) => (
            <span key={item.label} className="flex items-center gap-1.5">
              <span className={cn('h-2.5 w-4 rounded-[2px]', item.className)} />
              {item.label}
            </span>
          ))}
        </div>
        <p className="flex gap-1.5 px-4 pb-4 text-[11.5px] leading-5 text-subtle">
          <Info className="mt-0.5 h-3 w-3 shrink-0" />
          Spans from your code, Agent Control and the Anthropic SDK, also exported to LaunchDarkly Observability. API-side
          spans (SERVER requests, model_request) join this tree once the Claude org sends telemetry to the same collector.
        </p>
      </div>
    </div>
  )
}
