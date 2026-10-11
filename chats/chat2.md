# Backend integration for live streams

_Started 2026-10-11 04:05 UTC_

---

## User

Continuing from "TikTok MCP server configuration".

## Assistant

We've been building a comprehensive TikTok agency dashboard (TokNomics) on the Nocturne design system, with live gifting, creator management, and moderation tools, integrated with Euler Stream for data ingestion.

The dashboard now has nine screens: Agency overview (Total Burn, Net Revenue, Top Supported), Gifting ledger, Creator roster with P&L cards, Live battle monitor (Rankings and Discover live), Team/workspace roles, Data source (with setup, SDK snippets in five languages, backend connector examples, and live WebSocket status), Plan & billing, Room moderation (with live chat, mute/kick actions, sensitive-word filtering), and Gift catalog sync.

Key decisions made: OAuth defaults on Data source; Cookie mode and API management restricted to Founders; Managers see locked controls. Circuit texture sits at 7% opacity behind all screens, shifted to purple. Live feed, filters, Coins/Diamonds/USD toggle, creator drill-down, add-target dialog, and CSV export all work. Moderation actions use numeric TikTok IDs; a backend is needed to keep the API key out of the browser. Close codes (4404 NOT_LIVE, 4005 session end, 4555 reconnect, 4429 rate-limit, 4401/4403 token issues) trigger specific dashboard behaviors. Hosted WebSocket (`wss://ws.eulerstream.com`) is default; Frontend JWT mints 60-second tokens for one creator per socket.

Current state: Dashboard loads without errors. All Euler features are simulated. Setup steps appear when disconnected or key is empty. Backend snippets cover `tiktok-live-api-sdk` (TypeScript/Python/C#/Java/Go), `tiktok-live-connector` with chat and gift listeners (v2.5.0), and hosted WebSocket with JWT token refresh. All numbers are invented; real API key was rotated.

Open: Confirm WebSocket sends JSON; check close-code behaviors match your backend plan; test `data.common?.msgId` for chat against live room; validate Euler sign-up domain.

Files: TokNomics Dashboard.dc.html

## User

Focus on completing these backend integration steps:

Verify the WebSocket Client Implementation: Have Claude review or generate the persistent connection loop (typically in worker.ts) that connects to wss://ws.eulerstream.com?uniqueId=${uniqueId}&apiKey=${process.env.EULER_API_KEY}. Ensure it includes automatic reconnection logic (exponential backoff) if the socket drops during a live battle.

Test the Database Write Pipeline: Instruct Claude to write a closed-loop verification script that simulates a mock Euler Stream gift payload and confirms it successfully inserts into your Supabase gift_transactions table without triggering Row Level Security (RLS) violations (verifying that the backend worker correctly uses the service role key internally while the frontend respects standard user scopes).

Map Roster Sync via tracked_targets: Ensure Claude builds out the logic so that whenever an agency adds a creator or clicks to pin a live room in the dashboard, their TikTok unique ID is immediately upserted into the tracked_targets table, signaling the background worker to tune into that specific live stream feed.

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: grep]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: write_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

The backend code is written in `backend/` and the dashboard's Track and stop-tracking actions are wired to it, but none of it has been run yet. I had no Supabase project or Euler key to test against, and the dashboard still simulates the save unless the real app connects it.

**WebSocket worker (`src/worker.ts`)**
- Opens one socket per creator using your URL format. If several agencies track the same creator, it shares one socket and saves each gift once per agency. The API key is hidden in logs.
- If a socket drops during a battle, it retries after a short random delay that grows from about 1s to 30s at most. The delay goes back to the start once a connection has stayed up for 60s.
- It treats a socket as dead if nothing arrives for 45s, then reconnects.
- Close codes:
  - **4555:** reconnects right away.
  - **4404 / 4005 (offline or stream ended):** checks again after 60s, up to every 5 min.
  - **4429 (rate limit):** waits at least 30s.
  - **4401 / 4403 (bad key):** logs an error and retries every 10 min.
- Gifts are saved in batches. A failed batch is retried rather than dropped, and duplicates from reconnects are ignored.
- On start, it refuses to run if it was given a public key instead of the service role key. That mistake is the usual cause of security-rule failures on insert.

**Database test (`npm run verify`)**
- Creates two test agencies and two test users, then sends a fake Euler gift message through the same parsing and saving code the worker uses.
- Checks:
  - Only the final message of a gift combo is recorded.
  - The worker's key can insert into `gift_transactions` without a security-rule error.
  - Sending the same message twice doesn't create duplicates.
  - Public and logged-in browser users can't insert gifts.
  - Each agency only sees its own gifts and targets.
  - A manager can't add a target to another agency.
