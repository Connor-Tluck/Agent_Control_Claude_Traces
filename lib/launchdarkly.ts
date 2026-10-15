import { CONFIG_KEY, PROJECT_KEY } from '@/lib/demo'

const APP = 'https://app.launchdarkly.com'
export const LD_ENVIRONMENT = 'production'
export const SERVICE_NAME = 'code-support-harness'

function projectUrl(path: string, query: Record<string, string> = {}) {
  const params = new URLSearchParams({ env: LD_ENVIRONMENT, ...query })
  return `${APP}/projects/${PROJECT_KEY}/${path}?${params.toString()}`
}

/** Agent Control monitoring tab: generations, tokens, latency, and cost by variation. */
export function monitoringUrl() {
  return projectUrl(`ai-configs/${CONFIG_KEY}`, { tab: 'monitoring' })
}

/** Observability traces for this harness. Search syntax matches the Traces page. */
export function tracesUrl(query = `service_name="${SERVICE_NAME}"`) {
  return projectUrl('observability/traces', { query })
}

export function traceUrl(traceId: string) {
  return tracesUrl(`trace_id="${traceId}"`)
}
