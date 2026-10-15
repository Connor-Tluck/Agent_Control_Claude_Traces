const API = 'https://api.github.com'
const FILE_LIMIT = 12_000

export type GithubTarget = {
  owner: string
  repo: string
  ref?: string
  path?: string
}

function assertName(value: string, label: string) {
  if (!/^[A-Za-z0-9_.-]+$/.test(value)) throw new Error(`${label} is not a valid GitHub name`)
}

/** Accepts owner/repo, or a github.com URL that may include /blob or /tree. */
export function parseGithubTarget(input: string): GithubTarget {
  const trimmed = input.trim().replace(/\.git$/, '').replace(/\/+$/, '')
  let owner = ''
  let repo = ''
  let ref: string | undefined
  let path: string | undefined

  const url = trimmed.match(
    /^(?:https?:\/\/)?(?:www\.)?github\.com\/([^/\s]+)\/([^/\s]+)(?:\/(?:blob|tree)\/([^/\s]+)(?:\/(.+))?)?$/,
  )
  if (url) {
    owner = url[1]
    repo = url[2]
    ref = url[3]
    path = url[4]
  } else {
    const short = trimmed.match(/^([^/\s]+)\/([^/\s]+?)(?:\/(.+))?$/)
    if (!short) throw new Error('Pass a GitHub repository as owner/repo or a github.com URL')
    owner = short[1]
    repo = short[2]
    path = short[3]
  }

  assertName(owner, 'Owner')
  assertName(repo, 'Repository')
  if (path?.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('Path cannot contain ..')
  }
  return { owner, repo, ref, path }
}

type ContentEntry = {
  type: string
  name: string
  path: string
  size?: number
  encoding?: string
  content?: string
  truncated?: boolean
  html_url?: string
}

function formatListing(owner: string, repo: string, path: string, entries: ContentEntry[]) {
  const shown = entries.slice(0, 80)
  const lines = shown.map((entry) => {
    const size = entry.type === 'file' && entry.size != null ? ` (${entry.size} bytes)` : ''
    return `${entry.type === 'dir' ? 'dir ' : 'file'} ${entry.path}${size}`
  })
  const more = entries.length > shown.length ? `\n… ${entries.length - shown.length} more entries` : ''
  const where = path ? `${owner}/${repo}/${path}` : `${owner}/${repo}`
  return `Contents of ${where}:\n${lines.join('\n')}${more}`
}

function formatFile(owner: string, repo: string, path: string, entry: ContentEntry) {
  if (entry.encoding !== 'base64' || typeof entry.content !== 'string') {
    return `${owner}/${repo}/${path} is a ${entry.type} and has no text content.`
  }
  const text = Buffer.from(entry.content, 'base64').toString('utf8')
  const body = text.length > FILE_LIMIT ? `${text.slice(0, FILE_LIMIT)}\n\n/* truncated at ${FILE_LIMIT} characters */` : text
  return `File ${owner}/${repo}/${path}:\n${body}`
}

export async function readGithub(repoInput: string, pathInput?: string, refInput?: string) {
  const target = parseGithubTarget(repoInput)
  const path = (pathInput?.replace(/^\/+/, '') || target.path || '').replace(/\/+$/, '')
  if (path.split('/').some((part) => part === '..' || part === '.')) {
    throw new Error('Path cannot contain ..')
  }
  const ref = refInput || target.ref
  const url = new URL(`${API}/repos/${target.owner}/${target.repo}/contents/${path}`)
  if (ref) url.searchParams.set('ref', ref)

  const response = await fetch(url, {
    headers: {
      Accept: 'application/vnd.github+json',
      'User-Agent': 'codebench-agent',
      'X-GitHub-Api-Version': '2022-11-28',
    },
    signal: AbortSignal.timeout(12_000),
  })

  if (response.status === 404) {
    return `GitHub could not find ${target.owner}/${target.repo}${path ? `/${path}` : ''}. Check the repository, branch, and path.`
  }
  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    return `GitHub returned ${response.status} for ${target.owner}/${target.repo}. ${detail.slice(0, 240)}`
  }

  const body = (await response.json()) as ContentEntry | ContentEntry[]
  if (Array.isArray(body)) return formatListing(target.owner, target.repo, path, body)
  return formatFile(target.owner, target.repo, body.path || path, body)
}
