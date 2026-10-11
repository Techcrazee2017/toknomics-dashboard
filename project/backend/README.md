# TokNomics ingestion backend

```
dashboard ──upsert──▶ tracked_targets ──realtime──▶ worker ──wss──▶ Euler Stream
   ▲                                                  │
   └──── realtime ◀── stream_status, gift_transactions ◀┘ (service role)
```

## Run

```
npm i
cp .env.example .env        # fill in keys
npx supabase db push        # applies supabase/migrations/0001_tracking.sql
npm run verify              # closed-loop check against a dev project; exits 1 on any FAIL
npm run worker
```

## Files

- `supabase/migrations/0001_tracking.sql` — tables, RLS, column grants, realtime publication
- `src/worker.ts` — supervisor + one socket per tracked creator, backoff, close-code policy
- `src/euler.ts` — frame parser and gift → row mapping (shared with the verify script)
- `src/sink.ts` — buffered, idempotent `gift_transactions` writes
- `src/trackTargets.ts` — browser-side upsert/untrack + status subscription
- `scripts/verify-gift-pipeline.ts` — mock payload → insert → RLS scope checks → cleanup

## Close codes

From Euler's `ClientCloseCode` enum.

| Code | Name | Worker action |
| --- | --- | --- |
| 1000 | NORMAL | Stop |
| 4400 | INVALID_OPTIONS | Stop, status `invalid` (bad uniqueId) |
| 4555 | MAX_LIFETIME_EXCEEDED | Reconnect after 250ms, backoff reset (8h socket cap) |
| 4006 | NO_MESSAGES_TIMEOUT | Backoff from 1s |
| 4404 | NOT_LIVE | `offline`; retry ≥60s, up to 5 min |
| 4005 | STREAM_END | Same as 4404 |
| 4429 | TOO_MANY_CONNECTIONS | `backoff`; retry ≥30s |
| 4401 / 4403 | INVALID_AUTH / NO_PERMISSION | `auth_error`; retry every 10 min |
| 4500, 1011, 4556, 4557, 1006 | TikTok / server / fetch errors, drops | Full-jitter exponential, 1s → 30s cap; resets after 60s stable |

A socket with no frame or pong for 45s is terminated and goes through the same path.

## To confirm against a live room

- Frame envelope (`{ messages: [{ type, data }] }` assumed in `parseFrame`). Check against the SDK schemas or log one real frame.
- Gift field paths: `common.msgId`, `gift.diamondCount`, `gift.type`, `repeatEnd`.
- Room-info shape in the first frame (`roomIdOf` tries a few paths).
- Worker requests `SchemaVersion.v2` + `bundleEvents` via `createWebSocketUrl`; `parseFrame` assumes bundled frames arrive as `{ messages: [...] }` or an array. `syntheticPresence` is used in the browser JWT snippet only; add it to the worker if presence events are needed server-side. Events are typed with `WebcastGiftMessage` / `WebcastChatMessage` from `@eulerstream/euler-websocket-sdk/v2` (intersected with a loose record). Once a live frame confirms the field names, drop `& Loose` in `euler.ts` and let `tsc` flag any wrong paths. Also confirm whether the SDK accepts `apiKey` directly (the worker appends it otherwise). Pin the SDK version once confirmed.
