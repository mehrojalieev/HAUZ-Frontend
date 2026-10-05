/**
 * The current user's Personal Account, read through the `personal-account`
 * Appwrite Function — never by querying the `personal_accounts` table
 * directly, which the web app has no access to at all (see
 * functions/personal-account and appwrite.config.json's empty table
 * permissions).
 *
 * Same reasoning as current-user.ts for the missing `.server.ts` suffix:
 * `getPersonalAccount` is a `createServerFn`, safe to import from
 * client-reachable code (the profile page will reuse it). Only a thin RPC
 * stub ships to the browser; the handler body, and the Appwrite SDK it
 * drives, are stripped from the client bundle.
 *
 * `GET` (read, for the header) and now `POST` (onboarding) are wrapped
 * here. `PATCH` (profile editing) comes with its own step.
 */

import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { ExecutionMethod, Functions } from 'node-appwrite'
import { z } from 'zod'

import { getSessionClient } from './clients.server'
import { getSessionSecret } from './session-cookie.server'

const FUNCTION_ID = 'personal-account'

export interface PersonalAccount {
  personalAccountId: string
  firstName: string
  lastName: string
  role: 'property_owner' | 'realtor'
  contactEmail: string | null
  bio: string | null
  createdAt: string
  updatedAt: string
}

export const getPersonalAccount = createServerFn({ method: 'GET' }).handler(
  async (): Promise<PersonalAccount | null> => {
    const sessionSecret = getSessionSecret()

    // No session at all: don't even attempt a Function execution.
    if (!sessionSecret) {
      return null
    }

    try {
      const functions = new Functions(getSessionClient(sessionSecret))

      const execution = await functions.createExecution({
        functionId: FUNCTION_ID,
       method: ExecutionMethod.GET,
       xpath: '/personal-account',
      })

      // 404 is the Function's documented "signed in, not onboarded yet"
      // response — a normal state, not a failure.
      if (execution.responseStatusCode === 404) {
        return null
      }

      if (execution.responseStatusCode !== 200) {
        throw new Error(
          `personal-account GET returned ${execution.responseStatusCode}`,
        )
      }

      return JSON.parse(execution.responseBody) as PersonalAccount
    } catch {
      // The header only needs this for a display name; a transient failure
      // here (session invalid, Appwrite unreachable, anything else) should
      // degrade to "no name available yet," not break the page. Session
      // validity itself is current-user.ts's job, not this file's.
      return null
    }
  },
)

/**
 * Shared query options, mirroring current-user.ts's pattern: the root
 * route's `beforeLoad` and, later, the profile page read the same cache
 * entry instead of issuing separate requests.
 */
export const personalAccountQueryOptions = () =>
  queryOptions({
    queryKey: ['personalAccount'] as const,
    queryFn: () => getPersonalAccount(),
  })

const createPersonalAccountInput = z.object({
  firstName: z.string().trim().min(1).max(100),
  lastName: z.string().trim().min(1).max(100),
  role: z.enum(['property_owner', 'realtor']),
})

type CreatePersonalAccountInput = z.infer<typeof createPersonalAccountInput>

async function executeCreate(
  sessionSecret: string,
  data: CreatePersonalAccountInput,
) {
  try {
    const functions = new Functions(getSessionClient(sessionSecret))

    return await functions.createExecution({
      functionId: FUNCTION_ID,
      xpath: '/personal-account',
      method: ExecutionMethod.POST,
      body: JSON.stringify(data),
    })
  } catch (error) {
    console.error('createPersonalAccount execution failed:', error)
    throw new Error('Could not create your account. Please try again.')
  }
}

/**
 * Unlike `getPersonalAccount`, this does NOT swallow failures into `null`.
 * GET backs a header display name — a transient failure there should
 * degrade quietly. A failed account creation is the opposite: the person
 * needs to see it and retry, so real errors propagate as thrown `Error`s
 * with a message safe to show as-is.
 */
export const createPersonalAccount = createServerFn({ method: 'POST' })
  .validator((input: unknown) => createPersonalAccountInput.parse(input))
  .handler(async ({ data }): Promise<PersonalAccount> => {
    const sessionSecret = getSessionSecret()

    if (!sessionSecret) {
      // The Function itself is still the real enforcement (401 with no
      // x-appwrite-user-id, since execute access is "users"). This just
      // fails fast with a clearer message instead of making a doomed call.
      throw new Error('You need to be signed in to do this.')
    }

    const execution = await executeCreate(sessionSecret, data)

    // 201 = created. 200 = already existed with this same role — the
    // Function's own double-submit / retry handling (handlers.js'
    // reconcile()), not something this code needs to guard against itself.
    if (
      execution.responseStatusCode === 201 ||
      execution.responseStatusCode === 200
    ) {
      return JSON.parse(execution.responseBody) as PersonalAccount
    }

    if (execution.responseStatusCode === 409) {
      // A genuine conflict (exists with a different role), not a retry.
      // The Function's own message already names the existing role, and is
      // written to be shown to the person, not just logged.
      const body = JSON.parse(execution.responseBody) as { message?: string }
      throw new Error(
        body.message ?? 'This account already exists with a different role.',
      )
    }

    console.error(
      `createPersonalAccount: Function returned ${execution.responseStatusCode}`,
      execution.responseBody,
    )
    throw new Error('Could not create your account. Please try again.')
  })