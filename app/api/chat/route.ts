import { context as otelContext, SpanStatusCode, trace, type Span } from '@opentelemetry/api'
import { getClient } from '@launchdarkly/ai-node'
import { CONFIG_KEY, estimateCost, PEOPLE, type Person, type RequestType } from '@/lib/demo'
import { ensureRuntime, inspectTurn, openTurnStream, withDraftListener, withFileListener, withNoteListener, type ProjectFile } from '@/lib/agent'
import { AGENT_CONTROL_TRACER, flushTraces, tracer, withSpans } from '@/lib/tracing'
import { recordUsage } from '@/lib/usage-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const maxDuration = 120

type ChatRequest = {
  sessionId?: string
  personKey?: string
  requestType?: RequestType
  userText?: string
  history?: { role: 'user' | 'assistant'; content: string }[]
  files?: ProjectFile[]
}

function sse(event: unknown) {
  return `data: ${JSON.stringify(event)}\n\n`
}

function fail(span: Span, error: unknown) {
  span.recordException(error instanceof Error ? error : new Error(String(error)))
  span.setStatus({ code: SpanStatusCode.ERROR })
}

export async function POST(request: Request) {
  const body = (await request.json()) as ChatRequest
  const person = PEOPLE.find((item) => item.key === body.personKey) ?? PEOPLE[1]
  const requestType: RequestType =
    body.requestType === 'quick-fix' || body.requestType === 'architecture' || body.requestType === 'feature'
      ? body.requestType
      : 'feature'
  const userText = body.userText?.trim() ?? ''
  if (!userText) {
    return Response.json({ error: 'Write a request first.' }, { status: 400 })
  }

  const input = {
    sessionId: body.sessionId?.trim() || crypto.randomUUID(),
    person: person as Person,
    requestType,
    userText,
    history: Array.isArray(body.history) ? body.history.slice(-8) : [],
    files: Array.isArray(body.files) ? body.files : [],
  }

  try {
    await ensureRuntime()
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Runtime failed to start.' }, { status: 500 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      let open = true
      const send = (event: unknown) => {
        if (!open) return
        try {
          controller.enqueue(encoder.encode(sse(event)))
        } catch {
          open = false
        }
      }
      const started = Date.now()

      const root = tracer().startSpan('handle_coding_request', {
        attributes: {
          'gen_ai.conversation.id': input.sessionId,
          'code_support.request_type': input.requestType,
          'code_support.team': input.person.team,
        },
      })
      const rootContext = trace.setSpan(otelContext.active(), root)
      let usage = { input: 0, output: 0, total: 0 }
      let responseText = ''
      let model = ''
      let variationKey = ''
      let agentName = ''
      let provider = ''
      const writtenFiles: string[] = []
      let spanCount = 0
      let failed: string | undefined

      try {

        const collected = await withSpans(() =>
          otelContext.with(rootContext, async () => {
            try {
              const evaluation = tracer(AGENT_CONTROL_TRACER).startSpan(`agentcontrol.evaluate ${CONFIG_KEY}`, {
                attributes: {
                  'launchdarkly.config.key': CONFIG_KEY,
                  'code_support.request_type': input.requestType,
                  'code_support.team': input.person.team,
                },
              })
              let served
              try {
                served = await inspectTurn(input)
                evaluation.setAttributes({
                  'launchdarkly.variation.key': served.agent.variationKey,
                  'gen_ai.request.model': served.agent.model,
                  'gen_ai.provider.name': served.agent.provider.toLowerCase(),
                })
                evaluation.setStatus({ code: SpanStatusCode.OK })
              } catch (error) {
                fail(evaluation, error)
                throw error
              } finally {
                evaluation.end()
              }

              const { agent, context } = served
              model = agent.model
              variationKey = agent.variationKey
              agentName = agent.variationName
              provider = agent.provider
              root.setAttribute('gen_ai.request.model', agent.model)
              send({ type: 'meta', agent, sessionId: input.sessionId })

              const pending: ProjectFile[] = []
              const notes: string[] = []
              const drafts = new Map<string, string>()
              const drain = () => {
                while (notes.length) {
                  const note = notes.shift()
                  if (note) send({ type: 'note', text: note })
                }
                for (const [path, content] of drafts) send({ type: 'draft', path, content })
                drafts.clear()
                while (pending.length) {
                  const file = pending.shift()
                  if (!file) continue
                  if (!writtenFiles.includes(file.path)) writtenFiles.push(file.path)
                  send({ type: 'file', path: file.path, content: file.content })
                }
              }

              await withDraftListener(
                (draft) => drafts.set(draft.path, draft.content),
                () =>
              withNoteListener(
                (note) => notes.push(note),
                () =>
              withFileListener(
                (file) => pending.push(file),
                async () => {
                  for await (const event of openTurnStream(input, context, root)) {
                    drain()
                    if (event.type === 'chunk') {
                      if (!event.text) continue
                      responseText += event.text
                      send({ type: 'text', text: event.text })
                    } else {
                      usage = event.usage
                      responseText = event.response || responseText
                    }
                  }
                  drain()
                },
              ),
              ),
              )
              root.setAttributes({
                'gen_ai.usage.input_tokens': usage.input,
                'gen_ai.usage.output_tokens': usage.output,
              })
              root.setStatus({ code: SpanStatusCode.OK })
            } catch (error) {
              fail(root, error)
              throw error
            } finally {
              root.end()
            }
          }),
        )

        const spans = [...collected.spans].sort((a, b) => a.startMs - b.startMs || b.durationMs - a.durationMs)
        spanCount = spans.length
        send({
          type: 'done',
          text: responseText,
          model,
          variationKey,
          usage: {
            inputTokens: usage.input,
            outputTokens: usage.output,
            totalTokens: usage.total,
            costUsd: estimateCost(model, usage.input, usage.output),
            latencyMs: Date.now() - started,
          },
          spans,
          traceId: root.spanContext().traceId,
        })
      } catch (error) {
        failed = error instanceof Error ? error.message : 'The agent failed.'
        send({ type: 'error', message: failed })
      } finally {
        const traceId = root.spanContext().traceId
        try {
          await recordUsage({
            id: crypto.randomUUID(),
            at: new Date().toISOString(),
            sessionId: input.sessionId,
            personKey: input.person.key,
            personName: input.person.name,
            team: input.person.team,
            role: input.person.role,
            requestType: input.requestType,
            prompt: input.userText.slice(0, 400),
            variationKey,
            agentName,
            model,
            provider,
            inputTokens: usage.input,
            outputTokens: usage.output,
            costUsd: estimateCost(model, usage.input, usage.output),
            latencyMs: Date.now() - started,
            traceId: traceId && !/^0+$/.test(traceId) ? traceId : undefined,
            spanCount,
            status: failed ? 'error' : 'ok',
            error: failed,
            files: writtenFiles,
          })
        } catch (error) {
          console.error('Failed to record usage', error)
        }
        open = false
        controller.close()
        await flushTraces()
        await getClient().flush()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}
