'use client'

import { Check, ChevronRight, Copy, FolderTree, GitBranch, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { cn } from '@/lib/cn'
import { highlight } from '@/lib/highlight'
import { FileIcon, languageOf } from './file-icon'
import type { FileMeta, ProjectFile } from './types'

type TreeNode = { name: string; path: string; children: TreeNode[]; isFolder: boolean }

function buildTree(paths: string[]): TreeNode[] {
  const root: TreeNode = { name: '', path: '', children: [], isFolder: true }
  for (const path of paths) {
    const parts = path.split('/')
    let cursor = root
    parts.forEach((part, index) => {
      const isFolder = index < parts.length - 1
      const currentPath = parts.slice(0, index + 1).join('/')
      let child = cursor.children.find((item) => item.name === part && item.isFolder === isFolder)
      if (!child) {
        child = { name: part, path: currentPath, children: [], isFolder }
        cursor.children.push(child)
      }
      cursor = child
    })
  }
  const sortNodes = (nodes: TreeNode[]) => {
    nodes.sort((a, b) => Number(b.isFolder) - Number(a.isFolder) || a.name.localeCompare(b.name))
    nodes.forEach((node) => sortNodes(node.children))
  }
  sortNodes(root.children)
  return root.children
}

function Explorer({
  files,
  meta,
  activePath,
  recentPath,
  onOpen,
}: {
  files: ProjectFile[]
  meta: Record<string, FileMeta>
  activePath?: string
  recentPath?: string
  onOpen: (path: string) => void
}) {
  const tree = useMemo(() => buildTree(files.map((file) => file.path)), [files])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())

  const toggle = (path: string) =>
    setCollapsed((current) => {
      const next = new Set(current)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })

  const renderNodes = (nodes: TreeNode[], depth: number) =>
    nodes.map((node) => {
      const pad = 8 + depth * 12
      if (node.isFolder) {
        const open = !collapsed.has(node.path)
        return (
          <div key={`d:${node.path}`}>
            <button
              onClick={() => toggle(node.path)}
              className="flex h-[22px] w-full items-center gap-1 pr-2 text-left text-[12.5px] text-foreground/80 hover:bg-accent"
              style={{ paddingLeft: pad }}
            >
              <ChevronRight className={cn('h-3.5 w-3.5 shrink-0 text-subtle transition-transform', open && 'rotate-90')} />
              <span className="truncate">{node.name}</span>
            </button>
            {open && (
              <div className="relative">
                <span className="absolute bottom-0 top-0 w-px bg-border" style={{ left: pad + 6 }} />
                {renderNodes(node.children, depth + 1)}
              </div>
            )}
          </div>
        )
      }
      const info = meta[node.path]
      const active = activePath === node.path
      return (
        <button
          key={`f:${node.path}:${info?.turn ?? 0}`}
          onClick={() => onOpen(node.path)}
          className={cn(
            'flex h-[22px] w-full items-center gap-1.5 pr-2 text-left text-[12.5px]',
            active ? 'bg-brand-soft text-foreground' : 'text-foreground/80 hover:bg-accent',
            recentPath === node.path && !active && 'file-flash',
          )}
          style={{ paddingLeft: pad + 16 }}
        >
          <FileIcon path={node.path} />
          <span className="min-w-0 flex-1 truncate">{node.name}</span>
          {info && (
            <span
              title={info.status === 'added' ? 'Added this session' : 'Modified'}
              className={cn(
                'font-mono text-[10.5px] font-semibold',
                info.status === 'added' ? 'text-success' : 'text-brand',
              )}
            >
              {info.status === 'added' ? 'A' : 'M'}
            </span>
          )}
        </button>
      )
    })

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-9 shrink-0 items-center justify-between border-b px-3">
        <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">Explorer</span>
        <span className="font-mono text-[11px] text-subtle">{files.length}</span>
      </div>
      <div className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-foreground/70">
        northwind-workspace
      </div>
      <div className="thin-scroll min-h-0 flex-1 overflow-y-auto pb-3">
        {files.length ? (
          renderNodes(tree, 0)
        ) : (
          <p className="px-3 py-2 text-[12px] leading-5 text-muted-foreground">Files appear here as the agent writes them.</p>
        )}
      </div>
    </div>
  )
}

