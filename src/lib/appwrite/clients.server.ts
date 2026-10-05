/**
 * Server-only Appwrite client factories.
 *
 * The `.server.ts` suffix is not just a naming convention: TanStack Start's
 * import protection denies this file from the client bundle by default, so
 * an accidental import from client code fails the build instead of shipping
 * a secret.
 *
 * There are two kinds of client, and they are not interchangeable:
 *
 * - The admin client is authenticated with the project API key. Use it only
 *   for operations that happen before a user has a session of their own,
 *   i.e. starting an email-code sign-in and exchanging the code for a
 *   session. Its key carries broad, project-level scopes (see
 *   README.md: sessions.write, users.read, users.write, execution.write),
 *   not identity.
 *
 * - The session client is authenticated as one specific signed-in user via
 *   their Appwrite session secret. This is what must be used for anything
 *   that should be attributable to that user — reading `account.get()`, and
 *   executing the `personal-account` Function. The Function only trusts the
 *   `x-appwrite-user-id` header Appwrite injects for an authenticated
 *   execution; that header is only populated when the call was made with a
 *   session client, never with the admin client.
 *
 * Env vars are read lazily inside each factory, not at module load, so a
 * missing var surfaces as a clear error at the point of use rather than
 * crashing unrelated code on import.
 */

import process from 'node:process'

import { Client } from 'node-appwrite'

function requireEnv(name: string): string {
  const value = process.env[name]

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`)
  }

  return value
}

function baseClient(): Client {
  return new Client()
    .setEndpoint(requireEnv('APPWRITE_ENDPOINT'))
    .setProject(requireEnv('APPWRITE_PROJECT_ID'))
}

/** API-key client. Pre-session auth operations only — never user data. */
export function getAdminClient(): Client {
  return baseClient().setKey(requireEnv('APPWRITE_API_KEY'))
}

/** Session-secret client. Everything done "as" a specific signed-in user. */
export function getSessionClient(sessionSecret: string): Client {
  return baseClient().setSession(sessionSecret)
}