import { type FormEvent, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect } from '@tanstack/react-router'

import {
  type PersonalAccount,
  updatePersonalAccount,
} from '../lib/appwrite/personal-account'

export const Route = createFileRoute('/profile')({
  beforeLoad: ({ context }) => {
    // Both come from the root route's own beforeLoad — already resolved
    // for this request, no extra fetch here.
    if (!context.currentUser) {
      throw redirect({ to: '/sign-in', search: { redirect: '/profile' } })
    }

    if (!context.personalAccount) {
      // Nothing to view or edit yet. Same relationship as onboarding's own
      // guard, just the mirror image of it: send them to finish onboarding
      // first, preserving /profile as where they land afterward.
      throw redirect({ to: '/onboarding', search: { redirect: '/profile' } })
    }
  },
  component: ProfilePage,
})

function ProfilePage() {
  const { currentUser, personalAccount } = Route.useRouteContext()

  // beforeLoad guarantees both are present by the time this renders; this
  // is just to satisfy the type checker, not expected to actually render.
  if (!currentUser || !personalAccount) {
    return null
  }

  return (
    <ProfileForm currentUserId={currentUser.id} personalAccount={personalAccount} />
  )
}

function ProfileForm({
  currentUserId,
  personalAccount,
}: {
  currentUserId: string
  personalAccount: PersonalAccount
}) {
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = useState(personalAccount.firstName)
  const [lastName, setLastName] = useState(personalAccount.lastName)
  const [contactEmail, setContactEmail] = useState(
    personalAccount.contactEmail ?? '',
  )
  const [bio, setBio] = useState(personalAccount.bio ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [pending, setPending] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()

    // Same belt-and-suspenders reasoning as onboarding: the Function's own
    // update is naturally idempotent (it's just a row update, not a
    // create), so there's no duplicate-record risk here the way there was
    // for onboarding. This still guards against firing two overlapping
    // requests from one fast double-click.
    if (pending) {
      return
    }

    setError(null)
    setSuccess(false)
    setPending(true)

    try {
      await updatePersonalAccount({
        data: {
          userId: currentUserId,
          firstName,
          lastName,
          // Empty means "cleared," which the Function represents as null,
          // not "" — see validation.js' clearedWithNull message.
          contactEmail: contactEmail.trim() === '' ? null : contactEmail.trim(),
          bio: bio.trim() === '' ? null : bio.trim(),
        },
      })

      // The header and this page both read the personalAccount query;
      // invalidate so neither shows the pre-edit values after this.
      await queryClient.invalidateQueries({ queryKey: ['personalAccount'] })

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main>
      <h1>Profile</h1>
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

        <label htmlFor="contactEmail">Contact email</label>
        <input
          id="contactEmail"
          type="email"
          autoComplete="email"
          value={contactEmail}
          onChange={(event) => setContactEmail(event.target.value)}
          disabled={pending}
        />

        <label htmlFor="bio">Bio</label>
        <textarea
          id="bio"
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          disabled={pending}
        />

        {/*
         * Role has no edit affordance anywhere in this form, by design: the
         * Function's update schema (validation.js' updateRequest) has no
         * role field at all, so it can't be changed after creation.
         */}
        <p>
          Role:{' '}
          {personalAccount.role === 'property_owner'
            ? 'Property owner'
            : 'Realtor'}
        </p>

        <button type="submit" disabled={pending}>
          {pending ? 'Saving…' : 'Save'}
        </button>
      </form>
      {error && <p role="alert">{error}</p>}
      {success && <p role="status">Saved.</p>}
    </main>
  )
}