- It deletes its test data at the end and exits with an error if any check fails. Run it against a dev or staging project, not production.

**Tracking sync (`src/trackTargets.ts`)**
- Adding a target, or clicking Track in Discover or Rankings, saves the creator's TikTok ID to `tracked_targets`. The worker picks the change up within about a second, with a check every 30s as a backup.
- Stop tracking marks the row inactive and keeps the gift history. The worker closes the socket once no agency is tracking that creator.
- Target cards now show the save status, with a Retry button if it fails.
- The dashboard has no "add creator to roster" button yet. The same function handles that case once the button exists.

**Database setup (`supabase/migrations/0001_tracking.sql`)**
- Creates the tables and access rules: Founders and Managers can add or edit targets, and only the worker can write gifts and stream status.
- A target's agency and TikTok ID can't be changed after it's created.

**Still to confirm against a live room** (also listed in `backend/README.md`)
- The shape of Euler's WebSocket messages, and the gift field names (message ID, diamond count, gift type, combo end). The parser accepts several likely formats, but logging one real message will settle it.
- Whether Euler accepts the API key in a header, so it can come out of the URL.

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Form design priorities"
What `list_files` on the project root returns right now (dotfiles, if any, are not shown here):
📁 _ds
📁 _template
📁 assets
📁 backend
📁 scraps
📁 uploads
📄 deck-stage.js
📄 ds-base.js
📄 image-slot.js
📄 support.js
📄 TokNomics Dashboard.dc.html
Current date is now October 11, 2026
</system-info>

<pasted_text name="Pasted text (161 lines)">

We offer a production-grade TikTok LIVE WebSocket server at `wss://ws.eulerstream.com`.
This is the most scalable, stable, and simple way to connect to a TikTok LIVE. Scaling TikTok LIVE connections is
hard, so let us do it for you.

Embed a WebSocket client anywhere in 2 minutes tops. No library needed. Combine with JWTs and embed directly into your frontend.

### Backend Connections

On a secure backend, use your API Key directly. In Node.JS it's literally 2 lines:

```ts
import WebSocket from 'ws';
const ws = new WebSocket(`wss://ws.eulerstream.com?uniqueId=tv_asahi_news&amp;apiKey=${process.env.EULER_API_KEY}`);
```

There's...nothing else to it. Tutorial over.

### Frontend Connections

If you have a client-facing app, you shouldn't be exposing your API Key. Instead, you should use a JSON Web Token to authenticate the connection.

From your backend API, create a JWT for your user, return it to them on the front-end, and they can connect to the WebSocket server with it.

#### Step 1: Provision a JWT in your backend

For simplicity, I've installed the [`Euler API SDK`](https://www.npmjs.com/package/tiktok-live-api-sdk) so it's even easier to integrate.

```ts
  public async createJwt(
      uniqueId: string
  ) {

    const createJwtResponse = await this.sdk.authentication.createJWT(Config.SignServer.ACCOUNT_ID, {
      expireAfter: 60, // Short lifetimes are preferred. Users should provision a JWT for each connection, ideally
      websockets: {
        allowedCreators: [uniqueId as string], // Limit the user to the uniqueId they provided so they can't use your JWT to connect to other users
        maxWebSockets: 1 // Limit the user to 1 connection so that they don't eat up your account's concurrent connections
      }
    });

    return createJwtResponse.data.token;
  }
```

Return that to the client from your backend API.

#### Step 2: Connect to the WebSocket server

```ts
const jwtKey = "JWT_KEY"
const uniqueId = "tv_asahi_news";
const ws = new WebSocket(`wss://ws.eulerstream.com?uniqueId=${uniqueId}&amp;jwtKey=${jwtKey}`);
```

Again, that's it. You can implement this in 2 minutes.

### WebSocket SDK Definitions

The [WebSocket SDK](https://github.com/EulerStream/Euler-WebSocket-SDK) is a wrapper for types around the WebSocket server.

It is compatible with **both** NodeJS and Browser runtimes.

It can be installed into your project with `npm i @eulerstream/euler-websocket-sdk`.

### Types for Non-JavaScript Clients

For users not in JS/TS where an SDK is available, visit the following for the types returned by the server:

https://github.com/EulerStream/Euler-WebSocket-SDK/tree/master/src/webcast/schemas

### Bonus: TypeScript Types in browser

If you're working with a TypeScript, you can install `tiktok-live-connector` as a dev-dependency for the TikTok LIVE types.
The WebSocket server is 1:1 with the library's types, so you can just drop them in.

### Bonus 1: Out-of-the-box Room Info

Room info is sent in the first message of the WebSocket connection. Use this to get info like the user's profile picture,
room ID, and more. This comes out-of-the-box with no extra work.

### Bonus 2: Access Stream Video

If you want to serve the TikTok LIVE stream video, you can do so with our video endpoint.

Just call `/webcast/room_video` with the uniqueId of the user, and it will return stream video data.

## WebSocket Close Codes

The following are the WebSocket close codes that you may encounter when using the EulerStream WebSocket server:

```ts
export enum ClientCloseCode {

