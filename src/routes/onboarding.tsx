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
  const [role, setRole] = useState<Role>('property_owner')
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

    setError(null)
    setPending(true)

    try {
      await createPersonalAccount({ data: { firstName, lastName, role } })

      await queryClient.invalidateQueries({ queryKey: ['personalAccount'] })

      await router.navigate({ href: safeRedirectTarget(redirectParam) })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main>
      <h1>Set up your account</h1>
      <form onSubmit={handleSubmit}>
        <label htmlFor="firstName">First name</label>
        <input
          id="firstName"
          type="text"
          autoComplete="given-name"
          required
          value={firstName}
          onChange={(event) => setFirstName(event.target.value)}
          disabled={pending}
        />

        <label htmlFor="lastName">Last name</label>
        <input
          id="lastName"
          type="text"
          autoComplete="family-name"
          required
          value={lastName}
          onChange={(event) => setLastName(event.target.value)}
          disabled={pending}
        />

        {/*
         * Role has no edit affordance anywhere by design: the Function's
         * update schema (validation.js) has no `role` field at all, so it
         * can't be changed after creation. This form is the only place it's
         * ever set.
         */}
        <fieldset disabled={pending}>
          <legend>Role</legend>
          <label>
            <input
              type="radio"
              name="role"
              value="property_owner"
              checked={role === 'property_owner'}
              onChange={() => setRole('property_owner')}
            />
            Property owner
          </label>
          <label>
            <input
              type="radio"
              name="role"
              value="realtor"
              checked={role === 'realtor'}
              onChange={() => setRole('realtor')}
            />
            Realtor
          </label>
        </fieldset>

        <button type="submit" disabled={pending}>
          {pending ? 'Creating…' : 'Continue'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
    </main>
  )
}