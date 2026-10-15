import { Braces, File, FileCode2, FileText, Hash, Palette, Terminal } from 'lucide-react'
import { cn } from '@/lib/cn'

type Language = { prism: string; label: string }

const LANGUAGES: Record<string, Language> = {
  ts: { prism: 'typescript', label: 'TypeScript' },
  mts: { prism: 'typescript', label: 'TypeScript' },
  cts: { prism: 'typescript', label: 'TypeScript' },
  tsx: { prism: 'tsx', label: 'TypeScript JSX' },
  js: { prism: 'javascript', label: 'JavaScript' },
  mjs: { prism: 'javascript', label: 'JavaScript' },
  cjs: { prism: 'javascript', label: 'JavaScript' },
  jsx: { prism: 'jsx', label: 'JavaScript JSX' },
  json: { prism: 'json', label: 'JSON' },
  md: { prism: 'markdown', label: 'Markdown' },
  mdx: { prism: 'markdown', label: 'MDX' },
  css: { prism: 'css', label: 'CSS' },
  scss: { prism: 'scss', label: 'SCSS' },
  sass: { prism: 'sass', label: 'Sass' },
  html: { prism: 'markup', label: 'HTML' },
  xml: { prism: 'markup', label: 'XML' },
  svg: { prism: 'markup', label: 'SVG' },
  py: { prism: 'python', label: 'Python' },
  sh: { prism: 'bash', label: 'Shell' },
  bash: { prism: 'bash', label: 'Shell' },
  yml: { prism: 'yaml', label: 'YAML' },
  yaml: { prism: 'yaml', label: 'YAML' },
  sql: { prism: 'sql', label: 'SQL' },
  go: { prism: 'go', label: 'Go' },
  rs: { prism: 'rust', label: 'Rust' },
  java: { prism: 'java', label: 'Java' },
  kt: { prism: 'kotlin', label: 'Kotlin' },
  kts: { prism: 'kotlin', label: 'Kotlin' },
  scala: { prism: 'scala', label: 'Scala' },
  c: { prism: 'c', label: 'C' },
  h: { prism: 'c', label: 'C' },
  cpp: { prism: 'cpp', label: 'C++' },
  cc: { prism: 'cpp', label: 'C++' },
  cxx: { prism: 'cpp', label: 'C++' },
  hpp: { prism: 'cpp', label: 'C++' },
  hh: { prism: 'cpp', label: 'C++' },
  cs: { prism: 'csharp', label: 'C#' },
  rb: { prism: 'ruby', label: 'Ruby' },
  php: { prism: 'php', label: 'PHP' },
  swift: { prism: 'swift', label: 'Swift' },
  dart: { prism: 'dart', label: 'Dart' },
  lua: { prism: 'lua', label: 'Lua' },
  ex: { prism: 'elixir', label: 'Elixir' },
  exs: { prism: 'elixir', label: 'Elixir' },
  hs: { prism: 'haskell', label: 'Haskell' },
  pl: { prism: 'perl', label: 'Perl' },
  pm: { prism: 'perl', label: 'Perl' },
  ps1: { prism: 'powershell', label: 'PowerShell' },
  groovy: { prism: 'groovy', label: 'Groovy' },
  gradle: { prism: 'groovy', label: 'Groovy' },
  m: { prism: 'objectivec', label: 'Objective-C' },
  mm: { prism: 'objectivec', label: 'Objective-C' },
  clj: { prism: 'clojure', label: 'Clojure' },
  cljs: { prism: 'clojure', label: 'Clojure' },
  erl: { prism: 'erlang', label: 'Erlang' },
  hrl: { prism: 'erlang', label: 'Erlang' },
  r: { prism: 'r', label: 'R' },
  zig: { prism: 'zig', label: 'Zig' },
  toml: { prism: 'toml', label: 'TOML' },
  graphql: { prism: 'graphql', label: 'GraphQL' },
  gql: { prism: 'graphql', label: 'GraphQL' },
  proto: { prism: 'protobuf', label: 'Protocol Buffers' },
  tf: { prism: 'hcl', label: 'HCL' },
  hcl: { prism: 'hcl', label: 'HCL' },
  tfvars: { prism: 'hcl', label: 'HCL' },
  diff: { prism: 'diff', label: 'Diff' },
  patch: { prism: 'diff', label: 'Diff' },
  ini: { prism: 'ini', label: 'INI' },
  properties: { prism: 'properties', label: 'Properties' },
  cmake: { prism: 'cmake', label: 'CMake' },
  mk: { prism: 'makefile', label: 'Makefile' },
}

export function extensionOf(path: string) {
  const name = path.split('/').pop() ?? path
  const dot = name.lastIndexOf('.')
  return dot > 0 ? name.slice(dot + 1).toLowerCase() : ''
}

export function languageOf(path: string): Language {
  const base = path.split('/').pop()?.toLowerCase() ?? ''
  if (base === 'dockerfile' || base.startsWith('dockerfile.')) return { prism: 'docker', label: 'Dockerfile' }
  if (base === 'makefile' || base === 'gnumakefile') return { prism: 'makefile', label: 'Makefile' }
  if (base === 'gemfile' || base === 'rakefile') return { prism: 'ruby', label: 'Ruby' }
  if (base === 'jenkinsfile') return { prism: 'groovy', label: 'Groovy' }
  if (base === 'go.mod') return { prism: 'go-mod', label: 'Go module' }
  if (base === 'cmakelists.txt') return { prism: 'cmake', label: 'CMake' }
  return LANGUAGES[extensionOf(path)] ?? { prism: 'plain', label: 'Plain text' }
}

export function FileIcon({ path, className }: { path: string; className?: string }) {
  const ext = extensionOf(path)
  const base = cn('h-3.5 w-3.5 shrink-0', className)
  if (ext === 'ts' || ext === 'tsx' || ext === 'mts' || ext === 'cts') {
    return <FileCode2 className={cn(base, 'text-[#3178c6] dark:text-[#5a9de6]')} />
  }
  if (ext === 'js' || ext === 'jsx' || ext === 'mjs' || ext === 'cjs') {
    return <FileCode2 className={cn(base, 'text-[#b59a00] dark:text-[#e8d44d]')} />
  }
  if (ext === 'json') return <Braces className={cn(base, 'text-[#8a8a00] dark:text-[#cbcb41]')} />
  if (ext === 'md' || ext === 'mdx') return <FileText className={cn(base, 'text-[#4f6bed] dark:text-[#7b93f5]')} />
  if (ext === 'css' || ext === 'scss') return <Palette className={cn(base, 'text-[#7c4dff] dark:text-[#a98bff]')} />
  if (ext === 'py') return <Hash className={cn(base, 'text-[#3572a5] dark:text-[#6aa5d8]')} />
  if (ext === 'sh' || ext === 'bash') return <Terminal className={cn(base, 'text-[#2f8a4c] dark:text-[#6cc287]')} />
  if (ext === 'java') return <FileCode2 className={cn(base, 'text-[#b07219] dark:text-[#d4a05a]')} />
  if (ext === 'kt' || ext === 'kts') return <FileCode2 className={cn(base, 'text-[#7f52ff] dark:text-[#b89bff]')} />
  if (languageOf(path).prism !== 'plain') return <FileCode2 className={cn(base, 'text-muted-foreground')} />
  return <File className={cn(base, 'text-muted-foreground')} />
}
