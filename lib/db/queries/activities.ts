import 'server-only'

export const ALLOWED_RAW_KEYS = ['file_paths', 'additions', 'deletions', 'github_url'] as const

export type ActivityRawShape = {
  file_paths: string[]
  additions: number
  deletions: number
  github_url: string
}

export function buildActivityRaw(input: Record<string, unknown>): ActivityRawShape {
  const disallowedKeys = Object.keys(input).filter(
    (k) => !(ALLOWED_RAW_KEYS as readonly string[]).includes(k),
  )
  if (disallowedKeys.length > 0) {
    console.warn(`[activities] stripped disallowed raw keys: ${disallowedKeys.join(', ')}`)
  }
  return {
    file_paths: Array.isArray(input.file_paths) ? (input.file_paths as string[]) : [],
    additions: typeof input.additions === 'number' ? input.additions : 0,
    deletions: typeof input.deletions === 'number' ? input.deletions : 0,
    github_url: typeof input.github_url === 'string' ? input.github_url : '',
  }
}
