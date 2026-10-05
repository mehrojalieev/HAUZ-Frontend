import { type FormEvent, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

import { createPersonalAccount } from '../lib/appwrite/personal-account'
import { redirectSearchSchema, safeRedirectTarget } from '../lib/safe-redirect'

export const Route = createFileRoute('/onboarding')({
  validateSearch: (search) => redirectSearchSchema.parse(search),
  beforeLoad: ({ context, search }) => {
    // currentUser and personalAccount both come from the root route's own
    // beforeLoad — already resolved for this request, no extra fetch here.
    if (!context.currentUser) {
      // Preserve the full chain: send sign-in back to this exact onboarding
      // URL (including whatever redirect it was carrying), not just
      // "/onboarding" bare, so the destination isn't lost for someone who
      // opened this URL directly while signed out.
      const onboardingPath = search.redirect
        ? `/onboarding?redirect=${encodeURIComponent(search.redirect)}`
        : '/onboarding'

      throw redirect({ to: '/sign-in', search: { redirect: onboardingPath } })
    }

    if (context.personalAccount) {
      // Already onboarded — brief says this page is skipped entirely, so
      // direct navigation here goes straight where they were headed.
      throw redirect({ href: safeRedirectTarget(search.redirect) })
    }
  },
  component: OnboardingPage,
})

type Role = 'property_owner' | 'realtor'

function OnboardingPage() {
  const { redirect: redirectParam } = Route.useSearch()
  const router = useRouter()
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  // No default. A role must be explicitly chosen — defaulting to either
  // option silently would let someone submit a role they never actually
  // picked, and it is immutable afterward (see note below), so there is no
  // "change it later" safety net if that happened.
  const [role, setRole] = useState<Role | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    // The real duplicate-account protection is server-side (the table's
    // unique index on appwrite_user_id; see handlers.js' createRow/catch
    // path). This is just belt-and-suspenders against a fast double-click
    // firing a second request before React re-renders the disabled button.
    if (pending) {
      return
    }

    // Defensive fallback: the submit button is already disabled while role
    // is unset (see below), so this should not be reachable in normal use.
    if (!role) {
      setError('Davom etish uchun rolni tanlang.')
      return
    }

    setError(null)
    setPending(true)

    try {
      await createPersonalAccount({ data: { firstName, lastName, role } })

      await queryClient.invalidateQueries({
        queryKey: ['personalAccount'],
        refetchType: 'all',
      })

      await router.navigate({ href: safeRedirectTarget(redirectParam) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main>
      <div className="card">
        <h1>Hisobingizni yarating</h1>
        <p className="card-subtitle">Ism, familiya va rolingizni kiriting.</p>
        <form onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="firstName">Ism</label>
            <input
              id="firstName"
              type="text"
              autoComplete="given-name"
              required
              value={firstName}
              onChange={(event) => setFirstName(event.target.value)}
              disabled={pending}
            />
          </div>

          <div className="field">
            <label htmlFor="lastName">Familiya</label>
            <input
              id="lastName"
              type="text"
              autoComplete="family-name"
              required
              value={lastName}
              onChange={(event) => setLastName(event.target.value)}
              disabled={pending}
            />
          </div>

          {/*
           * Role has no edit affordance anywhere by design: the Function's
           * update schema (validation.js) has no `role` field at all, so it
           * can't be changed after creation. This form is the only place it
           * is ever set.
           */}
          <div className="field">
            <label>Rol</label>
            <div className="role-options">
              <label
                className={
                  role === 'property_owner'
                    ? 'role-option role-option--selected'
                    : 'role-option'
                }
              >
                <input
                  type="radio"
                  name="role"
                  value="property_owner"
                  checked={role === 'property_owner'}
                  onChange={() => setRole('property_owner')}
                  disabled={pending}
                  required
                />
                <span>Mulk egasi</span>
              </label>
              <label
                className={
                  role === 'realtor'
                    ? 'role-option role-option--selected'
                    : 'role-option'
                }
              >
                <input
                  type="radio"
                  name="role"
                  value="realtor"
                  checked={role === 'realtor'}
                  onChange={() => setRole('realtor')}
                  disabled={pending}
                  required
                />
                <span>Rieltor</span>
              </label>
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={pending || !role}
          >
            {pending ? 'Yuklanmoqda…' : 'Davom etish'}
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
