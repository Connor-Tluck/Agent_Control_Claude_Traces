'use client'

import { ArrowUpRight, BarChart3 } from 'lucide-react'
import Link from 'next/link'
import { estimateCost, formatTokens, formatUsd } from '@/lib/demo'
import { cn } from '@/lib/cn'
import { agentDot } from './agents'
import type { TurnTrace } from './types'

const BASELINE_MODEL = 'claude-opus-5-5'

function seconds(ms: number) {
  return `${(ms / 1000).toFixed(1)} s`
}

function ProductLink() {
  return (
    <div className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-2 text-[12px]">
      <span className="text-muted-foreground">This session</span>
      <Link href="/analytics" className="flex items-center gap-1 font-medium hover:underline">
        All product usage
        <ArrowUpRight className="h-3 w-3" />
      </Link>
    </div>
  )
}

export function UsageView({ turns, onOpenTrace }: { turns: TurnTrace[]; onOpenTrace: (id: string) => void }) {
  if (!turns.length) {
    return (
      <div className="flex h-full flex-col">
        <ProductLink />
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
          <BarChart3 className="h-6 w-6 text-subtle" />
          <p className="text-sm font-medium">No usage yet</p>
          <p className="max-w-xs text-[13px] leading-5 text-muted-foreground">
            Tokens, cost and latency per agent build up here as the session runs.
          </p>
        </div>
      </div>
    )
  }

  const totals = turns.reduce(
    (sum, turn) => ({
      input: sum.input + turn.inputTokens,
      output: sum.output + turn.outputTokens,
      cost: sum.cost + turn.costUsd,
      latency: sum.latency + turn.latencyMs,
      baseline: sum.baseline + estimateCost(BASELINE_MODEL, turn.inputTokens, turn.outputTokens),
    }),
    { input: 0, output: 0, cost: 0, latency: 0, baseline: 0 },
  )
  const saved = totals.baseline > 0 ? 1 - totals.cost / totals.baseline : 0

  const byAgent = new Map<string, { name: string; model: string; turns: number; input: number; output: number; cost: number; latency: number }>()
  for (const turn of turns) {
    const row = byAgent.get(turn.variationKey) ?? {
      name: turn.agentName,
      model: turn.model,
      turns: 0,
      input: 0,
      output: 0,
      cost: 0,
      latency: 0,
    }
    row.turns += 1
    row.input += turn.inputTokens
    row.output += turn.outputTokens
    row.cost += turn.costUsd
    row.latency += turn.latencyMs
    byAgent.set(turn.variationKey, row)
  }
  const agents = [...byAgent.entries()].sort((a, b) => b[1].cost - a[1].cost)

  return (
    <div className="flex h-full flex-col">
      <ProductLink />
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto">
      <div className="grid grid-cols-2 gap-px border-b bg-border lg:grid-cols-4">
        {[
          ['Turns', String(turns.length)],
          ['Tokens', formatTokens(totals.input + totals.output)],
          ['Cost', formatUsd(totals.cost)],
          ['Avg latency', seconds(totals.latency / turns.length)],
        ].map(([label, value]) => (
          <div key={label} className="bg-background px-4 py-3">
            <div className="text-[11px] text-muted-foreground">{label}</div>
            <div className="text-lg font-semibold tabular-nums">{value}</div>
          </div>
        ))}
      </div>

      <div className="space-y-5 p-4">
        <div className="rounded-lg border bg-surface px-4 py-3">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] font-medium">Routing savings</span>
            <span className="text-[13px] font-semibold tabular-nums text-success">
              {saved > 0 ? `${Math.round(saved * 100)}% lower` : 'No savings yet'}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-5 text-muted-foreground">
            This session cost {formatUsd(totals.cost)}. Sending every turn to the deep agent ({BASELINE_MODEL}) would
            have cost {formatUsd(totals.baseline)} for the same tokens.
          </p>
        </div>

        <section>
          <h3 className="mb-2 text-[12px] font-medium text-muted-foreground">By agent</h3>
          <div className="overflow-hidden rounded-lg border">
            <table className="w-full text-[12.5px]">
              <thead className="bg-surface text-left text-[11.5px] text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Agent</th>
                  <th className="px-3 py-2 text-right font-medium">Turns</th>
                  <th className="px-3 py-2 text-right font-medium">Input</th>
                  <th className="px-3 py-2 text-right font-medium">Output</th>
                  <th className="px-3 py-2 text-right font-medium">Avg latency</th>
                  <th className="px-3 py-2 text-right font-medium">Cost</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {agents.map(([key, row]) => (
                  <tr key={key}>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <span className={cn('h-2 w-2 shrink-0 rounded-full', agentDot(key))} />
                        <span className="font-medium">{row.name}</span>
                      </div>
                      <div className="pl-4 font-mono text-[11px] text-muted-foreground">{row.model}</div>
                      <div className="ml-4 mt-1 h-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className={cn('h-full rounded-full', agentDot(key))}
                          style={{ width: `${totals.cost ? (row.cost / totals.cost) * 100 : 0}%` }}
                        />
                      </div>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{row.turns}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatTokens(row.input)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatTokens(row.output)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{seconds(row.latency / row.turns)}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatUsd(row.cost)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h3 className="mb-2 text-[12px] font-medium text-muted-foreground">Turns</h3>
          <div className="divide-y overflow-hidden rounded-lg border">
            {[...turns].reverse().map((turn) => (
              <button
                key={turn.id}
                onClick={() => onOpenTrace(turn.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/60"
              >
                <span className="w-6 shrink-0 font-mono text-[11px] text-subtle">#{turn.index}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px]">{turn.prompt}</span>
                  <span className="flex items-center gap-1.5 text-[11.5px] text-muted-foreground">
                    <span className={cn('h-1.5 w-1.5 rounded-full', agentDot(turn.variationKey))} />
                    {turn.agentName} · {turn.person} · {turn.requestType}
                  </span>
                </span>
                <span className="shrink-0 text-right font-mono text-[11.5px] text-muted-foreground">
                  <span className="block text-foreground">{formatUsd(turn.costUsd)}</span>
                  {formatTokens(turn.inputTokens + turn.outputTokens)} tok · {seconds(turn.latencyMs)}
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>
      </div>
    </div>
  )
}
