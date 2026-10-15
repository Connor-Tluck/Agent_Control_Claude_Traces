type StringRead = { value: string; closed: boolean; end: number }

/** Reads a JSON string starting at the opening quote. Incomplete input returns what was decoded so far. */
function readJsonString(source: string, start: number): StringRead | null {
  if (source[start] !== '"') return null
  let value = ''
  let i = start + 1
  while (i < source.length) {
    const char = source[i]
    if (char === '\\') {
      if (i + 1 >= source.length) return { value, closed: false, end: source.length }
      const next = source[i + 1]
      if (next === 'u') {
        if (i + 6 > source.length) return { value, closed: false, end: source.length }
        const code = Number.parseInt(source.slice(i + 2, i + 6), 16)
        value += Number.isNaN(code) ? source.slice(i + 2, i + 6) : String.fromCharCode(code)
        i += 6
        continue
      }
      const decoded: Record<string, string> = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', '"': '"', '\\': '\\', '/': '/' }
      value += decoded[next] ?? next
      i += 2
      continue
    }
    if (char === '"') return { value, closed: true, end: i + 1 }
    value += char
    i++
  }
  return { value, closed: false, end: source.length }
}

/** Pulls path and content out of a write_file tool call while the JSON is still streaming. */
export function parseWriteFileArgs(partial: string): { path: string; content: string } | null {
  const start = partial.indexOf('{')
  if (start < 0) return null
  let i = start + 1
  let path: string | undefined
  let pathClosed = false
  let content = ''

  while (i < partial.length) {
    while (i < partial.length && /[\s,]/.test(partial[i])) i++
    if (i >= partial.length || partial[i] === '}') break
    if (partial[i] !== '"') break
    const key = readJsonString(partial, i)
    if (!key?.closed) break
    i = key.end
    while (i < partial.length && /\s/.test(partial[i])) i++
    if (partial[i] !== ':') break
    i++
    while (i < partial.length && /\s/.test(partial[i])) i++
    if (partial[i] !== '"') break
    const field = readJsonString(partial, i)
    if (!field) break
    if (key.value === 'path') {
      path = field.value
      pathClosed = field.closed
    } else if (key.value === 'content') {
      content = field.value
    }
    if (!field.closed) break
    i = field.end
  }

  if (!pathClosed || !path) return null
  return { path, content }
}
