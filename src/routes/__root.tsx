import type { QueryClient } from '@tanstack/react-query'
import {
  HeadContent,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'

import appCss from '../styles.css?url'
import { currentUserQueryOptions } from '../lib/appwrite/current-user'

export interface RouterContext {
  queryClient: QueryClient
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async ({ context }) => {
    // Resolved during SSR, seeded into the query cache, and dehydrated to
    // the client by the existing setupRouterSsrQueryIntegration wiring in
    // router.tsx — so the header (built in a later step) reads this from
    // context with no extra client-side fetch and no loading flash.
    const currentUser = await context.queryClient.ensureQueryData(
      currentUserQueryOptions(),
    )

    return { currentUser }
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
        {/* The site header belongs here. See TASK.md. */}
        {children}
        <Scripts />
      </body>
    </html>
  )
}