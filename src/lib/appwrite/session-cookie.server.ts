/**
 * Server-only cookie utilities for the Appwrite session secret.
 *
 * This cookie's value is the Appwrite session secret itself, so the only
 * acceptable settings are httpOnly (unreadable to any browser JavaScript),
 * secure in production (cookie never sent over plain HTTP), and sameSite
 * "lax" (survives the top-level redirect back from the sign-in flow while
 * still being withheld from cross-site requests).
 *
 * These helpers must be called from a server execution context — a server
 * function (`createServerFn`) or a route's server-side loader/`beforeLoad`
 * — since that is what `getCookie`/`setCookie`/`deleteCookie` depend on to
 * reach the current request/response. Nothing in this app calls them yet;
 * that starts with the sign-in and current-user work in later steps.
 */

import process from 'node:process'

import { deleteCookie, getCookie, setCookie } from '@tanstack/react-start/server'

const SESSION_COOKIE_NAME = 'hauz_session'
const COOKIE_PATH = '/'

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: COOKIE_PATH,
}

/** Reads the raw Appwrite session secret from the request, if present. */
export function getSessionSecret(): string | undefined {
  return getCookie(SESSION_COOKIE_NAME)
}

/**
 * Stores the Appwrite session secret.
 *
 * Pass `expiresAt` from the Appwrite session's own `expire` field so the
 * cookie never outlives the session it represents. Without it the cookie
 * is a session cookie (cleared when the browser closes).
 */
export function setSessionSecret(secret: string, expiresAt?: Date): void {
  setCookie(SESSION_COOKIE_NAME, secret, {
    ...baseCookieOptions,
    ...(expiresAt ? { expires: expiresAt } : {}),
  })
}

/** Removes the session cookie, e.g. on logout or when it fails to validate. */
export function clearSessionSecret(): void {
  deleteCookie(SESSION_COOKIE_NAME, { path: COOKIE_PATH })
}