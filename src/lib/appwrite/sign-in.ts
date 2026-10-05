import { createServerFn } from '@tanstack/react-start'
import { Account, ID } from 'node-appwrite'
import { z } from 'zod'

import { getAdminClient } from './clients.server'
import { setSessionSecret } from './session-cookie.server'

const requestEmailCodeInput = z.object({
  email: z.email(),
})

export const requestEmailCode = createServerFn({ method: 'POST' })
  .validator((input: unknown) => requestEmailCodeInput.parse(input))
  .handler(async ({ data }): Promise<{ userId: string }> => {
    try {
      const account = new Account(getAdminClient())

      const token = await account.createEmailToken({
        userId: ID.unique(),
        email: data.email,
      })

      return { userId: token.userId }
    } catch (error) {
      console.error('requestEmailCode failed:', error)
      throw new Error('Could not send a sign-in code. Please try again.')
    }
  })

const verifyEmailCodeInput = z.object({
  userId: z.string().trim().min(1),
  code: z.string().trim().min(1),
})

export const verifyEmailCode = createServerFn({ method: 'POST' })
  .validator((input: unknown) => verifyEmailCodeInput.parse(input))
  .handler(async ({ data }): Promise<{ ok: true }> => {
    try {
      const account = new Account(getAdminClient())

      const session = await account.createSession({
        userId: data.userId,
        secret: data.code,
      })

      setSessionSecret(session.secret, new Date(session.expire))

      return { ok: true }
    } catch (error) {
      console.error('verifyEmailCode failed:', error)
      throw new Error('That code is invalid or expired. Please try again.')
    }
  })