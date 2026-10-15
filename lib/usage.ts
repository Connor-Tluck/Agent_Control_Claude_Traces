import { estimateCost } from '@/lib/demo'

export type UsageStatus = 'ok' | 'error'

export type UsageEvent = {
  id: string
  at: string
  sessionId: string
  personKey: string
  personName: string
  team: string
  role: string
  requestType: string
  prompt: string
  variationKey: string
  agentName: string
  model: string
  provider: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
  traceId?: string
  spanCount: number
  status: UsageStatus
  error?: string
  files: string[]
}

export type RangeKey = '24h' | '7d' | '30d' | 'all'

const RANGE_MS: Record<Exclude<RangeKey, 'all'>, number> = {
  '24h': 24 * 60 * 60 * 1000,
  '7d': 7 * 24 * 60 * 60 * 1000,
  '30d': 30 * 24 * 60 * 60 * 1000,
}

const BASELINE_MODEL = 'claude-opus-5-5'

export type UsageBucket = {
  start: number
  label: string
  cost: number
  requests: number
  byVariation: Record<string, number>
}

export type UsageGroup = {
  key: string
  label: string
  detail?: string
  requests: number
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
  errors: number
}

export type UsageSummary = {
  requests: number
  people: number
  sessions: number
  inputTokens: number
  outputTokens: number
  costUsd: number
  baselineUsd: number
  avgLatencyMs: number
  errors: number
  byPerson: UsageGroup[]
  byModel: UsageGroup[]
  byTeam: UsageGroup[]
  byRequest: UsageGroup[]
  series: UsageBucket[]
}

export function filterUsage(events: UsageEvent[], range: RangeKey, team: string, query: string, now = Date.now()) {
  const from = range === 'all' ? 0 : now - RANGE_MS[range]
  const needle = query.trim().toLowerCase()
  return events.filter((event) => {
    if (Date.parse(event.at) < from) return false
    if (team !== 'all' && event.team !== team) return false
    if (!needle) return true
    const haystack = [event.personName, event.team, event.prompt, event.model, event.agentName, event.requestType, event.traceId]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return haystack.includes(needle)
  })
}

function group(
  events: UsageEvent[],
  keyOf: (event: UsageEvent) => string,
  labelOf: (event: UsageEvent) => { label: string; detail?: string },
): UsageGroup[] {
  const map = new Map<string, UsageGroup>()
  for (const event of events) {
    const key = keyOf(event) || 'unknown'
    const row = map.get(key) ?? { key, ...labelOf(event), requests: 0, inputTokens: 0, outputTokens: 0, costUsd: 0, latencyMs: 0, errors: 0 }
    row.requests += 1
    row.inputTokens += event.inputTokens
    row.outputTokens += event.outputTokens
    row.costUsd += event.costUsd
    row.latencyMs += event.latencyMs
    if (event.status === 'error') row.errors += 1
    map.set(key, row)
  }
  return [...map.values()].sort((a, b) => b.costUsd - a.costUsd || b.requests - a.requests)
}

function seriesFor(events: UsageEvent[], range: RangeKey, now: number): UsageBucket[] {
  const hour = 60 * 60 * 1000
  const day = 24 * hour
  let unit: 'hour' | 'day' = 'day'
  let count = 7
  let start = now - 7 * day

  const sizeOf = (next: 'hour' | 'day') => (next === 'hour' ? hour : day)
  const floor = (time: number, next: 'hour' | 'day') =>
    next === 'hour' ? time - (time % hour) : new Date(time).setHours(0, 0, 0, 0)

  if (range === '24h') {
    unit = 'hour'
    count = 24
  } else if (range === '7d') {
    count = 7
  } else if (range === '30d') {
    count = 30
  } else {
    const first = events.reduce((min, event) => Math.min(min, Date.parse(event.at)), now)
    const span = Math.max(now - first, hour)
    if (span <= 2 * day) {
      unit = 'hour'
      count = Math.min(48, Math.max(6, Math.ceil(span / hour) + 1))
    } else {
      count = Math.min(30, Math.max(7, Math.ceil(span / day) + 1))
    }
  }

  const size = sizeOf(unit)
  start = floor(now, unit) - (count - 1) * size
  const buckets: UsageBucket[] = Array.from({ length: count }, (_, index) => {
    const bucketStart = start + index * size
    return {
      start: bucketStart,
      label: new Date(bucketStart).toLocaleString('en-US', unit === 'hour' ? { hour: 'numeric' } : { month: 'short', day: 'numeric' }),
      cost: 0,
      requests: 0,
      byVariation: {},
    }
  })

  for (const event of events) {
    const index = Math.floor((Date.parse(event.at) - start) / size)
    const bucket = buckets[index]
    if (!bucket) continue
    bucket.cost += event.costUsd
    bucket.requests += 1
    const key = event.variationKey || 'unknown'
    bucket.byVariation[key] = (bucket.byVariation[key] ?? 0) + event.costUsd
  }
  return buckets
}

export function summarizeUsage(events: UsageEvent[], range: RangeKey, now = Date.now()): UsageSummary {
  const requests = events.length
  const inputTokens = events.reduce((sum, event) => sum + event.inputTokens, 0)
  const outputTokens = events.reduce((sum, event) => sum + event.outputTokens, 0)
  const costUsd = events.reduce((sum, event) => sum + event.costUsd, 0)
  const latencyMs = events.reduce((sum, event) => sum + event.latencyMs, 0)
  const baselineUsd = events.reduce((sum, event) => sum + estimateCost(BASELINE_MODEL, event.inputTokens, event.outputTokens), 0)
  return {
    requests,
    people: new Set(events.map((event) => event.personKey)).size,
    sessions: new Set(events.map((event) => event.sessionId)).size,
    inputTokens,
    outputTokens,
    costUsd,
    baselineUsd,
    avgLatencyMs: requests ? latencyMs / requests : 0,
    errors: events.filter((event) => event.status === 'error').length,
    byPerson: group(events, (event) => event.personKey, (event) => ({ label: event.personName, detail: event.team })),
    byModel: group(events, (event) => event.variationKey || event.model || 'unknown', (event) => ({
      label: event.agentName || 'Unassigned',
      detail: event.model,
    })),
    byTeam: group(events, (event) => event.team, (event) => ({ label: event.team })),
    byRequest: group(events, (event) => event.requestType, (event) => ({ label: event.requestType })),
    series: seriesFor(events, range, now),
  }
}
