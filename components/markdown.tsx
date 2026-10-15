import { Fragment, useMemo, type ReactNode } from 'react'
import { highlight } from '@/lib/highlight'

function inline(text: string, keyPrefix: string): ReactNode[] {
  const parts = text.split(/(`[^`\n]+`|\*\*[^*\n]+\*\*)/g)
  return parts.map((part, index) => {
    const key = `${keyPrefix}-${index}`
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2) {
      return (
        <code key={key} className="rounded border bg-muted px-1 py-px font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      )
    }
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={key} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      )
    }
    return <Fragment key={key}>{part}</Fragment>
  })
}

function Prose({ text, id }: { text: string; id: string }) {
  const blocks: ReactNode[] = []
  let list: string[] = []
  const flushList = (key: string) => {
    if (!list.length) return
    blocks.push(
      <ul key={key} className="my-1.5 list-disc space-y-0.5 pl-5 marker:text-subtle">
        {list.map((item, index) => (
          <li key={index}>{inline(item, `${key}-${index}`)}</li>
        ))}
      </ul>,
    )
    list = []
  }

  text.split('\n').forEach((line, index) => {
    const key = `${id}-${index}`
    const bullet = line.match(/^\s*(?:[-*]|\d+\.)\s+(.*)$/)
    if (bullet) {
      list.push(bullet[1])
      return
    }
    flushList(`${key}-list`)
    const heading = line.match(/^#{1,4}\s+(.*)$/)
    if (heading) {
      blocks.push(
        <p key={key} className="mb-1 mt-3 font-semibold first:mt-0">
          {inline(heading[1], key)}
        </p>,
      )
    } else if (line.trim()) {
      blocks.push(
        <p key={key} className="my-1.5 first:mt-0 last:mb-0">
          {inline(line, key)}
        </p>,
      )
    }
  })
  flushList(`${id}-list-end`)
  return <>{blocks}</>
}

function CodeBlock({ code, language }: { code: string; language: string }) {
  const html = useMemo(() => highlight(code, language), [code, language])
  return (
    <div className="my-2 overflow-hidden rounded-lg border bg-editor">
      {language && (
        <div className="border-b bg-surface px-3 py-1 font-mono text-[11px] text-muted-foreground">{language}</div>
      )}
      <pre className="code-view thin-scroll overflow-x-auto px-3 py-2.5 font-mono text-[12.5px] leading-5">
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  )
}

export function Markdown({ text }: { text: string }) {
  const segments = text.split(/```/)
  return (
    <>
      {segments.map((segment, index) => {
        if (index % 2 === 1) {
          const newline = segment.indexOf('\n')
          const language = newline === -1 ? '' : segment.slice(0, newline).trim()
          const code = newline === -1 ? segment : segment.slice(newline + 1)
          return <CodeBlock key={index} code={code.replace(/\n$/, '')} language={language} />
        }
        return <Prose key={index} id={String(index)} text={segment} />
      })}
    </>
  )
}