  /**
   * Responding to a client's close request normally
   */
  NORMAL = 1000,

  /**
   * Error updating presence on connect, or upstream error on connect in the proxy.
   */
  INTERNAL_SERVER_ERROR = 1011,

  /**
   * Error fetching the /webcast/fetch endpoint for the socket
   */
  WEBCAST_FETCH_ERROR = 4556,

  /**
   * Error fetching the /webcast/room_info endpoint for the socket
   */
  ROOM_INFO_FETCH_ERROR = 4557,

  /**
   * TikTok closed the connected unexpectedly.
   */
  TIKTOK_CLOSED_CONNECTION = 4500,

  /**
   * The account has too many connections OR is connecting too quickly.
   */
  TOO_MANY_CONNECTIONS = 4429,

  /**
   * The client provided invalid context, such as an invalid uniqueId or JWT key.
   */
  INVALID_OPTIONS = 4400,

  /**
   * The requested streamer is not live.
   */
  NOT_LIVE = 4404,

  /**
   * The TikTok stream ended.
   */
  STREAM_END = 4005,

  /**
   * There were no messages in the timeout period, the WebSocket was assumed dead and closed.
   */
  NO_MESSAGES_TIMEOUT = 4006,

  /**
   * Invalid Auth
   */
  INVALID_AUTH = 4401,

  /**
   * Accessing a creator the JWT has no access to
   */
  NO_PERMISSION = 4403,

  /**
   * WebSocket exceeded 8 hour lifetime
   */
  MAX_LIFETIME_EXCEEDED = 4555,

}
```
</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Modernist (design system)">
[Design System] This project uses the **Modernist** design system. This is a binding choice for visual style — every visual must follow it. Don't invent colors, type, spacing, or components not grounded here.

Scope: the design system is a visual style reference only. Its guide may describe example products, brands, or people that are unrelated to the user and unrelated to the subject of this conversation. Never treat anything in the design system as a fact about the user, their work, or the topic they asked about.

This project has the **Modernist_modern** design system bound at `_ds/modernist-b3a902ce-9811-415e-b220-5b216b55e9f8/`. If anything under that path is missing or fails to load, the folder name may differ — `list_files` `_ds/` and use the folder whose name ends with b3a902ce-9811-415e-b220-5b216b55e9f8 instead, including in the <link>/<script> paths below.

**Loading the bundle is how you use this design system.** Every Design Component you build must load `_ds/modernist-b3a902ce-9811-415e-b220-5b216b55e9f8/_ds_bundle.js` in `<helmet>` (include it in child DCs too — de-duped by URL) and compose with its components — do not recreate those components from scratch or restyle raw HTML to look like them. At the top of the template:

```html
<helmet>
  <link rel="stylesheet" href="_ds/modernist-b3a902ce-9811-415e-b220-5b216b55e9f8/styles.css">
  <script src="_ds/modernist-b3a902ce-9811-415e-b220-5b216b55e9f8/_ds_bundle.js"></script>