function Editor({ file, meta }: { file: ProjectFile; meta?: FileMeta }) {
  const language = languageOf(file.path)
  const html = useMemo(() => highlight(file.content, language.prism), [file.content, language.prism])
  const lineCount = file.content.split('\n').length
  const [copied, setCopied] = useState(false)
  const crumbs = file.path.split('/')
  const scroller = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  useEffect(() => {
    const node = scroller.current
    if (node && meta?.writing && stick.current) node.scrollTop = node.scrollHeight
  }, [file.content, meta?.writing])

  async function copy() {
    await navigator.clipboard.writeText(file.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1400)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-7 shrink-0 items-center justify-between gap-3 border-b bg-editor px-3">
        <div className="flex min-w-0 items-center gap-1 text-[12px] text-muted-foreground">
          {crumbs.map((crumb, index) => (
            <span key={index} className="flex min-w-0 items-center gap-1">
              {index > 0 && <ChevronRight className="h-3 w-3 shrink-0 text-subtle" />}
              {index === crumbs.length - 1 && <FileIcon path={file.path} className="h-3 w-3" />}
              <span className={cn('truncate', index === crumbs.length - 1 && 'text-foreground')}>{crumb}</span>
            </span>
          ))}
        </div>
        <button
          onClick={copy}
          className="flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>

      <div
        key={`${file.path}:${meta?.turn ?? 0}`}
        ref={scroller}
        onScroll={(event) => {
          const node = event.currentTarget
          stick.current = node.scrollHeight - node.scrollTop - node.clientHeight < 40
        }}
        className="thin-scroll min-h-0 flex-1 overflow-auto bg-editor"
      >
        <div className="flex min-h-full min-w-max font-mono text-[12.5px] leading-5">
          <div
            aria-hidden
            className="sticky left-0 z-10 select-none bg-editor py-3 pl-4 pr-4 text-right text-editor-gutter"
          >
            {Array.from({ length: lineCount }, (_, index) => (
              <div key={index}>{index + 1}</div>
            ))}
          </div>
          <pre className="code-view flex-1 py-3 pl-1 pr-8">
            <code className={meta?.writing ? 'streaming-caret' : undefined} dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        </div>
      </div>

      <div className="flex h-6 shrink-0 items-center justify-between gap-3 border-t bg-surface px-3 text-[11px] text-muted-foreground">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex items-center gap-1">
            <GitBranch className="h-3 w-3" />
            main
          </span>
          {meta?.writing ? (
            <span className="flex items-center gap-1.5 text-foreground">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-brand" />
              Writing
            </span>
          ) : (
            meta && (
              <span className="truncate">
                Written by {meta.agentName} <span className="font-mono text-subtle">· {meta.model}</span> · turn{' '}
                {meta.turn}
              </span>
            )
          )}
        </div>
        <div className="flex shrink-0 items-center gap-3 font-mono">
          <span>{lineCount} lines</span>
          <span>UTF-8</span>
          <span className="font-sans">{language.label}</span>
        </div>
      </div>
    </div>
  )
}

export function CodeWorkspace({
  files,
  meta,
  openTabs,
  activePath,
  recentPath,
  onOpen,
  onClose,
  compact,
}: {
  files: ProjectFile[]
  meta: Record<string, FileMeta>
  openTabs: string[]
  activePath?: string
  recentPath?: string
  onOpen: (path: string) => void
  onClose: (path: string) => void
  compact?: boolean
}) {
  const [explorerOpen, setExplorerOpen] = useState(true)
  const active = files.find((file) => file.path === activePath)

  return (
    <div className="flex h-full min-h-0">
      {explorerOpen && (
        <div className={cn('shrink-0 border-r bg-surface', compact ? 'w-44' : 'w-56')}>
          <Explorer files={files} meta={meta} activePath={activePath} recentPath={recentPath} onOpen={onOpen} />
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col bg-editor">
        <div className="flex h-9 shrink-0 items-stretch border-b bg-surface">
          <button
            onClick={() => setExplorerOpen((value) => !value)}
            title={explorerOpen ? 'Hide explorer' : 'Show explorer'}
            className="flex w-9 shrink-0 items-center justify-center border-r text-muted-foreground hover:text-foreground"
          >
            {explorerOpen ? <PanelLeftClose className="h-3.5 w-3.5" /> : <PanelLeftOpen className="h-3.5 w-3.5" />}
          </button>
          <div className="thin-scroll flex min-w-0 flex-1 items-stretch overflow-x-auto">
            {openTabs.map((path) => {
              const isActive = path === activePath
              return (
                <div
                  key={path}
                  className={cn(
                    'group relative flex shrink-0 cursor-pointer items-center gap-1.5 border-r pl-3 pr-1.5 text-[12.5px]',
                    isActive ? 'bg-editor text-foreground' : 'text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => onOpen(path)}
                  title={path}
                >
                  {isActive && <span className="absolute inset-x-0 top-0 h-px bg-brand" />}
                  {isActive && <span className="absolute inset-x-0 -bottom-px h-px bg-editor" />}
                  {meta[path]?.writing ? (
                    <span className="h-1.5 w-1.5 shrink-0 animate-pulse rounded-full bg-brand" />
                  ) : (
                    <FileIcon path={path} />
                  )}
                  <span>{path.split('/').pop()}</span>
                  <button
                    onClick={(event) => {
                      event.stopPropagation()
                      onClose(path)
                    }}
                    className={cn(
                      'ml-0.5 rounded p-0.5 text-subtle hover:bg-accent hover:text-foreground',
                      !isActive && 'opacity-0 group-hover:opacity-100',
                    )}
                    aria-label={`Close ${path}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )
            })}
          </div>
        </div>

        {active ? (
          <Editor file={active} meta={meta[active.path]} />
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 text-center">
            <FolderTree className="h-6 w-6 text-subtle" />
            <p className="text-sm font-medium">{files.length ? 'No file open' : 'No files yet'}</p>
            <p className="max-w-xs text-[13px] leading-5 text-muted-foreground">
              {files.length
                ? 'Pick a file from the explorer.'
                : 'Ask for some code. Each file the agent writes opens here as an editor tab.'}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
