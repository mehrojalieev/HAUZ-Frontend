/**
 * The `redirect` query param on the sign-in route is untrusted input
 * reflected straight into a post-sign-in navigation. Without validation it's
 * an open-redirect vector: `//evil.com` and `/\evil.com` are both parsed by
 * browsers as protocol-relative URLs (same scheme, different host), and a
 * bare `https://evil.com` is an absolute URL outright. Only a path that
 * starts with a single `/` and isn't one of those is accepted; anything else
 * falls back to a sensible default.
 *
 * Plain function, no server dependency — used client-side at the point of
 * navigation.
 */

import { z } from 'zod'

/**
 * Shared by every route that accepts a `redirect` search param (sign-in,
 * onboarding) so they validate its shape identically. This only checks it's
 * a string; `safeRedirectTarget` below is what actually constrains it to a
 * safe same-origin path, at the point it's used for navigation.
 */
export const redirectSearchSchema = z.object({
  redirect: z.string().optional(),
})

export function safeRedirectTarget(
  redirect: string | undefined,
  fallback = '/',
): string {
  if (!redirect) {
    return fallback
  }

  if (!redirect.startsWith('/')) {
    return fallback
  }

  if (redirect.startsWith('//') || redirect.startsWith('/\\')) {
    return fallback
  }

  return redirect
}