import { type FormEvent, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { z } from 'zod'

import { requestEmailCode, verifyEmailCode } from '../lib/appwrite/sign-in'
import { safeRedirectTarget } from '../lib/safe-redirect'

const searchSchema = z.object({
  redirect: z.string().optional(),
})

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search) => searchSchema.parse(search),
  component: SignInPage,
})

type Step = 'email' | 'code'

function SignInPage() {
  const { redirect } = Route.useSearch()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [step, setStep] = useState<Step>('email')
  const [email, setEmail] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleRequestCode(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setPending(true)

    try {
      const result = await requestEmailCode({ data: { email } })
      setUserId(result.userId)
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault()

    if (!userId) {
      setStep('email')
      return
    }

    setError(null)
    setPending(true)

    try {
      await verifyEmailCode({
        data: { userId, code },
      })

      await queryClient.invalidateQueries({
        queryKey: ['currentUser'],
      })

      await queryClient.invalidateQueries({
        queryKey: ['personalAccount'],
      })

      await router.navigate({
        href: safeRedirectTarget(redirect),
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  if (step === 'email') {
    return (
      <main>
        <h1>Sign in</h1>

        <form onSubmit={handleRequestCode}>
          <label htmlFor="email">Email</label>

          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            disabled={pending}
          />

          <button type="submit" disabled={pending}>
            {pending ? 'Sending…' : 'Send code'}
          </button>
        </form>

        {error && <p role="alert">{error}</p>}
      </main>
    )
  }

  return (
    <main>
      <h1>Enter your code</h1>

      <p>We sent a code to {email}.</p>

      <form onSubmit={handleVerifyCode}>
        <label htmlFor="code">Code</label>

        <input
          id="code"
          type="text"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
          disabled={pending}
        />

        <button type="submit" disabled={pending}>
          {pending ? 'Verifying…' : 'Continue'}
        </button>
      </form>

      {error && <p role="alert">{error}</p>}
    </main>
  )
}
