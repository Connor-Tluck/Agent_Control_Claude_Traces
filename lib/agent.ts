import Anthropic from '@anthropic-ai/sdk'
import {
  config,
  createHandler,
  initClient,
  inspectConfig,
  parseTemplate,
  setLdSpanAttributes,
  type LDContext,
  type Message,
} from '@launchdarkly/ai-node'
import type { Span } from '@opentelemetry/api'
import { AsyncLocalStorage } from 'node:async_hooks'
import { CONFIG_KEY, previewAgent, type Person, type RequestType } from '@/lib/demo'
import { readGithub } from '@/lib/github'
import { parseWriteFileArgs } from '@/lib/partial-json'
import { ensureTracing } from '@/lib/tracing'

export type ProjectFile = { path: string; content: string }

export type TurnInput = {
  sessionId: string
  person: Person
  requestType: RequestType
  userText: string
  history: { role: 'user' | 'assistant'; content: string }[]
  files: ProjectFile[]
}

export type ServedAgent = {
  variationKey: string
  variationName: string
  model: string
  provider: string
  reason: string
}

type FileListener = (file: ProjectFile) => void
type NoteListener = (note: string) => void
type DraftListener = (file: ProjectFile) => void

const fileListeners = new AsyncLocalStorage<FileListener>()
const noteListeners = new AsyncLocalStorage<NoteListener>()
const draftListeners = new AsyncLocalStorage<DraftListener>()

let anthropic: Anthropic | null = null
let runtimeReady: Promise<void> | null = null

function getAnthropic() {
  if (!anthropic) {
    anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
      openTelemetry: {
        traces: { enabled: true, contentMode: 'metadata_only' },
      },
    })
  }
  return anthropic
}

export async function ensureRuntime() {
  if (!runtimeReady) {
    runtimeReady = (async () => {
      await ensureTracing()
      await initClient({
        sdkKey: process.env.LD_SDK_KEY,
        serviceName: process.env.LD_SERVICE_NAME ?? 'code-support-harness',
        environment: process.env.LD_ENVIRONMENT ?? 'production',
      })
    })()
  }
  return runtimeReady
}

export function buildContext(input: Pick<TurnInput, 'person' | 'requestType' | 'sessionId'>): LDContext {
  return {
    kind: 'multi',
    user: {
      key: input.person.key,
      name: input.person.name,
      email: input.person.email,
      team: input.person.team,
      role: input.person.role,
    },
    task: {
      key: input.sessionId,
      requestType: input.requestType,
      name: input.requestType,
    },
    organization: {
      key: 'northwind',
      name: 'Northwind',
    },
  } as unknown as LDContext
}

export function withFileListener<T>(listener: FileListener, fn: () => Promise<T>) {
  return fileListeners.run(listener, fn)
}

export function withNoteListener<T>(listener: NoteListener, fn: () => Promise<T>) {
  return noteListeners.run(listener, fn)
}

export function withDraftListener<T>(listener: DraftListener, fn: () => Promise<T>) {
  return draftListeners.run(listener, fn)
}

function safeDraftPath(input: string) {
  try {
    return safePath(input)
  } catch {
    return null
  }
}

function safePath(input: string) {
  const cleaned = input.replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/')
  const parts = cleaned.split('/').filter(Boolean)
  if (!parts.length || parts.some((part) => part === '..' || part === '.')) {
    throw new Error('write_file path must stay inside the project')
  }
  return parts.join('/')
}

function projectSnapshot(files: ProjectFile[]) {
  if (!files.length) return 'The project is empty. Create the files it needs.'
  let used = 0
  const parts: string[] = []
  for (const file of files) {
    if (used > 40_000) {
      parts.push(`--- ${file.path}\n/* still in the project; contents omitted for length */`)
      continue
    }
    const body = file.content.length > 8_000 ? `${file.content.slice(0, 8_000)}\n/* truncated */` : file.content
    parts.push(`--- ${file.path}\n${body}`)
    used += body.length
  }
  return parts.join('\n\n')
}

