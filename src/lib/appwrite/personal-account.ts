/**
 * The current user's Personal Account, read through the `personal-account`
 * Appwrite Function — never by querying the `personal_accounts` table
 * directly.
 */

import { queryOptions } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { ExecutionMethod, Functions } from 'node-appwrite'


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

    if (!sessionSecret) {
      return null
    }

    try {
      const functions = new Functions(getSessionClient(sessionSecret))

const execution = await functions.createExecution({
  functionId: FUNCTION_ID,
  xpath: '/personal-account',
  method: ExecutionMethod.GET,
})

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
      return null
    }
  },
)

export const personalAccountQueryOptions = () =>
  queryOptions({
    queryKey: ['personalAccount'] as const,
    queryFn: () => getPersonalAccount(),
  })