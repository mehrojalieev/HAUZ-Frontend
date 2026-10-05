/**
 * The current signed-in Appwrite user, resolved server-side.
 *
 * This file is intentionally NOT suffixed `.server.ts`. `getCurrentUser` is a
 * `createServerFn`, which TanStack Start compiles into an isomorphic
 * reference: safe to import from client-reachable code (a future header
 * component, for instance). Only a thin RPC-calling stub ships to the
 * browser — the handler body below, and everything it imports (the Appwrite
 * SDK, the session cookie helpers, the session client), is stripped from the
 * client bundle and only ever executes on the server, no matter where
 * `getCurrentUser` is called from.
 *
 * The result intentionally carries only the raw Appwrite identity (id,
 * email, name). It says nothing about onboarding status or profile fields
 * (first/last name, role, ...) — those live in the Personal Account, which
 * is reached through the `personal-account` Function, not here.
 */

import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { Account } from 'node-appwrite'

import { getSessionClient } from './clients.server'
import { clearSessionSecret, getSessionSecret } from './session-cookie.server'

export interface CurrentUser {
  id: string
  email: string
  name: string
}

export const getCurrentUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CurrentUser | null> => {
    const sessionSecret = getSessionSecret()

    if (!sessionSecret) {
      return null
    }

    try {
      const account = new Account(getSessionClient(sessionSecret))
      const user = await account.get()

      return { id: user.$id, email: user.email, name: user.name }
    } catch {
      // Expired secret, revoked session, Appwrite unreachable, misconfigured
      // env var, anything else: treat it as signed out, not as an error
      // state. Clearing the cookie keeps a known-bad secret from being
      // resent and re-failing on every subsequent request.
      clearSessionSecret()
      return null
    }
  },
)

/**
 * Shared query options so the root route's `beforeLoad` (via
 * `ensureQueryData`) and, later, client components (via `useQuery` /
 * `useSuspenseQuery`) read the exact same cache entry instead of issuing
 * separate requests for the same thing.
 */
export const currentUserQueryOptions = () =>
  queryOptions({
    queryKey: ['currentUser'] as const,
    queryFn: () => getCurrentUser(),
  })