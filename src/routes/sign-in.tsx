import { type FormEvent, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, useRouter } from '@tanstack/react-router'

import { personalAccountQueryOptions } from '../lib/appwrite/personal-account'
import { requestEmailCode, verifyEmailCode } from '../lib/appwrite/sign-in'
import { redirectSearchSchema, safeRedirectTarget } from '../lib/safe-redirect'

export const Route = createFileRoute('/sign-in')({
  validateSearch: (search) => redirectSearchSchema.parse(search),
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

    // Shouldn't be reachable (this step only renders after step one sets
    // userId), but keeps the call well-typed without a non-null assertion.
    if (!userId) {
      setStep('email')
      return
    }

    setError(null)
    setPending(true)

    try {
      await verifyEmailCode({ data: { userId, code } })

      // The root route's beforeLoad re-runs on this navigation, but its
      // ensureQueryData calls would otherwise serve the still-fresh
      // "signed out" cache entries (60s staleTime, set in router.tsx)
      // instead of refetching. Invalidate both so the header — and
      // anything else reading them — is correct immediately, not after the
      // cache happens to expire.
      await queryClient.invalidateQueries({ queryKey: ['currentUser'] })
      await queryClient.invalidateQueries({ queryKey: ['personalAccount'] })

      // Which page comes next depends on whether this person already has a
      // Personal Account. ensureQueryData reads it fresh here (it was just
      // invalidated above), so this reflects the account as of right now,
      // not a stale pre-sign-in value.
      const personalAccount = await queryClient.ensureQueryData(
        personalAccountQueryOptions(),
      )

      if (personalAccount) {
        await router.navigate({ href: safeRedirectTarget(redirect) })
      } else {
        // Carry the original destination through onboarding rather than
        // replacing it — onboarding is a detour, not a new destination.
        await router.navigate({
          to: '/onboarding',
          search: { redirect },
        })
      }
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