</helmet>
```

Then mount any component directly in the template — no logic class needed:

```html
<x-import component-from-global-scope="Modernist_modern.Button" hint-size="auto,40px">Label</x-import>
```

Props are template attributes (kebab → camelCase); template children pass through as `props.children`. The linked stylesheet(s) carry the design tokens (colors, type, spacing) — style against those via `var(--*)` and the design system's classes rather than guessing values.

**Start from a template if one matches.** Before building from scratch, check whether a template below matches the user's request. Read the template (list its folder, `read_file` the entry) and decide: if it's close to what's asked, `copy_files` the folder as your starting point; if you'd rather re-author in DC, `dc_write` a new page using the template as your structural reference. When this design system is bound, `copy_files` repoints the copied `ds-base.js` automatically — only edit its base line yourself if the copy result says so, or when copying from an unbound project (change `'../..'` to your `_ds/modernist-b3a902ce-9811-415e-b220-5b216b55e9f8` path). (Older templates have no `ds-base.js` and carry `../../…` bundle/stylesheet refs in their pages instead — repoint those by hand.)

- `Deck` (`/projects/b3a902ce-9811-415e-b220-5b216b55e9f8/templates/deck/`) — A twenty-one-slide presentation starter: cover, contents, dividers, columns, quadrants, a data table, SVG charts and timeline, bleed imagery, a quote and a close, on the theme's tokens
- `Landing` (`/projects/b3a902ce-9811-415e-b220-5b216b55e9f8/templates/landing/`) — A one-page product landing in the system's own voice — an invented product (Takt: Swiss-clockwork timetables), a ruled hero, stat row, feature rows, a grayscale photograph and a red poster close

The full design-system source tree lives at `/projects/b3a902ce-9811-415e-b220-5b216b55e9f8/` — use `list_files` / `read_file` from there for anything not under `_ds/` (layout varies by brand; don't assume folder names). Its guide is reproduced below so you don't need to fetch it:

<design-system-guide>
# Modernist design system

Modernist is flat, architectural and set entirely in Archivo: a near-mono red on white, a visible modular grid, zero corner radius and strong 2px rules. Nothing floats and nothing is decorated — alignment and the strength of the dividers do all the organising, labels sit flush left (even inside buttons), and photography prints in pure black and white.

## How to use this

- Link the one stylesheet from every page — `&lt;link rel="stylesheet" href="styles.css"&gt;` (adjust the relative path) — and take every color, font, spacing, radius and shadow from its variables (`var(--color-*)`, `var(--font-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)`). Never hard-code a hex, a font name or a px value the tokens already carry.
- Build with the classes below rather than inventing parallel ones; the component pages are plain HTML, so view source and copy the markup.
- `templates/` holds starting points a consuming project can copy whole.
- The whole system was derived from `theme.json`. To change the look, edit the tokens at the top of `styles.css` — every page, the thumbnail and this guide read from them — and keep `theme.json` and the written guidance in step so they don't drift from what the CSS actually does.

## Direction

Modular grid layouts — content in equal-width cells, strong horizontal and vertical rhythm, visible structure. Use strong 2px dividers (`var(--color-divider)`) between major sections. Button labels are flush left — a button wider than its label starts the text at the left padding edge (trailing icon and all), never centered. Wrap hero and inline images in the `.grayscale` class — they print in pure black and white.

## Color

A light ground (`--color-bg` #f3f2f2) with `--color-text` #201e1d and a single accent #ec3013 (this is a mono scheme: no second accent was chosen — the `--color-accent-2-*` variables carry a machine-derived stand-in kept only so both sets resolve; treat them as one role). Each role carries a 100–900 tonal ramp (`--color-neutral-100` … `--color-accent-2-900`) generated in OKLCH on a shared perceptual lightness scale, so the same step of any ramp has the same visual weight. Use the light steps (100–300) for tinted fills, hovers and subtle borders, 500 as the role's base, and the dark steps (700–900) for text on tinted fills and for pressed states; prefer ramp steps over ad-hoc `color-mix()`. For elevation use `--shadow-sm/md/lg` (already tuned to the ground) rather than ad-hoc box-shadows.

## Type

Archivo for headings over Archivo for body text, loaded as `--font-heading` / `--font-body`. Density 1.00× and radius 0px are already baked into the `--space-*` / `--radius-*` scales — use the variables, not raw numbers.

## Icons

Use Lucide icons (https://lucide.dev) throughout.

## Interaction states

Interactive states are themed, never browser defaults: give every interactive element a `:hover` tint and a pressed state from the accent ramp (one step past the base — `--color-accent-600` on a light ground, `--color-accent-400` on a dark one, or a `color-mix()` tint for outlined/ghost variants), and style keyboard focus with `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` — never leave the default blue focus ring.

## Components

| Class | What it is | Shown in |
| --- | --- | --- |
| `.btn` with `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-icon`, `.btn-block` | Actions — the primary is a solid accent fill | components/buttons.html |
| `.tag` with `.tag-accent`, `.tag-accent-2`, `.tag-neutral`, `.tag-outline` | Small labels tinted from the ramps (mono palette: accent-2 reads the same as accent) | components/buttons.html |
| `.field` + `label`, `.input`, `.radio` + `.dot`, `.seg` + `.seg-opt` | Form fields and choices on native elements — no script | components/forms.html |
| `.card` with `.card-kicker`, `.card-title`, `.card-body`, `.card-meta`; `.elev-sm/md/lg` | Surface-filled content cards; elevation utilities | components/cards.html |
| `.nav` + `.nav-brand` | The header bar | components/navigation.html |
| `.table` | Data tables with themed header and row rules | components/table.html |
| `.dialog-backdrop` + `.dialog` (+ `.dialog-title/-body/-actions`) | A modal at the top elevation | components/dialog.html |
| `.hr` | A strong 2px horizontal rule | foundations/layout.html |
| `.grayscale` | The image wrapper — every content photograph goes through it | foundations/image.html |

States are built in: hovers and pressed states come from the accent ramp, keyboard focus is the 2px accent `:focus-visible` ring, `::selection` is an accent tint, and disabled controls drop to 45% opacity. Don't restyle them per page. The accent-to-ground pair is tuned to at least 3:1 — enough for icons, large text and interface chrome, not for body copy — so for paragraph-size text in the accent use a deep ramp step (`--color-accent-700` on this ground) rather than the accent itself.

## Do

- Let the grid show: equal-width cells, strong horizontal rules between sections, visible structure.
- Keep everything flush left — headings, copy, and the labels inside wide buttons.
- Use the accent sparingly, for the primary action and small emphasis; the system is mostly ink on ground. The one place red runs as a field is the poster statement — the deck's section dividers and the landing's closing banner — where type stays display-grade and the accent carries the page.
- Print photographs in black and white with the `.grayscale` wrapper.

## Don't

- Do not round a corner anywhere — `--radius-md` is 0 on purpose.
- Do not center button labels or hero copy.
- Do not soften the rules into hairlines or drop them for whitespace.
- Do not tint or colorize imagery.

## Files

- `styles.css` — the only stylesheet: the token sheet (`:root` variables, ramps, base type) plus the component layer. Link it from every page.
- `readme.md` — this guide.
- `theme.json` — the parameters these files were derived from (a machine-readable record of the theme).
- `thumbnail.html` — the project cover (brand mark + swatches).
- `foundations/type.html` — the type scale and the heading/body pairing at real sizes.
- `foundations/color.html` — color roles and the 100-900 tonal ramps, with usage notes.
- `foundations/layout.html` — the spacing scale, the grid and how edges are drawn.
- `foundations/icons.html` — the icon set at interface sizes, inline and in buttons.
- `foundations/image.html` — how photographs and figures are treated.
- `components/buttons.html` — buttons, icon buttons and tags in every variant and state.
- `components/forms.html` — text fields, radios and the segmented control on native elements.
- `components/cards.html` — content cards and the elevation steps.
- `components/navigation.html` — the header bar pattern.
- `components/table.html` — a data table with the themed header and row rules.
- `components/dialog.html` — a modal over its backdrop at the top elevation.
- `theme.html` — the theme's parameters rendered as a reference sheet.
- `templates/landing/` — a starter page consuming the system the intended way (`index.html`, its `ds-base.js` loader, and the vendored `image-slot.js` its photograph mounts).
- `assets/photo.jpg` — the reference photograph the imagery page treats.

</design-system-guide>
</attached-skill>

<attached-skill name="Nocturne (design system)">
[Design System] This project uses the **Nocturne** design system. This is a binding choice for visual style — every visual must follow it. Don't invent colors, type, spacing, or components not grounded here.

Scope: the design system is a visual style reference only. Its guide may describe example products, brands, or people that are unrelated to the user and unrelated to the subject of this conversation. Never treat anything in the design system as a fact about the user, their work, or the topic they asked about.

This project has the **Nocturne_noctur** design system bound at `_ds/nocturne-7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf/`. If anything under that path is missing or fails to load, the folder name may differ — `list_files` `_ds/` and use the folder whose name ends with 7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf instead, including in the <link>/<script> paths below.

**Loading the bundle is how you use this design system.** Every Design Component you build must load `_ds/nocturne-7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf/_ds_bundle.js` in `<helmet>` (include it in child DCs too — de-duped by URL) and compose with its components — do not recreate those components from scratch or restyle raw HTML to look like them. At the top of the template:

```html
<helmet>
  <link rel="stylesheet" href="_ds/nocturne-7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf/styles.css">
  <script src="_ds/nocturne-7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf/_ds_bundle.js"></script>
