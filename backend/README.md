# TokNomics ingestion backend

```
dashboard ──upsert──▶ tracked_targets ──realtime──▶ worker ──wss──▶ Euler Stream
   ▲                                                  │
   └──── realtime ◀── stream_status, gift_transactions ◀┘ (service role)
```

## Run

See the root README. `npm run api`, `npm run worker`, `npm run verify`, `npm run fake-euler`.

## Files

- `src/api/` — Hono API server: auth/role middleware, Euler connection + OAuth, tool proxy, gift sync, chat JWT, team, Stripe
- `src/worker.ts` — supervisor + one socket per tracked creator/opponent, per-agency API key, backoff, close-code policy
- `src/euler.ts` — v2 frame parser and gift → row mapping (shared with the verify script)
- `src/sink.ts` — buffered, idempotent `gift_transactions` writes
- `src/crypto.ts` — AES-256-GCM sealing of credentials
- `scripts/verify-gift-pipeline.ts` — mock payload → insert → RLS scope checks → cleanup
- `scripts/fake-euler.ts` — local Euler REST + WebSocket stand-in for development

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

## Confirmed from the SDK packages

Checked against `@eulerstream/euler-websocket-sdk@1.0.0` and `tiktok-live-proto@0.1.1`. With `bundleEvents`, frames are `{ timestamp, messages: [{ type, data }] }`. Gift fields are `common.msgId`, `giftDetails.diamondCount`, `giftDetails.giftType` and `repeatEnd`, all typed in v2. `createWebSocketUrl` accepts `apiKey` directly.

## Still to confirm against a live room

- The shape of the `roomInfo` frame. `roomIdOf` reads `id_str`/`id`, and also takes `common.roomId` from any event.
- The field names in the sensitive-word and banned-user list responses. The SDK types them loosely, so `src/api/euler.ts` reads several aliases.
