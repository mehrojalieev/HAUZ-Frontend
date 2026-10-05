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
  const { currentUser, personalAccount } = Route.useRouteContext()
  const location = useLocation()
  const queryClient = useQueryClient()
  const router = useRouter()
  const [loggingOut, setLoggingOut] = useState(false)

  if (!currentUser) {
    return (
      <header>
        <Link to="/sign-in" search={{ redirect: location.pathname }}>
          Sign in
        </Link>
      </header>
    )
  }

  async function handleLogout() {
    if (loggingOut) {
      return
    }

    setLoggingOut(true)

    try {
      await logout()

      await queryClient.invalidateQueries({
        queryKey: ['currentUser'],
      })

      await queryClient.invalidateQueries({
        queryKey: ['personalAccount'],
      })

      await router.navigate({ to: '/' })
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <header>
      {personalAccount && <span>{personalAccount.firstName}</span>}

      <button
        type="button"
        onClick={handleLogout}
        disabled={loggingOut}
      >
        {loggingOut ? 'Logging out…' : 'Log out'}
      </button>
    </header>
  )
}