</helmet>
```

Then mount any component directly in the template — no logic class needed:

```html
<x-import component-from-global-scope="Nocturne_noctur.Button" hint-size="auto,40px">Label</x-import>
```

Props are template attributes (kebab → camelCase); template children pass through as `props.children`. The linked stylesheet(s) carry the design tokens (colors, type, spacing) — style against those via `var(--*)` and the design system's classes rather than guessing values.

**Start from a template if one matches.** Before building from scratch, check whether a template below matches the user's request. Read the template (list its folder, `read_file` the entry) and decide: if it's close to what's asked, `copy_files` the folder as your starting point; if you'd rather re-author in DC, `dc_write` a new page using the template as your structural reference. When this design system is bound, `copy_files` repoints the copied `ds-base.js` automatically — only edit its base line yourself if the copy result says so, or when copying from an unbound project (change `'../..'` to your `_ds/nocturne-7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf` path). (Older templates have no `ds-base.js` and carry `../../…` bundle/stylesheet refs in their pages instead — repoint those by hand.)

- `Deck` (`/projects/7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf/templates/deck/`) — A twenty-one-slide presentation starter: cover, contents, dividers, columns, quadrants, a data table, SVG charts and timeline, bleed imagery, a quote and a close, on the theme's tokens
- `Landing` (`/projects/7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf/templates/landing/`) — A one-page product landing in the system's own voice — an invented product (Pounce: devtools for cats), a lit hero, stat band, feature rows, a blended photograph and a sign-up close

The full design-system source tree lives at `/projects/7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf/` — use `list_files` / `read_file` from there for anything not under `_ds/` (layout varies by brand; don't assume folder names). Its guide is reproduced below so you don't need to fetch it:

<design-system-guide>
# Nocturne design system

Nocturne is a quiet, compact dark interface: a near-neutral blue-grey ground, Inter at medium weight, soft 8px radii and an accent used as a line and a glow rather than a flood. Rules fade to transparent at their ends — over 48px a side — rather than stopping cleanly; short accent marks stay solid. Contrast comes from the tonal ramps, not from saturation, and photographs blend into the page with their dark values falling away.

## How to use this

- Link the one stylesheet from every page — `&lt;link rel="stylesheet" href="styles.css"&gt;` (adjust the relative path) — and take every color, font, spacing, radius and shadow from its variables (`var(--color-*)`, `var(--font-*)`, `var(--space-*)`, `var(--radius-*)`, `var(--shadow-*)`). Never hard-code a hex, a font name or a px value the tokens already carry.
- Build with the classes below rather than inventing parallel ones; the component pages are plain HTML, so view source and copy the markup.
- `templates/` holds starting points a consuming project can copy whole.
- The whole system was derived from `theme.json`. To change the look, edit the tokens at the top of `styles.css` — every page, the thumbnail and this guide read from them — and keep `theme.json` and the written guidance in step so they don't drift from what the CSS actually does.

## Direction

Left-aligned, asymmetric layouts. Flush-left headings; content hugs the left edge with whitespace on the right. Buttons are outlined (1px accent border on transparent), not solid-filled. In decks, section dividers lift to a saturated deep-indigo ground (the `--color-section` tokens — saturation as presence, at slide scale), and the landing template's one full-bleed stat band makes the same presence move at page scale; everywhere else grounds stay desaturated, with soft gradient depth rather than flat fills. Wrap hero and inline images in the `.lighten` class — `mix-blend-mode: lighten` blends them into whatever the page paints behind them: anything darker than the backdrop falls away, so on a dark page a black photo background disappears entirely. Prefer photographs shot on dark or black backgrounds.

## Color

A dark ground (`--color-bg` #161826) with `--color-text` #e9e9ed and a single accent #9184d9 — a blurple in the product's own Pro-accent hue, at the chroma that hue carries in the app, so the accent reads as an accent against the desaturated ramps (this is a mono scheme: no second accent was chosen — the `--color-accent-2-*` variables carry a machine-derived stand-in kept only so both sets resolve; treat them as one role). Each role carries a 100–900 tonal ramp (`--color-neutral-100` … `--color-accent-2-900`) generated in OKLCH on a shared perceptual lightness scale, so the same step of any ramp has the same visual weight. On this dark ground use the dark steps (700–900) for tinted fills, hovers and subtle borders, 500 as the role's base, and the light steps (100–300) for text on those tints and for pressed states; prefer ramp steps over ad-hoc `color-mix()`. For elevation use `--shadow-sm/md/lg` (already tuned to the ground) rather than ad-hoc box-shadows.

## Type

Inter for headings over Inter for body text, loaded as `--font-heading` / `--font-body`. Density 0.70× and radius 8px are already baked into the `--space-*` / `--radius-*` scales — use the variables, not raw numbers.

## Icons

Use Phosphor icons (https://phosphoricons.com) throughout.

## Interaction states

Interactive states are themed, never browser defaults: give every interactive element a `:hover` tint and a pressed state from the accent ramp (one step past the base — `--color-accent-600` on a light ground, `--color-accent-400` on a dark one, or a `color-mix()` tint for outlined/ghost variants), and style keyboard focus with `:focus-visible { outline: 2px solid var(--color-accent); outline-offset: 2px; }` — never leave the default blue focus ring.

## Components

| Class | What it is | Shown in |
| --- | --- | --- |
| `.btn` with `.btn-primary`, `.btn-secondary`, `.btn-ghost`, `.btn-icon`, `.btn-block` | Actions — the primary is an accent outline, never a fill | components/buttons.html |
| `.tag` with `.tag-accent`, `.tag-accent-2`, `.tag-neutral`, `.tag-outline` | Small labels tinted from the ramps (mono palette: accent-2 reads the same as accent) | components/buttons.html |
| `.field` + `label`, `.input`, `.radio` + `.dot`, `.seg` + `.seg-opt` | Form fields and choices on native elements — no script | components/forms.html |
| `.card` with `.card-kicker`, `.card-title`, `.card-body`, `.card-meta`; `.elev-sm/md/lg` | Surface-filled content cards; elevation utilities | components/cards.html |
| `.nav` + `.nav-brand` | The header bar | components/navigation.html |
| `.table` | Data tables with themed header and row rules | components/table.html |
| `.dialog-backdrop` + `.dialog` (+ `.dialog-title/-body/-actions`) | A modal at the top elevation | components/dialog.html |
| `.hr` | A horizontal rule — present, but this system prefers whitespace; avoid it | — |
| `.lighten` | The image wrapper — every content photograph goes through it | foundations/image.html |

States are built in: hovers and pressed states come from the accent ramp, keyboard focus is the 2px accent `:focus-visible` ring, `::selection` is an accent tint, and disabled controls drop to 45% opacity. Don't restyle them per page. The accent-to-ground pair is tuned to at least 3:1 — enough for icons, large text and interface chrome, not for body copy — so for paragraph-size text in the accent use a deep ramp step (`--color-accent-300` on this ground) rather than the accent itself.

## Do

- Keep chroma low outside the accent; lean on the `--color-neutral-*` steps for surfaces, borders and muted text.
- Use the compact spacing scale (density 0.7×) — this system is dense on purpose.
- Outline primary actions and let `:focus-visible` carry the accent.
- Put photographs through the `.lighten` wrapper and prefer subjects shot on dark backgrounds.

## Don't

- Do not flood large areas with the accent or any saturated fill — the exceptions are the deck section-divider ground and the landing template's stat band (both `--color-section`), saturated fields carried as presence (the accent carries its chroma in lines and marks, never as a flood).
- Do not use pure black or pure white — every value comes from the ramps. (Shade is the exception, as in the shadow tokens: ambient darkness mixed from black is a shadow, not a color.)
- Do not stack heavy shadows; on a dark ground elevation is an edge plus ambient darkness.
- Do not bolden headings past their 500 weight — hierarchy here is size and space.

## Files

- `styles.css` — the only stylesheet: the token sheet (`:root` variables, ramps, base type) plus the component layer. Link it from every page.
- `readme.md` — this guide.
- `theme.json` — the parameters these files were derived from (a machine-readable record of the theme).
- `thumbnail.html` — the project cover (brand mark + swatches).
- `foundations/type.html` — the type scale and the heading/body pairing at real sizes.
- `foundations/color.html` — color roles and the 100-900 tonal ramps, with usage notes.
- `foundations/layout.html` — the spacing scale, the grid and how edges are drawn.
- `foundations/icons.html` — the icon set at interface sizes, inline and in buttons.
- `foundations/image.html` — how photographs and figures are treated.
- `components/buttons.html` — buttons, icon buttons and tags in every variant and state.
- `components/forms.html` — text fields, radios and the segmented control on native elements.
- `components/cards.html` — content cards and the elevation steps.
- `components/navigation.html` — the header bar pattern.
- `components/table.html` — a data table with the themed header and row rules.
- `components/dialog.html` — a modal over its backdrop at the top elevation.
- `theme.html` — the theme's parameters rendered as a reference sheet.
- `templates/landing/` — a starter page consuming the system the intended way (`index.html`, its `ds-base.js` loader, and the vendored `image-slot.js` its photograph mounts).
- `assets/photo.jpg` — the reference photograph the imagery page treats.

</design-system-guide>
</attached-skill>

## Assistant

_[tool: grep]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

I updated the worker to handle every close code in the Euler docs you pasted. Nothing has been run yet. The dashboard's close-code table already listed all of these codes, so it didn't need changes.

- **4400 (invalid options):** the worker stops and marks the stream `invalid` instead of retrying, since a bad TikTok ID won't fix itself. I added that status to the database migration.
- **4555:** the docs say this means the socket hit its 8-hour limit. The worker still reconnects right away, and the comment now says why.
- **4006 (no messages), 4500, 1011, 4556 and 4557 (TikTok and server errors):** these are now named in the code and use the normal retry with growing delays.
- **Room ID:** the docs say room info arrives in the first message, so the worker now looks for the room ID in a few more places there.
- **Gift message format:** I pointed the parser at Euler's published message formats and their WebSocket type package. It's still unconfirmed until you log one real message.
- **README:** the close-code table now lists every code by name, and I dropped the open question about sending the key in a header, since the docs use the URL.

## User

import { createWebSocketUrl, SchemaVersion } from '@eulerstream/euler-websocket-sdk';

const url = createWebSocketUrl({
  uniqueId: '@someuser',
  features: { schemaVersion: SchemaVersion.v2 },
});

## Assistant

_[tool: grep]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

I switched the worker to build its socket address with Euler's `createWebSocketUrl` and to request schema v2 payloads. Nothing has been run against a live room yet.

- **Worker:** if the SDK's address doesn't already include the API key, the worker adds it. `EULER_WS_URL` is now an optional host override.
- **Package:** `@eulerstream/euler-websocket-sdk` is added at `latest`; pin it to a fixed version once it works.
- **Dashboard:** the hosted WebSocket snippet on Data source now shows the same SDK pattern.
- **Still to confirm** (also in the README):
  - The gift field names in v2 payloads may differ from what the gift parser currently reads.
  - Whether `createWebSocketUrl` accepts `apiKey` directly.

A design-system check flagged that the dashboard doesn't load the Modernist bundle. It's built on Nocturne, so I left it as is. Tell me if you meant to switch it to Modernist.

## User

import type { WebcastChatMessage, WebcastGiftMessage } from '@eulerstream/euler-websocket-sdk/v2';

## Assistant

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

I added the SDK's v2 types to `backend/src/euler.ts`, but I haven't compiled or run anything.

- Gift and chat events now use `WebcastGiftMessage` and `WebcastChatMessage`, and any other event type stays loosely typed.
- `isGift` and the new `isChat` now tell TypeScript which event type it's dealing with. `isChat` isn't called anywhere yet.
- The gift parser can still read older field names. I kept the types loose on purpose (`& Loose`) so those older field names still compile before we've seen a real v2 message.

Once a live message confirms the field names, remove `& Loose` and TypeScript will flag any wrong field paths. The README now covers this step.

## User

import { createWebSocketUrl, ClientCloseCode } from '@eulerstream/euler-websocket-sdk';

const url = createWebSocketUrl({
  uniqueId: '@someuser',
  jwtKey: process.env.EULER_JWT,
  features: {
    bundleEvents: true,
    syntheticPresence: true,
  },
});

const ws = new WebSocket(url);
ws.addEventListener('close', (e) => {
  if (e.code === ClientCloseCode.NOT_LIVE) console.log('streamer is offline');
});

## Assistant

_[tool: str_replace_edit]_

_[tool: read_file]_

_[tool: str_replace_edit]_

_[tool: str_replace_edit]_

_[tool: ready_for_verification]_

I added your SDK pattern to the worker and to the dashboard's Frontend JWT snippet. The dashboard loads without errors, but the worker hasn't been compiled or run against a live room yet.

- **Worker:** the close-code handling now uses the SDK's `ClientCloseCode` names instead of raw numbers, and behaves the same as before. It also turns on `bundleEvents`. I'm assuming bundled messages arrive as a `messages` list or a plain array, which the parser already handles; confirm this on the first live message.
- **`syntheticPresence`:** I only added it to the browser snippet, because I don't know what it sends and the worker only records gifts. Tell me if the backend should turn it on too.
- **Dashboard:** the Frontend JWT snippet on Data source now builds the address with `createWebSocketUrl` and `jwtKey`. It marks the creator offline on `NOT_LIVE` and gets a new token on `INVALID_AUTH` or `NO_PERMISSION`.

## User

export enum ClientCloseCode {
  // Standard
  NORMAL = 1000,
  INTERNAL_SERVER_ERROR = 1011,

  // Custom (4000–4999)
  STREAM_END = 4005,
  NO_MESSAGES_TIMEOUT = 4006,
  INVALID_OPTIONS = 4400,
  INVALID_AUTH = 4401,
  NO_PERMISSION = 4403,
  NOT_LIVE = 4404,
  TOO_MANY_CONNECTIONS = 4429,
  TIKTOK_CLOSED_CONNECTION = 4500,
  MAX_LIFETIME_EXCEEDED = 4555,
  WEBCAST_FETCH_ERROR = 4556,
  ROOM_INFO_FETCH_ERROR = 4557,
}

## Assistant

The enum you pasted lists the same 13 codes the worker and dashboard already handle, so nothing needed changing.

- **Worker:** 9 codes have their own handling: `NORMAL`, `INVALID_OPTIONS`, `MAX_LIFETIME_EXCEEDED`, `NO_MESSAGES_TIMEOUT`, `NOT_LIVE`, `STREAM_END`, `TOO_MANY_CONNECTIONS`, `INVALID_AUTH` and `NO_PERMISSION`. The other 4 (`INTERNAL_SERVER_ERROR`, `TIKTOK_CLOSED_CONNECTION`, `WEBCAST_FETCH_ERROR`, `ROOM_INFO_FETCH_ERROR`) use the default retry, starting at 1s and capped at 30s.
- **Dashboard:** the close-code table on Data source lists all 13 codes with the same names and numbers.

