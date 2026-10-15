export const CONFIG_KEY = 'code-support-agent'
export const PROJECT_KEY = 'CT_Agent_Control_Claude'

export type Team = 'support' | 'product' | 'platform'
export type RequestType = 'quick-fix' | 'feature' | 'architecture'

export type Person = {
  key: string
  name: string
  team: Team
  role: string
  email: string
}

export const PEOPLE: Person[] = [
  {
    key: 'sam-ortiz',
    name: 'Sam Ortiz',
    team: 'support',
    role: 'Support engineer',
    email: 'sam.ortiz@northwind.example',
  },
  {
    key: 'jordan-lee',
    name: 'Jordan Lee',
    team: 'product',
    role: 'Product engineer',
    email: 'jordan.lee@northwind.example',
  },
  {
    key: 'maya-chen',
    name: 'Maya Chen',
    team: 'platform',
    role: 'Staff engineer',
    email: 'maya.chen@northwind.example',
  },
]

export const REQUEST_TYPES: { key: RequestType; label: string; hint: string }[] = [
  { key: 'quick-fix', label: 'Quick fix', hint: 'Always the cost agent' },
  { key: 'feature', label: 'Feature', hint: 'Follows the team default' },
  { key: 'architecture', label: 'Architecture', hint: 'Always the deep agent' },
]

export type SpanSource = 'your code' | 'Agent Control' | 'SDK' | 'API'
export type SpanKindName = 'client' | 'server' | 'internal'

export type SpanView = {
  name: string
  traceId: string
  spanId: string
  parentSpanId?: string
  startMs: number
  durationMs: number
  status: 'ok' | 'error' | 'unset'
  kind: SpanKindName
  source: SpanSource
  attributes: Record<string, string | number | boolean>
}

export type AgentChoice = {
  variationKey: string
  name: string
  model: string
  reason: string
}

const AGENTS = {
  'cost-haiku': {
    variationKey: 'cost-haiku',
    name: 'Cost guard',
    model: 'claude-haiku-4-5',
  },
  'standard-sonnet': {
    variationKey: 'standard-sonnet',
    name: 'Standard coder',
    model: 'claude-sonnet-5-5',
  },
  'deep-opus': {
    variationKey: 'deep-opus',
    name: 'Deep coder',
    model: 'claude-opus-5-5',
  },
} as const

/** Mirrors the production targeting rules so the badge updates before the call returns. */
export function previewAgent(team: Team, requestType: RequestType): AgentChoice {
  if (requestType === 'quick-fix') {
    return {
      ...AGENTS['cost-haiku'],
      reason: 'Request type is quick-fix, so Agent Control serves the cost agent.',
    }
  }
  if (requestType === 'architecture') {
    return {
      ...AGENTS['deep-opus'],
      reason: 'Request type is architecture, so Agent Control serves the deep agent.',
    }
  }
  if (team === 'support') {
    return {
      ...AGENTS['cost-haiku'],
      reason: 'Support defaults to the cost agent unless the request asks for architecture.',
    }
  }
  if (team === 'platform') {
    return {
      ...AGENTS['deep-opus'],
      reason: 'Platform defaults to the deep agent unless the request is a quick fix.',
    }
  }
  return {
    ...AGENTS['standard-sonnet'],
    reason: 'Product feature work falls through to the standard agent.',
  }
}

const PRICE_PER_MILLION: Record<string, { input: number; output: number }> = {
  'claude-haiku-4-5': { input: 1, output: 5 },
  'claude-sonnet-5-5': { input: 2, output: 10 },
  'claude-opus-5-5': { input: 4, output: 20 },
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number) {
  const price = PRICE_PER_MILLION[model] ?? { input: 3, output: 15 }
  return (inputTokens / 1_000_000) * price.input + (outputTokens / 1_000_000) * price.output
}

export function formatUsd(value: number) {
  if (value === 0) return '$0.00'
  if (value < 0.01) return `$${value.toFixed(4)}`
  return `$${value.toFixed(3)}`
}

export function formatTokens(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}