const writeFileTool = {
  name: 'write_file',
  description:
    'Create or replace one file in the in-browser project. Use a relative path such as src/score.ts or README.md. Call this once per file.',
  input_schema: {
    type: 'object' as const,
    properties: {
      path: { type: 'string', description: 'Relative path, including folders.' },
      content: { type: 'string', description: 'Complete file contents.' },
    },
    required: ['path', 'content'],
  },
  parse(input: unknown) {
    const value = (typeof input === 'string' ? JSON.parse(input) : input) as {
      path?: string
      content?: string
    }
    if (!value?.path || typeof value.content !== 'string') {
      throw new Error('write_file requires path and content')
    }
    return { path: safePath(value.path), content: value.content.slice(0, 100_000) }
  },
  async run(input: { path: string; content: string }) {
    fileListeners.getStore()?.(input)
    noteListeners.getStore()?.(`Wrote ${input.path}`)
    return `Wrote ${input.path} (${input.content.length} characters).`
  },
}

const readGithubTool = {
  name: 'read_github',
  description:
    'Read a public GitHub repository. Pass owner/repo or a github.com URL. Omit path to list the repository root. Set path to a file to read its text, or to a directory to list it. Call this before answering whenever the user shares a GitHub URL or asks you to review, debug, or fix a repository.',
  input_schema: {
    type: 'object' as const,
    properties: {
      repo: { type: 'string', description: 'owner/repo or https://github.com/owner/repo' },
      path: { type: 'string', description: 'File or directory inside the repo. Omit to list the root.' },
      ref: { type: 'string', description: 'Branch, tag, or commit. Defaults to the default branch.' },
    },
    required: ['repo'],
  },
  parse(input: unknown) {
    const value = (typeof input === 'string' ? JSON.parse(input) : input) as {
      repo?: string
      path?: string
      ref?: string
    }
    if (!value?.repo?.trim()) throw new Error('read_github requires repo')
    return {
      repo: value.repo.trim(),
      path: value.path?.trim() || undefined,
      ref: value.ref?.trim() || undefined,
    }
  },
  async run(input: { repo: string; path?: string; ref?: string }) {
    const label = input.path ? `${input.repo}/${input.path}` : input.repo
    noteListeners.getStore()?.(`Reading ${label}`)
    try {
      return await readGithub(input.repo, input.path, input.ref)
    } catch (error) {
      return error instanceof Error ? error.message : 'Could not read that GitHub repository.'
    }
  },
}

type BetaStream = AsyncIterable<Anthropic.Beta.Messages.BetaRawMessageStreamEvent> & {
  finalMessage?: () => Promise<Anthropic.Beta.Messages.BetaMessage>
}

function isStream(value: unknown): value is BetaStream {
  return Boolean(value && typeof value === 'object' && Symbol.asyncIterator in value)
}

