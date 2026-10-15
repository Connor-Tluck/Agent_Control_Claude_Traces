import Prism from 'prismjs'
import 'prismjs/components/prism-typescript'
import 'prismjs/components/prism-jsx'
import 'prismjs/components/prism-tsx'
import 'prismjs/components/prism-json'
import 'prismjs/components/prism-markdown'
import 'prismjs/components/prism-python'
import 'prismjs/components/prism-bash'
import 'prismjs/components/prism-yaml'
import 'prismjs/components/prism-sql'
import 'prismjs/components/prism-go'
import 'prismjs/components/prism-go-module'
import 'prismjs/components/prism-rust'
import 'prismjs/components/prism-java'
import 'prismjs/components/prism-scala'
import 'prismjs/components/prism-c'
import 'prismjs/components/prism-cpp'
import 'prismjs/components/prism-csharp'
import 'prismjs/components/prism-kotlin'
import 'prismjs/components/prism-groovy'
import 'prismjs/components/prism-ruby'
import 'prismjs/components/prism-markup-templating'
import 'prismjs/components/prism-php'
import 'prismjs/components/prism-swift'
import 'prismjs/components/prism-dart'
import 'prismjs/components/prism-lua'
import 'prismjs/components/prism-elixir'
import 'prismjs/components/prism-haskell'
import 'prismjs/components/prism-perl'
import 'prismjs/components/prism-powershell'
import 'prismjs/components/prism-objectivec'
import 'prismjs/components/prism-clojure'
import 'prismjs/components/prism-erlang'
import 'prismjs/components/prism-r'
import 'prismjs/components/prism-zig'
import 'prismjs/components/prism-sass'
import 'prismjs/components/prism-scss'
import 'prismjs/components/prism-docker'
import 'prismjs/components/prism-toml'
import 'prismjs/components/prism-graphql'
import 'prismjs/components/prism-diff'
import 'prismjs/components/prism-ini'
import 'prismjs/components/prism-properties'
import 'prismjs/components/prism-protobuf'
import 'prismjs/components/prism-hcl'
import 'prismjs/components/prism-makefile'
import 'prismjs/components/prism-cmake'

const ALIASES: Record<string, string> = {
  ts: 'typescript',
  js: 'javascript',
  jsx: 'jsx',
  tsx: 'tsx',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  py: 'python',
  html: 'markup',
  xml: 'markup',
  svg: 'markup',
  md: 'markdown',
  rs: 'rust',
  golang: 'go',
  kt: 'kotlin',
  kts: 'kotlin',
  'c++': 'cpp',
  cxx: 'cpp',
  cc: 'cpp',
  hpp: 'cpp',
  hh: 'cpp',
  h: 'c',
  'c#': 'csharp',
  cs: 'csharp',
  rb: 'ruby',
  ex: 'elixir',
  exs: 'elixir',
  hs: 'haskell',
  pl: 'perl',
  ps1: 'powershell',
  gradle: 'groovy',
  objc: 'objectivec',
  'objective-c': 'objectivec',
  clj: 'clojure',
  cljs: 'clojure',
  erl: 'erlang',
  dockerfile: 'docker',
  gql: 'graphql',
  proto: 'protobuf',
  tf: 'hcl',
  terraform: 'hcl',
  make: 'makefile',
  patch: 'diff',
  'go.mod': 'go-mod',
}

function escapeHtml(code: string) {
  return code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function highlight(code: string, language: string) {
  const key = language.trim().toLowerCase()
  const name = ALIASES[key] ?? key
  const grammar = Prism.languages[name]
  if (!grammar) return escapeHtml(code)
  return Prism.highlight(code, grammar, name)
}
