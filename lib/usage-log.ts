import { appendFile, mkdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import type { UsageEvent } from '@/lib/usage'

const FILE = path.join(process.cwd(), 'data', 'usage.jsonl')

type LogState = { chain: Promise<void> }
const globalState = globalThis as typeof globalThis & { __codebenchUsage?: LogState }

function state() {
  if (!globalState.__codebenchUsage) globalState.__codebenchUsage = { chain: Promise.resolve() }
  return globalState.__codebenchUsage
}

export function recordUsage(event: UsageEvent) {
  const current = state()
  current.chain = current.chain.then(async () => {
    await mkdir(path.dirname(FILE), { recursive: true })
    await appendFile(FILE, `${JSON.stringify(event)}\n`)
  })
  return current.chain
}

export async function readUsage(): Promise<UsageEvent[]> {
  await state().chain
  let text = ''
  try {
    text = await readFile(FILE, 'utf8')
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return []
    throw error
  }
  const events: UsageEvent[] = []
  for (const line of text.split('\n')) {
    if (!line.trim()) continue
    try {
      const event = JSON.parse(line) as UsageEvent
      if (event && event.id && event.at) events.push(event)
    } catch {
      // Skip a torn line from a crash mid-write.
    }
  }
  return events
}
