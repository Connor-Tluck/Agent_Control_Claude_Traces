import type { SpanView } from '@/lib/demo'

export type ProjectFile = { path: string; content: string }

export type FileMeta = {
  status: 'added' | 'modified'
  agentName: string
  model: string
  turn: number
  writing?: boolean
}

export type ChatMessage = {
  id: string
  role: 'user' | 'assistant'
  text: string
  files: string[]
  reads?: string[]
  writing?: string
  author?: string
  requestType?: string
  agentName?: string
  variationKey?: string
  model?: string
  reason?: string
  error?: string
  done?: boolean
}

export type TurnTrace = {
  id: string
  index: number
  prompt: string
  agentName: string
  variationKey: string
  model: string
  requestType: string
  person: string
  inputTokens: number
  outputTokens: number
  costUsd: number
  latencyMs: number
  traceId?: string
  spans: SpanView[]
}

export type PanelTab = 'code' | 'traces' | 'usage'
