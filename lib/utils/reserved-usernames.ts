export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // system paths
  'settings', 'api', 'admin', 'login', 'signup', 'signin', 'signout', 'auth',
  'app', 'dev', 'static', '_next', 'public', 'about', 'help', 'support',
  'privacy', 'terms', 'docs', 'blog', 'home', 'me', 'profile', 'account',
  'onboarding', 'welcome', 'feed', 'explore', 'search', 'notifications',
  // brand confusion (a minimal MVP set)
  'devatlas', 'devatlas-app', 'official',
])

export function isReserved(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase())
}