const codingHandler = createHandler(
  ['Anthropic', 'agent'],
  async () => ({ output: '', usage: {} }),
  async function* streamCoding(cfg, userInput, _toolHandlers, variables, history) {
    const client = getAnthropic()
    const model = cfg.model.name
    const maxTokens = Number(cfg.model.parameters?.max_tokens ?? 4096)
    const vars = (variables ?? {}) as Record<string, unknown>
    // Links the turn's root span to this config run, the way LaunchDarkly's own handlers do.
    const rootSpan = vars.rootSpan as Span | undefined
    if (rootSpan) setLdSpanAttributes(rootSpan, vars)
    const instructions = parseTemplate(
      cfg.instructions ?? 'You are a coding agent. Use write_file for every file.',
      vars,
    )
    const snapshot = typeof vars.projectSnapshot === 'string' ? vars.projectSnapshot : 'The project is empty.'
    const system = `${instructions}

Current project:
${snapshot}

You can read public GitHub repositories with read_github. When the user shares a github.com URL, or asks you to review, debug, or fix a repository, call read_github before you answer. List the root or read the README first, then open the files that matter. Never say you lack web access, internet, or search tools.

Write fixes into this project with write_file. Do not paste full file contents into the chat reply. Explain the bug and the change in a few sentences.`

    const messages: Anthropic.Beta.Messages.BetaMessageParam[] = []
    for (const turn of history ?? []) {
      if (turn.role !== 'user' && turn.role !== 'assistant') continue
      const text = typeof turn.content === 'string' ? turn.content : ''
      if (!text.trim()) continue
      messages.push({ role: turn.role, content: text.slice(0, 4_000) })
    }
    if (userInput?.trim()) messages.push({ role: 'user', content: userInput })

    const sessionId = typeof vars.sessionId === 'string' ? vars.sessionId : undefined
    const runner = client.beta.messages.toolRunner(
      {
        model,
        max_tokens: Math.min(Math.max(maxTokens, 256), 8192),
        system,
        messages,
        tools: [readGithubTool, writeFileTool],
        stream: true,
        max_iterations: 12,
      },
      { openTelemetry: { conversationId: sessionId } },
    )

    let inputTokens = 0
    let outputTokens = 0
    let text = ''
    const toolInputs = new Map<number, string>()
    const lastFlushed = new Map<string, number>()

    // Tool-argument deltas often arrive in one burst. Wake the route every few
    // dozen characters, then pause so the SSE write can flush and the editor can paint.
    const publishDraft = (path: string, content: string, force = false) => {
      draftListeners.getStore()?.({ path, content })
      const previous = lastFlushed.get(path)
      if (previous !== undefined && content.length < previous) lastFlushed.delete(path)
      const sent = lastFlushed.get(path)
      if (sent === content.length) return false
      if (!force && sent !== undefined && content.length - sent < 48) return false
      lastFlushed.set(path, content.length)
      return true
    }

    const revealDraft = async function* (path: string, content: string, force = false) {
      if (!publishDraft(path, content, force)) return
      yield { type: 'chunk' as const, text: '' }
      if (!force) await new Promise((resolve) => setTimeout(resolve, 16))
    }

    for await (const message of runner) {
      if (!isStream(message)) continue
      let messageInput = 0
      let messageOutput = 0
      for await (const event of message) {
        if (event.type === 'message_start') {
          messageInput = event.message.usage.input_tokens
          toolInputs.clear()
        } else if (event.type === 'message_delta') {
          messageOutput = event.usage.output_tokens
        } else if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
          if (event.content_block.name === 'write_file') toolInputs.set(event.index, '')
        } else if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
          if (!toolInputs.has(event.index)) continue
          const json = (toolInputs.get(event.index) ?? '') + event.delta.partial_json
          toolInputs.set(event.index, json)
          const draft = parseWriteFileArgs(json)
          const path = draft ? safeDraftPath(draft.path) : null
          if (draft && path) yield* revealDraft(path, draft.content)
        } else if (event.type === 'content_block_stop') {
          const json = toolInputs.get(event.index)
          toolInputs.delete(event.index)
          if (json) {
            const draft = parseWriteFileArgs(json)
            const path = draft ? safeDraftPath(draft.path) : null
            if (draft && path) yield* revealDraft(path, draft.content, true)
          }
        } else if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
          text += event.delta.text
          yield { type: 'chunk' as const, text: event.delta.text }
        }
      }
      inputTokens += messageInput
      outputTokens += messageOutput
    }

    yield {
      type: 'done' as const,
      output: text,
      usage: { input_tokens: inputTokens, output_tokens: outputTokens },
    }
  },
)

export async function inspectTurn(input: TurnInput) {
  await ensureRuntime()
  const context = buildContext(input)
  const inspected = await inspectConfig(CONFIG_KEY, context)
  if (!inspected.enabled || !inspected.config) {
    throw new Error('Agent Control config code-support-agent is not serving a variation')
  }
  const variationKey = inspected.meta?.variationKey ?? 'unknown'
  const predicted = previewAgent(input.person.team, input.requestType)
  const agent: ServedAgent = {
    variationKey,
    variationName: predicted.variationKey === variationKey ? predicted.name : variationKey,
    model: inspected.config.model.name,
    provider: inspected.config.provider.name,
    reason: predicted.reason,
  }
  return { agent, context }
}

export function openTurnStream(input: TurnInput, context: LDContext, rootSpan: Span) {
  return config({
    key: process.env.LD_CONFIG_KEY ?? CONFIG_KEY,
    handler: codingHandler,
  }).stream(
    input.userText,
    context,
    {
      developer: input.person.name,
      team: input.person.team,
      requestType: input.requestType,
      sessionId: input.sessionId,
      projectSnapshot: projectSnapshot(input.files),
      rootSpan,
    },
    input.history as Message[],
  )
}
