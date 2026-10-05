import { useState } from 'react'

import { type QueryClient, useQueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Link,
  Scripts,
  createRootRouteWithContext,
  useLocation,
  useRouter,
} from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { currentUserQueryOptions } from '../lib/appwrite/current-user'
import { logout } from '../lib/appwrite/logout'
import { personalAccountQueryOptions } from '../lib/appwrite/personal-account'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    // Resolved during SSR, seeded into the query cache, and dehydrated to
    // the client by the existing setupRouterSsrQueryIntegration wiring in
    // router.tsx — so the header reads this from context with no extra
    // client-side fetch and no loading flash.
    //
    // Both queries independently read the session cookie rather than one
    // depending on the other's result, so they're safe to resolve in
    // parallel.
    const [currentUser, personalAccount] = await Promise.all([
      context.queryClient.ensureQueryData(currentUserQueryOptions()),
      context.queryClient.ensureQueryData(personalAccountQueryOptions()),
    ])

    return { currentUser, personalAccount }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'HAUZ' },
    ],
    links: [{ rel: 'stylesheet', href: appCss }],
  }),
  shellComponent: RootDocument,
})

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Header />
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function Header() {
  // Both values were resolved in this route's own beforeLoad, so they're
  // already correct on the very first server-rendered paint — no effect,
  // no client-only fetch, no flash from "Sign in" to the real state.
  const { currentUser, personalAccount } = Route.useRouteContext()
  const location = useLocation()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  // The sign-in page is itself the destination a signed-out "Kirish" link
  // would point to, and not a place "Chiqish" belongs either (someone can
  // land here already signed in — a stale bookmark, the back button).
  // Neither auth control makes sense on this one page, regardless of
  // currentUser, so it gets a bare header instead of the normal branches
  // below.
  if (location.pathname === '/sign-in') {
    return (
      <header className="site-header">
        <Link to="/" className="brand">
          HAUZ
        </Link>
      </header>
    )
  }

  if (!currentUser) {
    return (
      <header className="site-header">
        <Link to="/" className="brand">
          HAUZ
        </Link>
        <div className="header-auth">
          <Link to="/sign-in" search={{ redirect: location.pathname }}>
            Kirish
          </Link>
        </div>
      </header>
    )
  }

  async function handleLogout() {
    // Belt-and-suspenders against a fast double-click, same reasoning as
    // onboarding/profile's submit guards — not that a second logout call
    // would do any harm here, just avoids firing it unnecessarily.
    if (loggingOut) {
      return
    }

    setLoggingOut(true)

    try {
      await logout()

      // Same reasoning as sign-in's post-verify invalidation: without this,
      // the header would keep showing the signed-in state from the still-
      // fresh cache (60s staleTime in router.tsx) after navigating.
      await queryClient.invalidateQueries({
        queryKey: ['currentUser'],
        refetchType: 'all',
      })
      await queryClient.invalidateQueries({
        queryKey: ['personalAccount'],
        refetchType: 'all',
      })

      await router.navigate({ to: '/' })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <header className="site-header">
      <Link to="/" className="brand">
        HAUZ
      </Link>
      <div className="header-auth">
        {/*
         * personalAccount is null for a signed-in user who hasn't finished
         * onboarding yet (no Personal Account created). The name is simply
         * omitted in that state rather than falling back to Appwrite's own
         * `name` field, which is not the same thing as the Personal
         * Account's first name.
         */}
        {personalAccount && (
          <>
            <span className="header-name">{personalAccount.firstName}</span>
            <Link to="/profile">Profil</Link>
          </>
        )}
        <button type="button" onClick={handleLogout} disabled={loggingOut}>
          {loggingOut ? 'Yuklanmoqda…' : 'Chiqish'}
        </button>
      </div>
    </header>
  )
}
