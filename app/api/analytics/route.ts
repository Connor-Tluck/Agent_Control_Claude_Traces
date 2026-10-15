import { monitoringUrl, tracesUrl } from '@/lib/launchdarkly'
import { readUsage } from '@/lib/usage-log'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET() {
  const events = await readUsage()
  return Response.json({
    events,
    links: {
      monitoring: monitoringUrl(),
      traces: tracesUrl(),
    },
  })
}
