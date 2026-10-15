import { SpanKind, trace } from '@opentelemetry/api'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { CompressionAlgorithm } from '@opentelemetry/otlp-exporter-base'
import { resourceFromAttributes } from '@opentelemetry/resources'
import { BatchSpanProcessor, type ReadableSpan, type SpanProcessor } from '@opentelemetry/sdk-trace-base'
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node'
import { AsyncLocalStorage } from 'node:async_hooks'
import type { SpanKindName, SpanSource, SpanView } from '@/lib/demo'

export type { SpanView }

export const APP_TRACER = 'code-support-harness'
export const AGENT_CONTROL_TRACER = 'launchdarkly.agentcontrol'

type TracingState = {
  ready?: Promise<void>
  buckets: AsyncLocalStorage<SpanView[]>
  provider: NodeTracerProvider | null
  record?: (span: ReadableSpan) => void
}

const globalState = globalThis as typeof globalThis & { __codebenchTracing?: TracingState }

function tracingState() {
  if (!globalState.__codebenchTracing) {
    globalState.__codebenchTracing = { buckets: new AsyncLocalStorage<SpanView[]>(), provider: null }
  }
  return globalState.__codebenchTracing
}

const ATTRIBUTE_PREFIXES = ['gen_ai.', 'anthropic.', 'launchdarkly.', 'feature_flag.', 'http.response.', 'error.']

function hrToMs(time: [number, number]) {
  return time[0] * 1000 + time[1] / 1e6
}

function keepAttribute(key: string, value: unknown): string | number | boolean | undefined {
  if (!ATTRIBUTE_PREFIXES.some((prefix) => key.startsWith(prefix))) return undefined
  if (/messages|content|prompt|completion|system_instructions|arguments/.test(key)) return undefined
  if (Array.isArray(value)) return value.map(String).join(', ')
  if (typeof value === 'string') return value.length > 180 ? `${value.slice(0, 177)}...` : value
  if (typeof value === 'number' || typeof value === 'boolean') return value
  return undefined
}

function kindName(kind: SpanKind): SpanKindName {
  if (kind === SpanKind.CLIENT) return 'client'
  if (kind === SpanKind.SERVER) return 'server'
  return 'internal'
}

function sourceOf(span: ReadableSpan): SpanSource {
  if (span.resource.attributes['service.name'] === 'claude-platform') return 'API'
  const scope = span.instrumentationScope.name
  if (scope === AGENT_CONTROL_TRACER) return 'Agent Control'
  if (scope === APP_TRACER) return 'your code'
  return 'SDK'
}

function toView(span: ReadableSpan): SpanView {
  const attributes: Record<string, string | number | boolean> = {}
  for (const [key, value] of Object.entries(span.attributes)) {
    const kept = keepAttribute(key, value)
    if (kept !== undefined) attributes[key] = kept
  }
  const statusCode = span.status.code
  const startMs = hrToMs(span.startTime)
  return {
    name: span.name,
    traceId: span.spanContext().traceId,
    spanId: span.spanContext().spanId,
    parentSpanId: span.parentSpanContext?.spanId,
    startMs,
    durationMs: Math.max(0, hrToMs(span.endTime) - startMs),
    status: statusCode === 2 ? 'error' : statusCode === 1 ? 'ok' : 'unset',
    kind: kindName(span.kind),
    source: sourceOf(span),
    attributes,
  }
}

// The provider outlives Next dev reloads, so the processor looks up the current module's recorder.
tracingState().record = (span) => {
  const bucket = tracingState().buckets.getStore()
  if (!bucket) return
  if (span.name.startsWith('fetch ') || span.instrumentationScope.name === 'next.js') return
  bucket.push(toView(span))
}

class SessionSpanProcessor implements SpanProcessor {
  onStart() {}

  onEnd(span: ReadableSpan) {
    tracingState().record?.(span)
  }

  shutdown() {
    return Promise.resolve()
  }

  forceFlush() {
    return Promise.resolve()
  }
}

export function ensureTracing() {
  const state = tracingState()
  if (!state.ready) state.ready = startTracing()
  return state.ready
}

async function startTracing() {
  const sdkKey = process.env.LD_SDK_KEY
  if (!sdkKey) throw new Error('LD_SDK_KEY is not set')

  const state = tracingState()
  if (state.provider) return

  const exporter = new OTLPTraceExporter({
    url: 'https://otel.observability.app.launchdarkly.com/v1/traces',
    compression: CompressionAlgorithm.GZIP,
  })

  state.provider = new NodeTracerProvider({
    resource: resourceFromAttributes({
      'service.name': process.env.LD_SERVICE_NAME ?? APP_TRACER,
      'deployment.environment': process.env.LD_ENVIRONMENT ?? 'production',
      // LaunchDarkly's observability backend routes OTLP by this attribute.
      'highlight.project_id': sdkKey,
    }),
    spanProcessors: [new SessionSpanProcessor(), new BatchSpanProcessor(exporter)],
  })
  state.provider.register()
}

export function tracer(name = APP_TRACER) {
  return trace.getTracer(name)
}

export async function withSpans<T>(fn: () => Promise<T>): Promise<{ result: T; spans: SpanView[] }> {
  const spans: SpanView[] = []
  const result = await tracingState().buckets.run(spans, fn)
  return { result, spans }
}

export async function flushTraces() {
  const provider = tracingState().provider
  if (!provider) return
  await provider.forceFlush()
}
