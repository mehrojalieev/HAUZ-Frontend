import { type FormEvent, useState } from 'react'

import { useQueryClient } from '@tanstack/react-query'
import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'

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
    // key={personalAccount.updatedAt}: ProfileForm's fields are local state
    // seeded once from this prop. Without a key, React keeps that state
    // across re-renders even when personalAccount changes underneath it
    // (a save elsewhere, or the refresh below), so the form would keep
    // showing stale values. Keying on updatedAt — which the Function bumps
    // on every successful PATCH — forces a clean remount with the fresh
    // values whenever the account actually changes.
    <ProfileForm
      key={personalAccount.updatedAt}
      currentUserId={currentUser.id}
      personalAccount={personalAccount}
    />
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
  const router = useRouter()

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

      // Nothing holds an active useQuery subscription on personalAccount
      // (it's read from route context, populated only by beforeLoad), so a
      // plain invalidate would only mark it stale — and beforeLoad's
      // ensureQueryData happily returns stale data. refetchType: 'all'
      // actually refetches it; router.invalidate() then re-runs beforeLoad
      // so the context this page (and the header) reads picks it up.
      await queryClient.invalidateQueries({
        queryKey: ['personalAccount'],
        refetchType: 'all',
      })
      await router.invalidate()

      setSuccess(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Xatolik yuz berdi.')
    } finally {
      setPending(false)
    }
  }

  return (
    <main>
      <div className="card card--wide">
        <h1>Profil</h1>
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

          <div className="field">
            <label htmlFor="contactEmail">Email manzil (ixtiyoriy)</label>
            <input
              id="contactEmail"
              type="email"
              autoComplete="email"
              value={contactEmail}
              onChange={(event) => setContactEmail(event.target.value)}
              disabled={pending}
            />
          </div>

          <div className="field">
            <label htmlFor="bio">Bio (ixtiyoriy)</label>
            <textarea
              id="bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              disabled={pending}
            />
          </div>

          {/*
           * Role has no edit affordance anywhere in this form, by design:
           * the Function's update schema (validation.js' updateRequest)
           * has no role field at all, so it can't be changed after
           * creation.
           */}
          <div className="field">
            <label>Rol</label>
            <p className="field-hint">
              {personalAccount.role === 'property_owner'
                ? 'Mulk egasi'
                : 'Rieltor'}
            </p>
          </div>

          <button type="submit" className="btn btn-primary" disabled={pending}>
            {pending ? 'Yuklanmoqda…' : 'Saqlash'}
          </button>
        </form>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {success && (
          <p className="form-success" role="status">
            Saqlandi.
          </p>
        )}
      </div>
    </main>
  )
}
