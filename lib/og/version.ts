// SPDX-License-Identifier: MIT
import 'server-only'
/**
 * OG image cache version (ADR-52).
 * Bump on any global renderer or product-language change that should invalidate
 * cached OG images across all users.
 *
 * Read from env so prod can rotate without code change; falls back to
 * an embedded default for safety.
 */
export const OG_RENDER_VERSION = process.env.OG_RENDER_VERSION ?? 'devastra-stellarium-v1'

export function ogVersionParam(): string {
  return `v=${encodeURIComponent(OG_RENDER_VERSION)}`
}
