import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'

import { currentUserQueryOptions } from '../lib/appwrite/current-user'
import { personalAccountQueryOptions } from '../lib/appwrite/personal-account'
import appCss from '../styles.css?url'

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

  if (!currentUser) {
    return (
      <header>
        <span>Sign in</span>
      </header>
    )
  }

  return (
    <header>
      {personalAccount && <span>{personalAccount.firstName}</span>}

      <button type="button" disabled>
        Log out
      </button>
    </header>
  )
}