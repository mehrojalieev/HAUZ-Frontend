# HAUZ frontend take-home

A TanStack Start app plus the Appwrite Function you will call from it.
Read `TASK.md` for what to build. This file is only about getting it running.

## What you need

- Node 22 or newer
- A free Appwrite Cloud account at https://cloud.appwrite.io

## Setup

Budget 20 minutes. If you get stuck for longer than that, email us instead of
grinding on it. Setup friction is not what we are testing.

### 1. Install dependencies

```bash
npm install
```

### 2. Create an Appwrite project

In the Appwrite Console, create a new project. From **Overview**, copy the
**Project ID** and the **API Endpoint**. The endpoint is region specific, for
example `https://fra.cloud.appwrite.io/v1`.

Put both into `appwrite.config.json`, replacing `REPLACE_WITH_YOUR_PROJECT_ID`
and the `endpoint` if your region differs.

### 3. Push the database, table and Function

```bash
npx appwrite login
npm run appwrite:push
```

That creates the `main` database, the `personal_accounts` table with its unique
index, and deploys the `personal-account` Function. The first deployment takes a
minute or two while Appwrite builds it.

Confirm it worked: the Function should appear in the Console under **Functions**
with a ready deployment, and its **Execute access** should be `users`.

One warning about that command. `appwrite push table` treats
`appwrite.config.json` as the full picture of your schema and deletes tables in
the project that are not in it. On the fresh project you just made there is
nothing to delete, so it is safe here. Do not run it against a project that has
other tables in it.

### 4. Create an API key

Console, **Overview**, **Integrations**, **API keys**, **Create API key**.

Give it these scopes:

- `sessions.write`
- `users.read`
- `users.write`
- `execution.write`

Copy the secret once. You cannot read it again.

### 5. Fill in your environment

```bash
cp .env.example .env
```

Fill in `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID` and `APPWRITE_API_KEY`.
`.env` is git-ignored. Do not commit it.

### 6. Run it

```bash
npm run dev
```

http://localhost:3000

## What is in here

The app implements email-code sign-in, SSR-resolved current-user/session
state (correct on first paint, including after a hard refresh), Personal
Account onboarding, profile view/edit, and logout. Profile data goes only
through the `personal-account` Appwrite Function; the browser never talks to
Appwrite directly.

```
src/
  router.tsx                   router and query client setup
  routes/__root.tsx             document shell, session bootstrap, header
  routes/index.tsx              home page
  routes/sign-in.tsx            email-code sign-in (request + verify)
  routes/onboarding.tsx         Personal Account creation
  routes/profile.tsx            Personal Account view/edit
  lib/appwrite/                 server-side Appwrite clients, session cookie,
                                 and the server functions each route calls
functions/personal-account/   the Function, already written
appwrite.config.json          database, table and Function definitions
```

Main routes:

- `/` — home
- `/sign-in` — email-code sign-in
- `/onboarding` — first sign-in; creates the Personal Account
- `/profile` — view and edit the Personal Account (signed-in only)

Other scripts:

```bash
npm run build             production build
npm run typecheck         tsc --noEmit
npm run generate-routes   regenerate src/routeTree.gen.ts from src/routes
npm run appwrite          the Appwrite CLI, scoped to this project's config
```

## The Function

One Appwrite Function with three routes. It is deployed with **Execute access:
users**, which means a signed-in Appwrite user can execute it and a guest
cannot.

| Route | Body | Result |
|---|---|---|
| `GET /personal-account` | | `200` with the account, `404` if the caller has none |
| `POST /personal-account` | `firstName`, `lastName`, `role` | `201` created, `200` if it already exists, `409` if it exists with a different role |
| `PATCH /personal-account` | any of `firstName`, `lastName`, `contactEmail`, `bio` | `200` with the updated account |

`role` is either `property_owner` or `realtor`.

On `PATCH`, a field you leave out keeps its stored value and `null` clears it.
Every route answers `401` when the execution has no signed-in Appwrite user.

Errors come back as `{ "error": "<code>", "message": "...", "issues": [...] }`.
Codes you may see: `unauthorized`, `not_found`, `invalid_request`,
`personal_account_inconsistent`, `internal_error`.

You can read the source under `functions/personal-account/src/`. You may change
it if you need to, but say why in `NOTES.md`.

## Email codes

Appwrite Cloud sends the sign-in codes from its own mail server on the free
plan. Check your spam folder. If nothing arrives after a few minutes, Cloud may
be rate limiting you, so wait and retry rather than clicking send repeatedly.
