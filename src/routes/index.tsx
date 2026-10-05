import { Link, createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  // No beforeLoad of its own — this reads the same currentUser/
  // personalAccount already resolved by the root route, so it's correct on
  // first paint for the same reason the header is.
  const { currentUser, personalAccount } = Route.useRouteContext()

  return (
    <main>
      <div className="home-hero">
        <span className="brand">HAUZ</span>
        <p>
          HAUZ — Oʻzbekiston uchun koʻchmas mulk bozori. Mulk egalari va
          rieltorlar bir joyda.
        </p>

        {!currentUser && (
          <Link to="/sign-in" className="btn btn-primary">
            Kirish / Roʻyxatdan oʻtish
          </Link>
        )}

        {currentUser && !personalAccount && (
          <Link to="/onboarding" className="btn btn-primary">
            Roʻyxatdan oʻtishni yakunlang
          </Link>
        )}

        {currentUser && personalAccount && (
          <Link to="/profile" className="btn btn-primary">
            Profilga oʻtish
          </Link>
        )}
      </div>
    </main>
  )
}