const DEFAULT_PUBLIC_BASE_URL = 'https://devastra.app'

export function getPublicBaseUrl(): string {
  const value =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    DEFAULT_PUBLIC_BASE_URL
  return value.replace(/\/+$/, '')
}

export function publicUrl(path: string): string {
  const normalizedPath = path.startsWith('/') ? path : `/${path}`
  return `${getPublicBaseUrl()}${normalizedPath}`
}
