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

    if (pending) {
      return
    }

    setError(null)
    setPending(true)

    try {
      const result = await requestEmailCode({ data: { email } })
      setUserId(result.userId)
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi.')
    } finally {
      setPending(false)
    }
  }

  async function handleVerifyCode(event: FormEvent) {
    event.preventDefault()

    if (pending) {
      return
    }

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
    } catch (err) {
      // The email token is single-use. A failure here means the code
      // itself was rejected — show the normal error and let the person
      // re-enter or resend. Nothing below this point has run, so nothing
      // has consumed the token yet.
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi.')
      setPending(false)
      return
    }

    // The session now exists — verifyEmailCode already succeeded, which
    // means the single-use token is already consumed on Appwrite's side.
    // From here on, a failure is never a "bad code" problem, so it must
    // not reuse that error message, and it must not leave the person
    // re-submitting a code that can now only ever fail.
    try {
      // The root route's beforeLoad re-runs on this navigation, but its
      // ensureQueryData calls would otherwise serve the still-fresh
      // "signed out" cache entries (60s staleTime, set in router.tsx)
      // instead of refetching. Invalidate both so the header — and
      // anything else reading them — is correct immediately, not after the
      // cache happens to expire.
      await queryClient.invalidateQueries({
        queryKey: ['currentUser'],
        refetchType: 'all',
      })
      await queryClient.invalidateQueries({
        queryKey: ['personalAccount'],
        refetchType: 'all',
      })

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
    } catch {
      // Whatever failed, the session is already valid — a hard browser
      // navigation sidesteps it entirely via a fresh SSR request, which
      // re-resolves currentUser/personalAccount from the cookie
      // independently of whatever just failed in the client-side cache/
      // router machinery above. Same destination logic either way (the
      // existing-vs-new-user split happens again naturally on that fresh
      // request).
      window.location.href = safeRedirectTarget(redirect)
    } finally {
      setPending(false)
    }
  }

  // Re-requests a code for the same email. Shares the request itself with
  // handleRequestCode's server call; kept separate only because it needs a
  // different outcome (stay on the code step, clear the old code) rather
  // than switching steps.
  async function handleResend() {
    if (pending) {
      return
    }

    setError(null)
    setPending(true)

    try {
      const result = await requestEmailCode({ data: { email } })
      setUserId(result.userId)
      setCode('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi.')
    } finally {
      setPending(false)
    }
  }

  function handleCancel() {
    if (pending) {
      return
    }

    setStep('email')
    setCode('')
    setUserId(null)
    setError(null)
  }

  if (step === 'email') {
    return (
      <main>
        <div className="card">
          <h1>Kirish / Roʻyxatdan oʻtish</h1>
          <p className="card-subtitle">
            Email manzilingizga tasdiqlash kodi yuboramiz.
          </p>
          <form onSubmit={handleRequestCode}>
            <div className="field">
              <label htmlFor="email">Email manzil</label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={pending}
              />
            </div>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={pending}
            >
              {pending ? 'Yuklanmoqda…' : 'Kod yuborish'}
            </button>
          </form>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
        </div>
      </main>
    )
  }

  return (
    <main>
      <div className="card">
        <h1>Tasdiqlash kodi</h1>
        <p className="card-subtitle">Kod {email} manzilga yuborildi.</p>
        <form onSubmit={handleVerifyCode}>
          <div className="field">
            <label htmlFor="code">Tasdiqlash kodi</label>
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
          </div>
          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Yuklanmoqda…' : 'Davom etish'}
          </button>
        </form>
        <div className="link-actions">
          <button
            type="button"
            className="link-button"
            onClick={handleResend}
            disabled={pending}
          >
            Qayta yuborish
          </button>
          <button
            type="button"
            className="link-button"
            onClick={handleCancel}
            disabled={pending}
          >
            Bekor qilish
          </button>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
      </div>
    </main>
  )
}
