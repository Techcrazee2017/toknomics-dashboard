# TokNomics

Agency ledger and P&L for TikTok LIVE: every coin your gifter accounts send to your creators, against the commission those creators earn. It's built from the Claude Design handoff in `project/` (prototype: `project/TokNomics Dashboard.dc.html`; intent: `chats/`).

```
web (Vite/React) ──anon key + user JWT──▶ Supabase (Postgres + RLS + Realtime)
     │                                          ▲            ▲
     └──Bearer JWT──▶ backend/api (Hono) ───────┘            │ service role
                         │  Euler REST (per-agency key,      │
                         │  OAuth token / cookie, sealed)    │
                         ▼                                    │
                    Euler Stream ◀──wss── backend/worker ────┘
```

| Path | What |
| --- | --- |
| `web/` | The dashboard: 8 screens, creator drawer, moderation drawer, dialogs, all on the Nocturne CSS (`web/src/styles/nocturne.css` is a verbatim copy of the design system). |
| `backend/src/api/` | API server. It's the only holder of Euler credentials: it proxies the 19 Euler tools, runs the OAuth and cookie connect flows, mints 60s chat JWTs, sends team invites and handles Stripe billing. |
| `backend/src/worker.ts` | Ingestion. It opens one Euler WebSocket per tracked creator (including battle opponents), books gifts, and records viewers and socket state. |
| `shared/` | zod contracts and constants used by both sides (tool schemas, plans, purposes, close codes). |
| `supabase/migrations/` | Schema, RLS, column grants, stats RPCs. `supabase/tests/` has the RLS/RPC assertion suite. |

## Run locally

```bash
npm install
npx supabase start                        # local stack; applies supabase/migrations
cp backend/.env.example backend/.env       # fill from `npx supabase status`; CREDENTIALS_KEY=$(openssl rand -base64 32)
cp web/.env.example web/.env.local
npm run dev:api & npm run dev:worker & npm run dev:web
```

**No Euler account?** Run `npm run fake-euler -w backend`. Then set `EULER_API_BASE=http://127.0.0.1:8799`, `EULER_WS_URL=ws://127.0.0.1:8799` and `EULER_OAUTH_AUTHORIZE_URL=http://127.0.0.1:8799/oauth/authorize` (plus any client id and secret) in `backend/.env`. It serves the same REST paths and v2 WebSocket frames as the real service, with gifts, streaks, chat and viewer counts. Handles containing `off` are never live.

First run: sign in with a magic link (local emails are at http://127.0.0.1:54324), then create your agency. Then go to **Data source**:

1. Paste the API key and authorize.
2. Add your **gifter accounts**. A gift only reaches the ledger when its sender is one of these accounts.
3. Resync the gift catalog.

After that, add creators on **Creator roster**.

## Tests

```bash
npm run typecheck && npm test               # shared 5, backend 28, web 6
PGHOST=… PGPORT=… PGUSER=postgres npm run test:db   # 26 RLS/RPC assertions on plain Postgres
npm run verify -w backend                   # 16-step closed loop against a Supabase project (dev/staging only)
```

## How the numbers work

- **Coins** for a gift = the gift's coin price × repeat count. Streak ticks are skipped and only `repeatEnd` is booked.
- **Agency burn** = coins sent by the agency's gifter accounts × the coin rate (USD).
- **Creator diamonds** = coins of *all* gifts the creator received while tracked. TikTok credits one diamond per coin.
- **Commission** = diamonds × the diamond rate (USD) × the agency cut. **Net** = commission − burn.

Rates and the cut are per agency (Data source → Ledger, Founders only). Income is only counted while a creator is tracked, so creators that aren't tracked show no commission.

## Roles

| | Founder | Manager | Moderator |
|---|---|---|---|
| Ledger, P&L, rankings | ✓ | ✓ | ✓ |
| Tag gift purposes, moderate rooms | ✓ | ✓ | ✓ |
| Roster, live targets, gifter accounts, catalog sync | ✓ | ✓ | |
| API key, cookie mode, connect/disconnect, rates, team, billing | ✓ | | |

RLS enforces the same rules (`supabase/migrations/0002_app.sql`). Team scope sets a member's default roster filter. Data access is per agency, not per team.

## Deploy

The app is two deployables, because the ingestion worker holds persistent Euler WebSockets and can't run serverless.

- **Web → Vercel.** Import the repo with the root directory left at the repo root; `vercel.json` sets the install, build, output dir and SPA rewrites. Set `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` and `VITE_API_URL` (the API's public URL) for Production and Preview. They're inlined at build time, so redeploy after changing them.
- **API + worker → Railway.** Create a service from this repo; `railway.json` sets the builder (Railpack, Node from `.nvmrc`), a backend typecheck as the build step, the start command (the API and the worker in one process), the `/api/health/live` check, an always-restart policy, one replica and no sleeping. Run exactly one replica: the worker holds persistent Euler sockets, and a host that sleeps idle services drops them. Set the vars from `backend/.env.example` as service variables. Set `WEB_ORIGIN` to the web app's URL (CORS allows exactly that origin) and `API_PUBLIC_URL` to the API's own URL. Turn on **Wait for CI** so a red build never deploys. Point an uptime monitor at `/api/health/ready`: it returns 503 when the database is unreachable or the worker has not reconciled in two minutes, and reports socket usage. Elsewhere (Render, Fly.io, a VM): `npm ci`, then `npm start -w backend`.
- **Supabase Auth.** Add the Vercel URL to Site URL / Redirect URLs, or magic links will bounce.
- **Database.** `npx supabase link --project-ref <ref>` once, then `npx supabase db push` applies new files in `supabase/migrations/`. Apply a migration before deploying code that needs it.

## Production notes

- **Euler OAuth.** Register `$API_PUBLIC_URL/api/euler/oauth/callback` and set `EULER_OAUTH_AUTHORIZE_URL` from your Euler OAuth app. Euler's SDK doesn't publish the authorize URL. A pinned user ID is passed as `login_user_id`.
- **Stripe.** Create three prices (`STRIPE_PRICE_*`) and point a webhook at `/api/stripe/webhook` with these events: `checkout.session.completed` and `customer.subscription.*`. The webhook is the only writer of `agencies.plan`. The roster limit is enforced by a DB trigger, and seats by the invite endpoint.
- **`CREDENTIALS_KEY`** encrypts Euler keys, cookies and tokens (AES-256-GCM, bound to the agency id). If you lose it, Founders have to re-enter their credentials.
- **Grants are explicit.** Hosted Supabase gives new tables no data privileges for the API roles, and `0003_baseline.sql` turns off PUBLIC execute for new functions. A migration that adds a table or RPC must grant it (the service role gets table privileges by default). `supabase/tests/20_baseline.sql` pins the expected matrix.
- **Run one worker.** Several replicas would open duplicate sockets. Inserts are idempotent on `(agency_id, msg_id)`, but you'd double your Euler socket usage.
