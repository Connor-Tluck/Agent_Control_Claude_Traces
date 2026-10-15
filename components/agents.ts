const DOTS: Record<string, string> = {
  'cost-haiku': 'bg-emerald-500',
  'standard-sonnet': 'bg-blue-500',
  'deep-opus': 'bg-violet-500',
}

export function agentDot(variationKey?: string) {
  return (variationKey && DOTS[variationKey]) || 'bg-zinc-400'
}
