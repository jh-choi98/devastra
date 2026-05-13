// No-op mock for 'server-only' in Vitest.
// The real package throws when loaded outside of a server bundle; in tests we
// run in Node so we skip the guard entirely.
export {}
