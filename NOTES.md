# Implementation Notes

## Key decisions

- **SSR and current-user loading.** The root route's `beforeLoad` resolves `currentUser` and `personalAccount` server-side via `ensureQueryData`, seeded into the dehydrated query cache. The header reads this from route context, not a client effect, so it is correct on first paint, including after a hard refresh.
- **Appwrite session handling.** An admin (API-key) client handles pre-session operations (requesting and verifying the email code); a session-scoped client (built from the user's secret) handles everything attributable to that user. The secret lives only in an httpOnly, `sameSite=lax` cookie (`secure` in production) and is never readable from browser JavaScript.
- **Server-side Appwrite access only.** Appwrite SDK calls and the API key live only inside `createServerFn` handlers or `.server.ts` modules, never in code shipped to the browser. The project has no Appwrite Web SDK dependency.
- **Personal Account data via the Function only.** All reads/writes go through the `personal-account` Function's GET/POST/PATCH routes. The table itself has no permissions granted to any user or API key — only the Function's own scoped execution key can touch it.
- **Email-code sign-in.** A two-step flow (request code, verify code) relying on Appwrite's documented `createEmailToken` behavior: a new account is created only if the email is unused, otherwise the existing user's id is used. New and returning users see identical screens.
- **Safe redirect handling.** The `redirect` query parameter is restricted to same-origin relative paths and preserved through the sign-in → onboarding → destination chain.
- **Double-submit protection.** The real guarantee is the table's unique index plus the Function's catch-and-reconcile handling of a race; the disabled-while-pending button is a UX convenience only.
- **Role is immutable.** Enforced structurally by the Function's PATCH schema, which has no `role` field. No form renders role as editable outside onboarding.

## Brief discrepancies / interpretations

The brief says the profile form should send the signed-in user's id with changes. The frontend does this — `userId` is included in the PATCH payload. The Function itself never reads identity from the body; it trusts only the `x-appwrite-user-id` header Appwrite injects for an authenticated execution, so the submitted `userId` has no effect on which account is updated. This is intentional: trusting a client-supplied id would let the browser claim another user's identity. The field is still sent, per the brief, rather than silently omitted.

## Production next steps

- Stronger automated tests (server functions, Function integration coverage)
- Better user-facing error handling, including field-level validation detail
- Monitoring and logging around server function and Function failures
- Rate limiting / abuse protection for email-code requests (currently relies on Appwrite Cloud's own cooldown)
- End-to-end tests covering sign-in, onboarding, profile editing, and logout

## Known audit fix

Current-user loading was hardened: the handler's try/catch now also covers reading the session cookie, not only the Appwrite call, so any in-process failure clears the cookie and resolves to signed-out. Separately, a client-side server-function/RPC rejection is converted to the same signed-out result via `.catch(() => null)` on the query function, avoiding an unhandled loading error. This cannot clear the server-side cookie in that specific case, since the server never received the request; the cookie resolves correctly the next time a request reaches the server. This is a robustness refinement, not a security vulnerability.