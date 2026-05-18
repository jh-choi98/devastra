/**
 * Reserved usernames — paths that conflict with system routes or are
 * preemptively protected. Used by username validation on signup and change.
 *
 * The self-match exception (a user may set their display_username to their
 * own GitHub login even if it appears here) is applied at the validation
 * call site, not in this list.
 */
export const RESERVED_USERNAMES: ReadonlySet<string> = new Set([
  // App route segments
  'settings', 'onboarding', 'auth', 'api', 'admin',
  'privacy', 'terms', 'unsubscribe', 'account-deleted',
  'login', 'logout', 'signin', 'signup', 'signout',
  'dashboard', 'home', 'profile', 'recap',
  // Brand / system
  'devastra', 'devatlas', 'about', 'help', 'support', 'docs',
  'blog', 'pricing', 'features', 'security', 'status',
  // Common short names that should not be auto-claimed
  'me', 'you', 'us', 'all', 'new', 'edit', 'create', 'delete',
  'test', 'demo', 'example', 'sample', 'null', 'undefined',
])

export function isReservedUsername(username: string): boolean {
  return RESERVED_USERNAMES.has(username.toLowerCase())
}

/** @deprecated Use isReservedUsername instead */
export const isReserved = isReservedUsername
