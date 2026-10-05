import { createServerFn } from '@tanstack/react-start'
import { Account } from 'node-appwrite'

import { getSessionClient } from './clients.server'
import { clearSessionSecret, getSessionSecret } from './session-cookie.server'

export const logout = createServerFn({ method: 'POST' }).handler(async () => {
  const sessionSecret = getSessionSecret()

  if (sessionSecret) {
    try {
      const account = new Account(getSessionClient(sessionSecret))
      await account.deleteSession({ sessionId: 'current' })
    } catch (error) {
      console.error('logout: deleteSession failed:', error)
    }
  }

  clearSessionSecret()

  return { ok: true as const }
})