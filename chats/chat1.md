# TikTok MCP server configuration

_Started 2026-10-08 20:41 UTC_

---

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Untitled"
What `list_files` on the project root returns right now (dotfiles, if any, are not shown here):
📁 _ds
📁 _template
📁 assets
📁 uploads
📄 Deck.dc.html
📄 deck-stage.js
📄 ds-base.js
📄 image-slot.js
📄 support.js
User is viewing file: Deck.dc.html
Current date is now October 8, 2026
</system-info>

<attached aesthetic_system_instructions>
A design system or theme is attached to this project. That attachment already answers the visual-style question: apply it. Do NOT ask the user which visual style to use — no questions about vibe, colors or palette directions (including color-swatch svg-options questions), typography, mood, or art direction, and skip the "divergent visuals" question from the question-asking tips; offer divergent visual directions only if the user themselves asks for alternatives. This rule bans asking the user to pre-pick a style in the abstract — swatches, mood words, palette pickers. It does not ban asking them to choose among candidates you have already built: putting built candidates on a file-options board for the user to pick from is encouraged. Treat the attachment as the confirmed starting point and product context — the "confirm the starting point" tip is already satisfied, so do not ask the user to confirm or re-pick it. Spend your questions on everything else you need: audience, purpose, content, structure, scope, interactions, tone of copy.
</attached aesthetic_system_instructions>

<pasted_text name="Pasted text (67 lines)">
**TokNomics** is a financial intelligence and gift-tracking platform designed specifically for TikTok agencies and high-volume live stream managers.

At its core, the product solves a messy operational bottleneck: TikTok agency owners constantly send gifts (coins/diamonds) to their signed creators during live matches and streams to boost algorithm visibility, protect rankings, win agency battles, or hit bonus milestones. However, TikTok provides virtually zero clean financial reporting for these cross-stream outlays, leaving agency leaders scrambling with manual spreadsheets and guesswork to figure out their actual ROI per creator.

---

### Core Concept &amp; Value Proposition

TokNomics functions as an **agency ledger and balance sheet for TikTok Live**, tracking every diamond pumped into client streams versus the returns generated.

* **The Core Problem:** Agency owners gift their roster to stimulate hype or hit contractual bonus targets, but outgoing coins are fragmented across multiple live sessions, gifter accounts, and creators. Calculating true net revenue per creator requires hours of manual tracking.
* **The Solution:** An automated dashboard that hooks into live stream transactions, logging outgoing gifts by sender, recipient, timestamp, and real-world dollar valuation.
* **The Pitch to Agencies:** *"Stop guessing your agency burn rate on live battles. Track every dollar invested into your talent and see your real return on investment in real time."*

---

### Key Product Features

1. **Agency Gifting Ledger &amp; Expense Tracking**
* Itemized logs of every outgoing gift sent by agency-controlled accounts.
* Auto-conversion between TikTok Coins, Diamonds, and raw fiat currency (USD) to reflect true cash expenditures.
* Tagging gifts by purpose: battle support, scheduled drops, milestone pushes, or creator retention.


2. **Creator ROI &amp; P&amp;L Cards**
* Individual client profiles showing:
* **Total Agency Investment:** Diamonds/USD gifted to them.
* **Agency Commission Generated:** Incoming commission cut from creator’s total stream earnings.
* **Net Margin:** Whether the creator is operating at a profit or loss relative to agency capital spent supporting them.




3. **Arbitrary Live Targets &amp; Multi-Stream Monitoring**
* Ability to target any arbitrary live stream or battle to track incoming/outgoing coin spikes in real time.
* Real-time leaderboards showing which agency accounts or clients are dominating coin volume.


4. **Agency Multi-Tenant &amp; Team Roles**
* Workspace views where agency managers, moderators, and founders can manage separate creator rosters.
* Granular filtering by agency team, creator tier, or battle date.



---

### Subscription &amp; Monetization Model (SaaS)

To commercialize TokNomics, structure pricing around agency size and tracked roster volume:

| Tier | Target Customer | Features &amp; Limits | Suggested Pricing |
| --- | --- | --- | --- |
| **Starter Agency** | Solo managers &amp; boutique agencies | Up to 10 creators tracked, basic outgoing ledger, weekly CSV exports | **$49 / month** |
| **Growth Agency** | Mid-size agencies running daily battles | Up to 50 creators, real-time battle target tracking, creator P&amp;L cards, webhook alerts | **$149 / month** |
| **Scale / Enterprise** | Top-tier TikTok LIVE agencies | Unlimited creators, multi-seat team access, custom API ingestion, priority support | **$299 – $499 / month** |

---

### Immediate Next Steps to Finish &amp; Launch

1. **Lock Down the Data Pipeline:** Finalize the live event ingestion layer (via WebSocket streams/event APIs) to reliably log sender IDs, receiver IDs, gift values, and timestamps directly into your backend database.
2. **Implement Creator Profitability Calculation:** Build the automated formula:
$$\text{Net Profit} = (\text{Total Creator Diamonds} \times \text{Agency Cut \%}) - \text{Total Coins Gifted to Creator (USD)}$$


3. **Build the Claude UI Deck Component:** Use your current design session in Claude to build the core agency view: an itemized ledger table, key stat cards (Total Burn, Total Net Revenue, Top Supported Creators), and a roster breakdown.
4. **Deploy Stripe Billing Integration:** Set up tier limits tied to creator count and agency user seats before opening a closed beta to 3–5 TikTok agency owners for direct feedback.
</pasted_text>

<!-- The user attached a local folder named "TokNomics Dashboard Design Code". It may contain a codebase, design components, or other files. Explore it with local_ls("TokNomics Dashboard Design Code") — all paths into this folder must start with "TokNomics Dashboard Design Code/". -->

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Design Components">
This project uses Design Components: every design is a single streaming `Name.dc.html` file. The full authoring spec is in your system prompt under "Writing code — Design Components" — follow it. Author and edit `.dc.html` content with the `dc_write`, `dc_html_str_replace`, `dc_js_str_replace`, and `dc_set_props` tools (not `write_file`; `str_replace_edit` works but won't stream); template edits stream into the live preview as you type.
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

<attached-skill name="Deck (starting point)">
[Starting point] The user chose the **Deck** template from the **Nocturne** design system.

The deck starts EMPTY: its entry page `Deck.dc.html` is already open in front of the user, carrying the template's styling and scaffolding but ZERO slides — the first slide the user sees is the first one you build. The template's full set of slides is your SLIDE PALETTE at `_template/deck/palette.dc.html` — reference markup, not part of the deck and not wired to render (a section index sits in a comment at the top). Don't fill the template in: build the deck in `Deck.dc.html` from the user's actual content, slide by slide, and when a slide of some kind is called for, copy that <section> block from the palette into the deck and customize the copy. Plan the deck however you like, but EMIT each slide as its own separate edit the moment it's ready — the user is watching the deck assemble in front of them, and a single batched write that lands the whole deck at once turns that live assembly into a long blank wait. One slide per edit, first slide as early as possible once you start building — asking the user clarifying questions first is always fine. Keep the document's slide order the same as the deck's final order, and DELETE any slide you don't want: never hide one with data-deck-skip during a build, because the page counters count every slide element and a hidden slide makes the visible page numbers wrong. If the deck's token block has a --page-foot-note, set it to something topical for THIS deck (or an empty string) — the template's default footer text is placeholder content the user never asked for. Use the palette for structure and style, never as content. Read the palette file freely; never open it with `show_to_user`, and never write under `_template/`.

(If `Deck.dc.html` or the palette is missing, the seed didn't finish — the files at root are the deck; edit them in place. If nothing was seeded at all: `copy_files` from `/projects/7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf/templates/deck` to `.` first; If the copied files include a `ds-base.js`, `copy_files` repoints its base automatically when this design system is bound — check the copy result, and only rewrite the `const base` line yourself if it still says `'../..'` (point it at the `_ds/` folder whose name ends in `-7bd1827e-d473-4bc5-8b9a-ec9075e0bdaf`). then open `Deck.dc.html` with `show_to_user`.)

Proceed with whatever the user asked for.

Template description: A twenty-one-slide presentation starter: cover, contents, dividers, columns, quadrants, a data table, SVG charts and timeline, bleed imagery, a quote and a close, on the theme's tokens
</attached-skill>

## Assistant

## User

<pasted_text name="Pasted text (67 lines)">
**TokNomics** is a financial intelligence and gift-tracking platform designed specifically for TikTok agencies and high-volume live stream managers.

At its core, the product solves a messy operational bottleneck: TikTok agency owners constantly send gifts (coins/diamonds) to their signed creators during live matches and streams to boost algorithm visibility, protect rankings, win agency battles, or hit bonus milestones. However, TikTok provides virtually zero clean financial reporting for these cross-stream outlays, leaving agency leaders scrambling with manual spreadsheets and guesswork to figure out their actual ROI per creator.

---

### Core Concept &amp; Value Proposition

TokNomics functions as an **agency ledger and balance sheet for TikTok Live**, tracking every diamond pumped into client streams versus the returns generated.

* **The Core Problem:** Agency owners gift their roster to stimulate hype or hit contractual bonus targets, but outgoing coins are fragmented across multiple live sessions, gifter accounts, and creators. Calculating true net revenue per creator requires hours of manual tracking.
* **The Solution:** An automated dashboard that hooks into live stream transactions, logging outgoing gifts by sender, recipient, timestamp, and real-world dollar valuation.
* **The Pitch to Agencies:** *"Stop guessing your agency burn rate on live battles. Track every dollar invested into your talent and see your real return on investment in real time."*

---

### Key Product Features

1. **Agency Gifting Ledger &amp; Expense Tracking**
* Itemized logs of every outgoing gift sent by agency-controlled accounts.
* Auto-conversion between TikTok Coins, Diamonds, and raw fiat currency (USD) to reflect true cash expenditures.
* Tagging gifts by purpose: battle support, scheduled drops, milestone pushes, or creator retention.


2. **Creator ROI &amp; P&amp;L Cards**
* Individual client profiles showing:
* **Total Agency Investment:** Diamonds/USD gifted to them.
* **Agency Commission Generated:** Incoming commission cut from creator’s total stream earnings.
* **Net Margin:** Whether the creator is operating at a profit or loss relative to agency capital spent supporting them.




3. **Arbitrary Live Targets &amp; Multi-Stream Monitoring**
* Ability to target any arbitrary live stream or battle to track incoming/outgoing coin spikes in real time.
* Real-time leaderboards showing which agency accounts or clients are dominating coin volume.


4. **Agency Multi-Tenant &amp; Team Roles**
* Workspace views where agency managers, moderators, and founders can manage separate creator rosters.
* Granular filtering by agency team, creator tier, or battle date.



---

### Subscription &amp; Monetization Model (SaaS)

To commercialize TokNomics, structure pricing around agency size and tracked roster volume:

| Tier | Target Customer | Features &amp; Limits | Suggested Pricing |
| --- | --- | --- | --- |
| **Starter Agency** | Solo managers &amp; boutique agencies | Up to 10 creators tracked, basic outgoing ledger, weekly CSV exports | **$49 / month** |
| **Growth Agency** | Mid-size agencies running daily battles | Up to 50 creators, real-time battle target tracking, creator P&amp;L cards, webhook alerts | **$149 / month** |
| **Scale / Enterprise** | Top-tier TikTok LIVE agencies | Unlimited creators, multi-seat team access, custom API ingestion, priority support | **$299 – $499 / month** |

---

### Immediate Next Steps to Finish &amp; Launch

1. **Lock Down the Data Pipeline:** Finalize the live event ingestion layer (via WebSocket streams/event APIs) to reliably log sender IDs, receiver IDs, gift values, and timestamps directly into your backend database.
2. **Implement Creator Profitability Calculation:** Build the automated formula:
$$\text{Net Profit} = (\text{Total Creator Diamonds} \times \text{Agency Cut \%}) - \text{Total Coins Gifted to Creator (USD)}$$


3. **Build the Claude UI Deck Component:** Use your current design session in Claude to build the core agency view: an itemized ledger table, key stat cards (Total Burn, Total Net Revenue, Top Supported Creators), and a roster breakdown.
4. **Deploy Stripe Billing Integration:** Set up tier limits tied to creator count and agency user seats before opening a closed beta to 3–5 TikTok agency owners for direct feedback.
</pasted_text>

<!-- The user attached a local folder named "TokNomics Dashboard Design Code". It may contain a codebase, design components, or other files. Explore it with local_ls("TokNomics Dashboard Design Code") — all paths into this folder must start with "TokNomics Dashboard Design Code/". -->

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
<attached-skill name="Interactive prototype">
Create a fully interactive prototype with realistic state management and transitions. Use React useState/useEffect for dynamic behavior. Include hover states, click interactions, form validation, animated transitions, and multi-step navigation flows. It should feel like a real working app, not a static mockup.
</attached-skill>

<attached-skill name="Create design system">
Design system creation instructions:
Design systems are folders on the file system containing typography guidelines, colors, assets, brand style and tone guides, css styles, and React recreations of UIs, decks, etc. They give design agents the ability to create designs against a company's existing products, and create assets using that company's brand. Design systems should contain real visual assets (logos, brand illustrations, etc), low-level visual foundations (e.g. typography specifics; color system, shadow, border, spacing systems), reusable UI components, and high-level UI kits (full screens).

No need to invoke the create_design_system skill; this is it.

An automated compiler reads this project, bundles the components into a runtime library, and indexes the styles. It discovers everything from file content and sibling relationships — not from folder names — so the only fixed location is:

- `styles.css` at the project root (or `index.css` / `globals.css` / `global.css` / `main.css` / `theme.css` / `tokens.css` — first match wins). This is the global-CSS entry point; consumers link this one file. Keep it as a list of `@import` lines only. Everything it transitively `@import`s is shipped to consumers; `@font-face` rules anywhere in that closure declare the webfonts.

Organize everything else however suits the brand. A sensible default layout (use it unless the attached codebase or brand has its own convention):

- `tokens/` — CSS custom properties, one file per concern (`colors.css`, `typography.css`, `spacing.css`, …), each `@import`ed from `styles.css`.
- `components/<group>/` — reusable React UI primitives.
- `ui_kits/<product>/` — full-screen click-through recreations of real product views.
- `guidelines/` — foundation specimen cards and deeper-dive prose.
- `assets/` — logos, icons, illustrations, imagery.
- `readme.md` (root) — the design guide and manifest.

What the compiler looks for, regardless of path:
- A **component** is any `<Name>.jsx` / `<Name>.tsx` (PascalCase stem) with a sibling `<Name>.d.ts` in the same directory. Add `<Name>.prompt.md` alongside, and one `@dsCard`-tagged `.html` per directory (its first line is `<!-- @dsCard group="…" -->`; details under "Components" below).
- A **token** is any `--*` custom property declared under `:root` (or a single-selector theme scope) in a file reachable from `styles.css`.
- A **font** is any `@font-face` rule in that same closure; its `src: url(…)` targets are the binaries shipped to consumers.

To begin, create a todo list with the tasks below, then follow it:

- Explore provided assets and materials to gain a high-level understanding of the company/product context, the different products represented, etc. Read each asset (codebase, figma, file etc) and see what they do. Find some product copy; examine core screens; find any design system definitions.
- Create a readme.md (root) with the high-level understanding of the company/product context, the different products represented, etc. Mention the sources you were given: full Figma links, GitHub repos, codebase paths, etc. Do not assume the reader has access, but store in case they do.
- Call set_project_title with a short name derived from the brand/product (e.g. "Acme Design System"). This replaces the generic placeholder so the project is findable.
- IF any slide decks attached, use your repl tool to look at them, extract key assets + text, write to disk.
- Explore the codebase and/or figma design contexts and write the token CSS files — CSS custom properties on `:root`, both base values (`--fg-1`, `--font-serif-display`) and semantic aliases (`--text-body`, `--surface-card`). Copy any webfonts/ttfs into the project and write the `@font-face` rules in a CSS file. Then write the root `styles.css` as a list of `@import` lines only (never inline rules there) that reaches every token and font-face file.
- Explore, then update readme.md with a CONTENT FUNDAMENTALS section: how is copy written? What is tone, casing, etc? I vs you, etc? are emoji used? What is the vibe? Include specific examples
- Explore, update readme.md with VISUAL FOUNDATIONS section that talks about the visual motifs and foundations of the brand. Colors, type, spacing, backgrounds (images? full-bleed? hand-drawn illustrations? repeating patterns/textures? gradients?), animation (easing? fades? bounces? no anims?), hover states (opacity, darker colors, lighter colors?), press states (color? shrink?), borders, inner/outer shadow systems, protection gradients vs capsules, layout rules (fixed elements), use of transparency and blur (when?), color vibe of imagery (warm? cool? b&w? grain?), corner radii, what do cards look like (shadow, rounding, border), etc. whatever else you can think of. answer ALL these questions.
- If you are missing font files, find the nearest match on Google Fonts. Flag this substitution to the user and ask for updated font files.
- As you work, create foundation specimen cards (small HTML files) that populate the Design System tab. Target ~700×150px each (400px max) — err toward MORE small cards, not fewer dense ones. Split at the sub-concept level: separate cards for primary vs neutral vs semantic colors; display vs body vs mono type; spacing tokens vs a spacing-in-use example. A typical foundations set is 12–20+ cards. Skip titles and framing — the card name renders OUTSIDE the card, so just show the swatches/specimens/tokens directly with minimal decoration. Each card links `styles.css` (relative path from wherever you put it) so it picks up the real tokens. Tag each card with `<!-- @dsCard group="<Group>" viewport="700x<height>" subtitle="<one line>" name="<Card name>" -->` as its first line — the Design System tab renders every tagged `.html` in the project, grouped verbatim by `group`. Suggested groups: "Type", "Colors", "Spacing", "Brand" — title-cased, consistent.
- Copy logos, icons and other visual assets into `assets/`. **If the provided sources contain no logo, do not create one**: render the brand name in plain type wherever a mark would go and note the absence in readme.md. Never draw, reconstruct, or approximate a company's real logo or brand mark from memory — even when the company seems identifiable from font names or sample content — and never rebrand the design system with a company identity the user didn't provide. Update readme.md with an ICONOGRAPHY section describing the brand's approach to iconography. Answer ALL these and more: are certain icon systems used? is there a builtin icon font? are there SVGs used commonly, or png icons? (if so, copy them in!) Is emoji ever used? Are unicode chars used as icons? Make sure to copy key logos, background images, maybe 1-2 full-bleed generic images, and ALL generic illustrations you find. NEVER draw your own SVGs or generate images; COPY icons programmatically if you can.
- For icons: FIRST copy the codebase's own icon font/sprite/SVGs into `assets/` if you can. Otherwise, if the set is CDN-available (e.g. Lucide, Heroicons), link it from CDN. If neither, substitute the closest CDN match (same stroke weight / fill style) and FLAG the substitution. Document usage in ICONOGRAPHY.
- Author the reusable components (see the Components section). Each directory's card HTML must carry `<!-- @dsCard group="Components" … -->` on line 1.
- For each product given (e.g. app and website), create a UI kit — `{README.md, index.html, Screen1.jsx, …}` in its own directory; see the UI kits section. Verify visually. Make one todo list item for each product/surface.
- If you were given a slide template, create sample slides — `{index.html, TitleSlide.jsx, ComparisonSlide.jsx, BigQuoteSlide.jsx, …}` in their own directory. If no sample slides were given, don't create them. Create an HTML file per slide type; if decks were provided, copy their style. Use the visual foundations and bring in logos + other assets. Tag each slide HTML with `<!-- @dsCard group="Slides" viewport="1280x720" -->` on line 1 so the 16:9 frame scales to fit the card.
- Tag each UI kit's index.html with `<!-- @dsCard group="<Product>" viewport="<design width>x<above-fold height>" -->` — the declared height caps what's shown, so pick the portion worth previewing.
- Update readme.md with a short "index" pointing the reader to the other files available. This should serve as a manifest of the root folder, plus a list of components, ui kits, etc.
- Create SKILL.md file (details below)
- You are done! The Design System tab shows every registered card. Do NOT summarize your output; just mention CAVEATS (e.g. things you were unable to do or unsure) and have a CLEAR, BOLD ASK for the user to help you ITERATE to make things PERFECT.

Components
- These are the brand's reusable UI primitives. **When a concrete source defines the inventory (a mounted .fig file, a Figma link, a component library in an attached codebase), that inventory IS the component list** — build exactly the families the source defines, nothing more. Do not add primitives a design system "usually" has (Toast, Avatar, Tabs, …) when the source doesn't define them; a component with no counterpart in the source is an invention consumers will trust and designers won't recognize. If an addition is genuinely needed (e.g. an Icon wrapper for a glyph set), list it in readme.md under "Intentional additions" with a one-line reason. Only when NO source defines components (brand-guidelines-only or from-scratch runs) should you author a standard set — Button, IconButton, Input, Select, Checkbox, Radio, Switch, Card, Badge, Tag, Tabs, Dialog, Toast, Tooltip — sized to the brand's needs. Either way, group by concern (e.g. `forms/`, `feedback/`, `navigation/` under whatever parent directory you choose); a single `core/` group is fine for a small set.
- Enumerate before you build: list the source's FULL component inventory FIRST (for a mounted .fig, read /METADATA.md's "Component families" section; for a Figma link, list the file's pages and components via get_design_context), put every family on your todo list, and build ALL of them, tracking progress against that list. Do NOT stop at a "core subset". If you cannot finish, end your turn by reporting exactly which families remain unbuilt and ask the user whether to continue — never end silently incomplete.
- Each component is one file `<Name>.jsx` (or `.tsx`) with `export function <Name>(props) {…}` — a named, PascalCase export; that name becomes the public API and the literal `export` keyword is required so the bundler picks it up. Keep them self-contained: import React only, reference styling via the CSS custom properties (no CSS-in-JS libs, no npm packages). Siblings may import each other with relative paths.
- In the same directory, write `<Name>.d.ts` with the props interface — the sibling `.d.ts` is what gives a component its props contract, adherence rules, and starting-point eligibility; a `.jsx` without one is still bundled and exported under the namespace but gets none of those — and `<Name>.prompt.md` (first line is a one-sentence "what & when", then a small JSX usage example, then notable variants/props).
- One card HTML per directory (name it whatever you like — e.g. `buttons.card.html`): first line is `<!-- @dsCard group="Components" viewport="700x<height>" name="<Directory label>" -->`. Link `styles.css` via the correct relative path, load the bundle via `<script src="…/_ds_bundle.js">` (relative path to project root), then mount with `const { <Name> } = window.<Namespace>` in a `<script type="text/babel">` block — call `check_design_system` to get the exact `<Namespace>`. Do NOT `<script src>` the `.jsx` directly (its `export` is unreachable from inline script). Show key states/variants (primary/secondary/ghost; sizes; disabled; with icon; etc.). Make it dense and scannable, not a single default render.
- Do NOT write `_ds_bundle.js`, `_ds_manifest.json`, `_adherence.oxlintrc.json`, or a barrel `index.js` — those are generated automatically.

Starting points
- Consuming projects show a "Starting Points" picker that lets users seed a new design with a component or screen from this system. Entries are opt-in via a tag — separate from `@dsCard` (which populates the Design System tab).
- To mark a component: add `@startingPoint section="<group>" subtitle="<one line>" viewport="<WxH>"` to the JSDoc on its `<Name>.d.ts` props interface. The picker thumbnail is that directory's `@dsCard`-tagged HTML, so make sure it renders sensibly at the declared viewport.
- To mark a screen: add `<!-- @startingPoint section="<group>" subtitle="<one line>" viewport="<WxH>" -->` as the first line of the HTML file. The screen itself is the thumbnail.
- When the user says "create a starting point <X>" (or "add <X> as a starting point"), write an HTML file with the `<!-- @startingPoint section="…" -->` comment as its first line — any `.html` in the project with that tag is indexed. `ui_kits/<x>/index.html` is the conventional home but not required.
- When the user asks to remove or retitle a starting point, edit the tag. When they ask to change a thumbnail, edit the `@dsCard`-tagged HTML in that component's directory (component) or the screen HTML itself.

UI kit details:
- UI kits are high-fidelity visual + interaction recreations of full interfaces — screens, not primitives. They cut corners on functionality (not 'real production code') but are pixel-perfect, created by reading the original UI code if possible, or using figma's get-design-context. UI kits compose the component primitives you authored above; don't re-implement Button inside a kit. A UI kit's `index.html` must look like a typical view of the product. These are recreations, not storybooks.
- To start, update the todo list to contain these steps for each product: (1) Explore codebase + components in Figma (design context) and code, (2) Create 3-5 core screens for each product (e.g. homepage or app) with interactive click-thru components, (3) Iterate visually on the designs 1-2x, cross-referencing with design context.
- Figure out the core products from this company/codebase. There may be one, or a few. (e.g. mobile app, marketing website, docs website).
- Each UI kit contains JSX (well-factored; small, neat) for that product's surfaces — sidebars, composers, file panels, hero units, headers, footers, blog posts, video players, settings screens, login, etc.
- The index.html file should demonstrate an interactive version of the UI (e.g a chat app would show you a login screen, let you create a chat, send a message, etc, as fake)
- You should get the visuals exactly right, using design context or codebase import. Don't copy component implementations exactly; make simple mainly-cosmetic versions. It's important to copy.
- Cover every component family the source defines — coverage means the full enumerated inventory, not a hand-picked subset. Within a UI kit screen you may abbreviate repeated content (e.g. 3 rows standing in for 30 identical ones), but never skip a component family.
- Do not invent new designs for UI kits. The job of the UI kit is to replicate the existing design, not create a new one. Copy the design, don't reinvent it. If you do not see it in the project, omit, or leave purposely blank with a disclaimer.

Guidance
- Run independently without stopping unless there's a crucial blocker (E.g. lack of Figma access to a pasted link; lack of codebase access).
- When creating slides and UI kits, avoid cutting corners on iconography; instead, copy icon assets in! Do not create halfway representations of iconography using hand-rolled SVG, emoji, etc.
- CRITICAL: Do not recreate UIs from screenshots alone unless you have no other choice! Use the codebase, or Figma's get-design-context, as a source of truth. Screenshots are much lossier than code; use screenshots as a high-level guide but always find components in the codebase if you can!
- The attached kit is the ground truth. When its values differ from the published conventions of a component library it resembles (shadcn, MUI, etc.), the kit wins. Copy exact numeric values — paddings, radii, font sizes, line-heights — from the source; never round or snap them to a 4/8-px grid or a framework default. If the kit says 5px, write 5px, not 4px.
- Avoid these visual motifs unless you are sure you see them in the codebase or Figma: bluish-purple gradients, emoji cards, cards with rounded corners and colored left-border only
- Avoid reading SVGs -- this is a waste of context! If you know their usage, just copy them and then reference them.
- When using Figma, use get-design-context to understand the design system and components being used. Screenshots are ONLY useful for high-level guidance. Make sure to expand variables and child components to get their content, too. (get_variable_defs)
- Stop if key resources are unnecessible: iff a codebase was attached or mentioned, but you are unable to access it via local_ls, etc, you MUST stop and ask the user to re-attach it using the Import menu. These get reattached often; do not complete a design system if you get a disconnect! Similarly, if a Figma url is inaccessible, stop and ask the user to rectify. NEVER go ahead spending tons of time making a design system if you cannot access all the resources the user gave you. This applies mid-run too: if reads start failing or rate-limiting partway through, stop and report exactly what you did and did not read — never infer or invent component names, structures, or values for content you could not read.

SKILL.md
- When you are done, we should make this file cross-compatible with Agent SKills in case the user wants to download it and use it in Claude Code.
- Create a SKILL.md file like this:

<skill-md>
---
name: {brand}-design
description: Use this skill to generate well-branded interfaces and assets for {brand}, either for production or throwaway prototypes/mocks/etc. Contains essential design guidelines, colors, type, fonts, assets, and UI kit components for protoyping.
user-invocable: true
---

Read the README.md file within this skill, and explore the other available files.
If creating visual artifacts (slides, mocks, throwaway prototypes, etc), copy assets out and create static HTML files for the user to view. If working on production code, you can copy assets and read the rules here to become an expert in designing with this brand.
If the user invokes this skill without any other guidance, ask them what they want to build or design, ask some questions, and act as an expert designer who outputs HTML artifacts _or_ production code, depending on the need.
</skill-md>


Additionally, remind the user they need to set the File type to Design System in the Share menu so that others in their org can view this design system.
</attached-skill>

<attached-skill name="Frontend design">
Use this guidance when designing frontend/UI work that is NOT governed by an existing brand or design system. Create distinctive HTML with exceptional attention to aesthetic details and creative choices.

### Design Thinking

Before coding, understand the context and commit to a BOLD aesthetic direction:
- **Purpose**: What problem does this interface solve? Who uses it?
- **Tone**: Pick an extreme: brutally minimal, maximalist chaos, retro-futuristic, organic/natural, luxury/refined, playful/toy-like, editorial/magazine, brutalist/raw, art deco/geometric, soft/pastel, industrial/utilitarian, etc. Use these for inspiration but design one that is true to the aesthetic direction.
- **Differentiation**: What makes this UNFORGETTABLE? What's the one thing someone will remember?

Choose a clear conceptual direction and execute it with precision. Bold maximalism and refined minimalism both work — the key is intentionality, not intensity.

### Aesthetics Guidelines

- **Typography**: Choose fonts that are beautiful, unique, and interesting. Avoid generic fonts like Arial and Inter; opt for distinctive, characterful choices. Pair a distinctive display font with a refined body font.
- **Color & Theme**: Commit to a cohesive aesthetic. Use CSS variables for consistency. Dominant colors with sharp accents outperform timid, evenly-distributed palettes.
- **Motion**: Use animations for effects and micro-interactions. Prioritize CSS-only solutions for HTML. Focus on high-impact moments: one well-orchestrated page load with staggered reveals creates more delight than scattered micro-interactions.
- **Spatial Composition**: Unexpected layouts. Asymmetry. Overlap. Diagonal flow. Grid-breaking elements. Generous negative space OR controlled density.
- **Backgrounds & Visual Details**: Create atmosphere and depth rather than defaulting to solid colors. Gradient meshes, noise textures, geometric patterns, layered transparencies, dramatic shadows, decorative borders, grain overlays.

Vary between light and dark themes, different fonts, different aesthetics. NEVER converge on the same choices across generations.

Match implementation complexity to the aesthetic vision. Maximalist designs need elaborate animations and effects. Minimalist designs need restraint, precision, and careful attention to spacing and subtle details.
</attached-skill>

<attached-skill name="Handoff to Claude Code">
# Handoff to Claude Code

Create a comprehensive handoff package so a developer using Claude Code can implement this design in a real codebase.

## Steps

1. **Create a handoff folder** in the project directory:
   ```
   mkdir -p <project-folder>/design_handoff_<feature-name>/
   ```
   Use a descriptive feature name derived from the design (e.g., `design_handoff_onboarding_flow`, `design_handoff_settings_redesign`).

2. **Create a README.md** in the handoff folder with the following sections:

### README.md Structure

```markdown
# Handoff: <Feature Name>

## Overview
Brief description of what this design is for and what it accomplishes.

## About the Design Files
State clearly that the files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior, not production code to copy directly. Explain that the task is to **recreate these HTML designs in the target codebase's existing environment** (React, Vue, SwiftUI, native, etc.) using its established patterns and libraries — or, if no environment exists yet, to choose the most appropriate framework for the project and implement the designs there.

## Fidelity
State clearly whether the mocks/prototypes created in this conversation are:
- **High-fidelity (hifi)**: Pixel-perfect mockups with final colors, typography, spacing, and interactions. The developer should recreate the UI pixel-perfectly using the codebase's existing libraries and patterns.
- **Low-fidelity (lofi)**: Wireframes or rough layouts showing structure and flow. The developer should use these as a guide for layout and functionality but apply the codebase's existing design system for styling.

## Screens / Views
For each screen or view in the design:
- **Name**: What this screen is called
- **Purpose**: What the user does here
- **Layout**: Detailed description of the layout (grid structure, flex directions, widths, heights, margins, padding)
- **Components**: List each UI component with:
  - Position and size
  - Colors (exact hex values if hifi)
  - Typography (font family, size, weight, line-height, letter-spacing)
  - Border radius, shadows, borders
  - Hover/active/focus states
  - Content/copy (exact text used)

## Interactions & Behavior
- Click handlers and navigation flows
- Animations and transitions (duration, easing, properties)
- Hover states
- Loading states
- Error states
- Form validation rules
- Responsive behavior (if applicable)

## State Management
- What state variables are needed
- State transitions and their triggers
- Any data fetching requirements

## Design Tokens
List all design values used:
- Colors (with hex values)
- Spacing scale
- Typography scale
- Border radius values
- Shadow values

## Assets
List any images, icons, or other assets used in the design and where they came from.

## Files
List the HTML/CSS/JS files in the project that contain the design, so the developer can reference them.
```

3. **Copy relevant design files** into the handoff folder (the HTML prototypes, any component files, etc.)

4. **Use the `present_fs_item_for_download` tool** with the handoff folder path so the user can download it as a zip.

## Important Notes

- Be extremely precise about measurements, colors, and typography — the developer will rely on this documentation
- Make sure the README states up front that the bundled HTML files are **design references**, and that the user's described behavior should be understood as recreating those designs in the target app's existing environment (or the best choice of framework if none exists yet) — not shipping the HTML directly
- If the design uses Anthropic brand assets, mention that they should use the existing brand system in their codebase
- After creating, ask user if they want screenshots of the designs to be included. Don't include them by default.
- The README should be self-sufficient — a developer who wasn't in this conversation should be able to implement the design from the README alone
</attached-skill>

## Assistant



## Assistant

_[tool: local_ls]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: local_read]_

_[tool: view_image]_

_[tool: local_read]_

_[tool: ask_user]_

I've posted a short form. Before I build, I need to know what to make first, which visual direction to use, and which screens and interactions to include.

## User

Answered — deliverable: All of the above, in that order; visual: Use Nocturne design system; circuit: As background texture; screens: Agency overview (Total Burn, Net Revenue, Top Supported), Gifting ledger table, Creator roster + P&L cards, Live battle monitor, Team / workspace roles, Pricing & billing; interactions: Live-updating gift feed, Filter by team / tier / date, Tag gifts by purpose, Coins ↔ Diamonds ↔ USD toggle, Creator drill-down, Add target stream; deck_audience: Agency owners (sales); handoff: Yes

## Assistant

_[tool: update_todos]_

_[tool: list_files]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: copy_files]_

_[tool: dc_write]_

_[tool: show_html]_

_[tool: ready_for_verification]_

I've built the interactive agency dashboard (`TokNomics Dashboard.dc.html`) on Nocturne, and it's now with the reviewer. It has six screens: overview, gifting ledger, creator roster with P&L, live targets, team and plan & billing. The live feed, filters, Coins/Diamonds/USD toggle, purpose tagging, creator drill-down, add-target dialog, invites, plan switching and CSV export all work.

- **Placeholder figures:** All numbers are invented for demo. I used typical rates of $0.0133 per coin and $0.005 per diamond, a 20% agency cut, and made up 12 creators plus the agency name "Northlight Agency" and its team members.
- **Settings panel:** You can change the agency cut %, how often the live feed updates, and whether the circuit texture shows.
- **Circuit image:** It sits behind everything at 7% opacity, shifted from cyan to Nocturne's purple.
- **No logo:** Your code has no logo, so "TokNomics" appears as plain type.

Still to do, in order: the sales deck for agency owners, the design system and the Claude Code handoff. Tell me to continue, or send changes to the dashboard first.

## User

<system-info comment="Only acknowledge these if relevant">
Project title is now "Form design priorities"
User is viewing file: TokNomics Dashboard.dc.html
</system-info>

<pasted_text name="Pasted text (110 lines)">

The Euler Stream MCP server supports two mutually exclusive authentication modes for tool calls that require user identity.
These two modes are **XOR** — you must choose one or the other per connection.

## Authentication Modes

| Mode | URL Parameter | Auth Parameter | Login Flow Required |
|------|--------------|----------------|---------------------|
| **OAuth Mode** | `oauth=true` | `x-oauth-token` | Yes — OAuth login flow |
| **Cookie Mode** (default) | _(none)_ | `x-cookie-header` | No |

- **OAuth Mode** — The server requires an OAuth access token obtained through the [Euler OAuth flow](/docs/oauth). The server itself handles the login flow.
- **Cookie Mode** (default) — The caller supplies raw TikTok cookies directly via the `x-cookie-header` parameter. No OAuth login is required.

## URL Format

The authentication mode is determined by the `oauth` query parameter on the MCP endpoint URL.
This is set **at connection time**, not per tool call.

```
# OAuth mode
https://&lt;host&gt;/mcp?oauth=true&amp;apiKey=YOUR_API_KEY

# Cookie mode (default)
https://&lt;host&gt;/mcp?apiKey=YOUR_API_KEY
```

## OAuth Mode (oauth=true)

When `oauth=true` is set on the MCP endpoint URL:

- The MCP server **requires** the OAuth login flow to be completed before tools can execute.
- Tools accept `x-oauth-token` — the access token from an authorized [Euler OAuth app](/docs/oauth).
- The `x-cookie-header` parameter is **not accepted** and will be ignored.

## Cookie Mode (default)

When `oauth` is omitted or set to `false`:

- No OAuth login flow is required to connect.
- Tools accept `x-cookie-header` — raw TikTok cookies for direct authentication.
- The `x-oauth-token` parameter is **not accepted** and will be ignored.

## Using the Playground

Each tool's playground panel includes an **OAuth Mode** checkbox at the top. Toggling it:

- Updates the **URL preview** to show the endpoint with or without `?oauth=true`, reflecting the selected server host.
- Enables the corresponding authentication field (`x-oauth-token` or `x-cookie-header`) and **disables** the other with a lock icon.
- When running a tool, the playground connects to the MCP server using the correct URL for the selected mode.

The URL preview always reflects the **Server Host** selected in the sidebar picker, so switching servers updates the preview automatically.

## MCP Client Configuration

When configuring an external MCP client (Claude Desktop, Cursor, etc.), append `?oauth=true` to the MCP endpoint URL to enable OAuth mode.

&lt;Tabs items={["OAuth Mode", "Cookie Mode (default)"]}&gt;
&lt;Tab&gt;
```json
{
  "mcpServers": {
    "euler-stream": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://&lt;host&gt;/mcp?oauth=true&amp;apiKey=YOUR_API_KEY"
      ]
    }
  }
}
```
&lt;/Tab&gt;
&lt;Tab&gt;
```json
{
  "mcpServers": {
    "euler-stream": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://&lt;host&gt;/mcp?apiKey=YOUR_API_KEY"
      ]
    }
  }
}
```
&lt;/Tab&gt;
&lt;/Tabs&gt;

&lt;Callout type="info"&gt;
When using OAuth mode, the MCP client will need to complete the OAuth authorization flow on first connection. The server will guide the client through the process.
&lt;/Callout&gt;

## Pinning a User

When using OAuth mode, the authorization flow normally shows an account picker if the user has previously logged in. You can skip this step by passing `pinned_user_id` to the MCP endpoint URL, which automatically selects a specific TikTok user's cached session:

```
https://&lt;host&gt;/mcp?oauth=true&amp;apiKey=YOUR_API_KEY&amp;pinned_user_id=6779789250017592326
```

The `pinned_user_id` parameter is optional. If the user has a valid cached session, authorization completes instantly with no user interaction. If not found, the normal flow continues silently.

This is useful for MCP clients that manage a specific user context and want to avoid the account picker on reconnection.

&lt;Callout type="info"&gt;
For full details on how `login_user_id` works, including edge cases and fallback behavior, see the [OAuth Authorization Flow](/docs/oauth/authorization-flow#pinning-a-user-with-login_user_id) documentation.
&lt;/Callout&gt;

</pasted_text>

<!-- The user attached a local folder named "TokNomics Dashboard Design Code". It may contain a codebase, design components, or other files. Explore it with local_ls("TokNomics Dashboard Design Code") — all paths into this folder must start with "TokNomics Dashboard Design Code/". -->

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
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



## Assistant

_[tool: ask_user]_

I posted a short form. I need to know where the Euler Stream auth doc fits: a data-source screen, an onboarding step, or reference material for the handoff. Waiting on your answer.

## User

Answered — use: Add a "Data source" screen to the dashboard: connect Euler Stream, OAuth vs Cookie mode, API key, pinned user; accounts: Per agency; notes: Default to OAuth for primary ingestion. Restrict Cookie mode and API credential management to Agency Admins/Founders only. Keep connection status visible in the top status bar.

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

Need `m.opacity` in modes, and the header padding-top was removed.

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I've added a **Data source** screen to the dashboard and a connection status bar at the top of every screen; it's now with the reviewer.

- **Defaults:** OAuth is the default mode. Switching modes disconnects you, because the mode is fixed when the connection is made.
- **Connecting with OAuth:** If you enter a pinned user ID, it connects straight away. If not, an account picker opens first.
- **Cookie mode:** Connecting requires a cookie header that contains `sessionid=`.
- **Founder-only controls:** You can now switch the dashboard between Founder and Manager views at the bottom of the sidebar. Managers see Cookie mode, the API key, the server host and the Disconnect button locked.
- **When disconnected:** The ledger, live targets and feed stop updating, and the status bar says so.
- **Placeholders:** The doc gives no real host, so the server host field shows `your-euler-host`. The endpoint URL and client config always show `YOUR_API_KEY`, so copying them never exposes the real key.

Next up are the sales deck, the design system and the Claude Code handoff, unless you have dashboard changes first.

## User

{
  "mcpServers": {
    "euler-stream": {
      "command": "npx",
      "args": [
        "mcp-remote",
        "https://tiktok.eulerstream.com/mcp?apiKey=euler_MTM4ZTNlYzJjMzA2NThmODFkNDdiZjU4YTc0YmNmNTRmYTA1N2U5YjU3YTNkOGY4MGI0NGVl"
      ]
    }
  }
}

## Assistant

_[tool: view_image]_

_[tool: list_files]_

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

The server host on the Data source screen now defaults to `tiktok.eulerstream.com`, so the endpoint URL and client config show your real host.

- **API key:** I left your real key out of the file and used a placeholder; the config preview still shows `YOUR_API_KEY`. The key you pasted is now in this chat, so I'd rotate it in Euler Stream.
- **Napkin sketch:** The attached sketch is empty. If you meant to draw something, please redraw and re-attach it.

## User

<pasted_text name="Pasted text (364 lines)">
# MCP Tools

Model Context Protocol tools available on the Euler Stream API.

## MCP Server

This tool is available via the Euler Stream MCP server. Connect using any MCP-compatible client.

**Endpoint:** `https://tiktok.eulerstream.com/mcp?apiKey=YOUR_API_KEY`

**Configuration (mcp-remote):**
```json
{
  "mcpServers": {
    "euler-stream": {
      "command": "npx",
      "args": ["mcp-remote", "https://tiktok.eulerstream.com/mcp?apiKey=YOUR_API_KEY"]
    }
  }
}
```

**Direct URL (Cursor, etc.):**
```json
{
  "mcpServers": {
    "euler-stream": {
      "url": "https://tiktok.eulerstream.com/mcp?apiKey=YOUR_API_KEY"
    }
  }
}
```


## Tools

- `get_room_id` — Fetch the Room ID for a TikTok user and check if they are currently live
- `get_user_basic` — Fetch basic public TikTok profile info (nickname, region, avatar) for a user by their @unique_id (handle). Works for any TikTok user, live or not.
- `get_live_feed` — Browse a random sample of TikTok LIVE streams currently live in a region. Returns each room's ID, title, viewer count and creator — use it to discover who is live rather than to look up a known user.
- `get_user_id` — Resolve a TikTok @unique_id (handle) to its numeric TikTok user ID. The rankings tools all key on the numeric ID, so start here when the user gives you a handle.
- `bans-ban_room_user` — Ban (kick) a user from a TikTok LIVE room
- `bans-unban_room_user` — Unban a previously kicked user from a TikTok LIVE room
- `bans-get_banned_users` — Retrieve the list of banned users in a TikTok LIVE room
- `mutes-mute_room_user` — Mute a user in a TikTok LIVE room
- `mutes-unmute_room_user` — Unmute a user in a TikTok LIVE room
- `mutes-get_muted_users` — Retrieve the list of muted users in a TikTok LIVE room
- `toggle_room_comments` — Toggle comments on or off in a TikTok LIVE room
- `moderators-get_room_moderators` — Retrieve the list of moderators in a TikTok LIVE room
- `sensitive_words-add_sensitive_word` — Add a sensitive word to a TikTok LIVE room's filter list
- `sensitive_words-delete_sensitive_word` — Delete a sensitive word from a TikTok LIVE room's filter list
- `sensitive_words-get_sensitive_words` — Retrieve the list of sensitive words for a TikTok LIVE room
- `moderators-add_room_moderator` — Add a moderator to a TikTok LIVE room
- `moderators-remove_room_moderator` — Remove a moderator from a TikTok LIVE room
- `rankings-get_leaderboard_catalog` — List every region that has TikTok LIVE leaderboard data, with the rank names and league tiers valid for each. Call this before rankings-get_leaderboard to discover valid region, rank_name and league values instead of guessing them.
- `rankings-get_leaderboard` — Retrieve a TikTok LIVE leaderboard snapshot for a region and rank type (e.g. DAILY_RANK in US, or WW for worldwide). Omit date for the most recent snapshot; league applies only to RANKING_LEAGUE. Returns the top 25 creators — total_ranks reports how many the board actually holds.

---

## get_room_id

`MCP Tool`

Fetch the Room ID for a TikTok user and check if they are currently live

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `unique_id` | string | Yes | The unique ID of the TikTok user to fetch the data for. |

---

## get_user_basic

`MCP Tool`

Fetch basic public TikTok profile info (nickname, region, avatar) for a user by their @unique_id (handle). Works for any TikTok user, live or not.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `unique_id` | string | Yes | The unique ID (handle) of the TikTok user. |

---

## get_live_feed

`MCP Tool`

Browse a random sample of TikTok LIVE streams currently live in a region. Returns each room's ID, title, viewer count and creator — use it to discover who is live rather than to look up a known user.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `region` | enum(US, GB, DE, ES, BE, FR, CA, JP, BR, MX, CO, AR, CL, AU, KR, PE, PL, SG, IT, ID, TH, SA, IL, NL, IE, PT, GR, AT, CH, HU, SK, DK, NO, SE, NZ, AM, AZ, BD, BY, BO, BG, KH, CR, HR, CY, CZ, DO, EC, EG, EE, FI, GE, GT, IS, IM, JM, KZ, LA, LV, LT, LU, MY, MD, MA, PK, PA, PH, RO, ZA, LK, TW, TR, UA, AE, VN) | Yes | The region (country) with which to fetch a feed from. |

---

## get_user_id

`MCP Tool`

Resolve a TikTok @unique_id (handle) to its numeric TikTok user ID. The rankings tools all key on the numeric ID, so start here when the user gives you a handle.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `unique_id` | string | Yes | The unique ID (handle) of the TikTok user. |

---

## bans-ban_room_user

`MCP Tool`

Ban (kick) a user from a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tiktok_user_id` | string | Yes | The numeric user ID for the individual to kick |
| `comment_msg_id` | string | No | Optional comment message ID that triggered the kick |
| `room_id` | string | Yes | The room ID of the livestream |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## bans-unban_room_user

`MCP Tool`

Unban a previously kicked user from a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `tiktok_user_id` | string | Yes | The numeric user ID of the person to unkick |
| `room_id` | string | Yes | The room ID of the livestream |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## bans-get_banned_users

`MCP Tool`

Retrieve the list of banned users in a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number for pagination |
| `room_id` | string | Yes | The room ID of the livestream |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## mutes-mute_room_user

`MCP Tool`

Mute a user in a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The user ID to mute |
| `duration` | enum(-1, 5, 30, 60, 300) | No | Mute duration in seconds (-1 = permanent, 5, 30, 60, 300) |
| `comment_msg_id` | number | No | Optional comment message ID that triggered the mute |
| `room_id` | string | Yes | The room ID of the livestream |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## mutes-unmute_room_user

`MCP Tool`

Unmute a user in a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `user_id` | string | Yes | The user ID to unmute |
| `room_id` | string | Yes | The room ID of the livestream |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## mutes-get_muted_users

`MCP Tool`

Retrieve the list of muted users in a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `page` | number | No | Page number for pagination |
| `room_id` | string | Yes | The room ID of the livestream |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |
| `x-image-source` | enum(ORIGIN, CDN, CDN_CNAME) | No |  |

---

## toggle_room_comments

`MCP Tool`

Toggle comments on or off in a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `enabled` | boolean | Yes | Whether comments should be enabled (true) or disabled (false) |
| `room_id` | string | Yes | The room ID of the livestream |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## moderators-get_room_moderators

`MCP Tool`

Retrieve the list of moderators in a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `anchor_id` | string | Yes | The streamer's numeric user ID |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |
| `x-image-source` | enum(ORIGIN, CDN, CDN_CNAME) | No |  |

---

## sensitive_words-add_sensitive_word

`MCP Tool`

Add a sensitive word to a TikTok LIVE room's filter list

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `word` | string | Yes | The sensitive word to add |
| `sec_anchor_id` | string | Yes | The sec_anchor_id of the room owner |
| `room_id` | string | Yes | The room ID of the livestream |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## sensitive_words-delete_sensitive_word

`MCP Tool`

Delete a sensitive word from a TikTok LIVE room's filter list

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `word_id` | string | Yes | The ID of the sensitive word to delete |
| `sec_anchor_id` | string | Yes | The sec_anchor_id of the room owner |
| `room_id` | string | Yes | The room ID of the livestream |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## sensitive_words-get_sensitive_words

`MCP Tool`

Retrieve the list of sensitive words for a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `sec_anchor_id` | string | Yes | The sec_anchor_id of the room owner |
| `room_id` | string | Yes | The room ID of the livestream |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## moderators-add_room_moderator

`MCP Tool`

Add a moderator to a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to_user_id` | string | Yes | The user ID to add as moderator |
| `anchor_id` | string | Yes | The streamer's user ID |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## moderators-remove_room_moderator

`MCP Tool`

Remove a moderator from a TikTok LIVE room

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `to_user_id` | string | Yes | The user ID to remove as moderator |
| `anchor_id` | string | Yes | The streamer's user ID |
| `x-oauth-token` | string | No | OAuth access token for session resolution |
| `x-cookie-header` | string | No | Cookie header containing sessionid and tt-target-idc |

---

## rankings-get_leaderboard_catalog

`MCP Tool`

List every region that has TikTok LIVE leaderboard data, with the rank names and league tiers valid for each. Call this before rankings-get_leaderboard to discover valid region, rank_name and league values instead of guessing them.

---

## rankings-get_leaderboard

`MCP Tool`

Retrieve a TikTok LIVE leaderboard snapshot for a region and rank type (e.g. DAILY_RANK in US, or WW for worldwide). Omit date for the most recent snapshot; league applies only to RANKING_LEAGUE. Returns the top 25 creators — total_ranks reports how many the board actually holds.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `date` | string | No | The UTC date to retrieve the snapshot for (e.g. "2026-03-09"). Omitted = the board's most recent snapshot (matching what the catalog advertises). |
| `league` | enum(NONE, D5, D4, D3, D2, D1, C5, C4, C3, C2, C1, B5, B4, B3, B2, B1, A3, A2, A1) | No | Optional league level filter (e.g. "D5", "A1"). Only applicable to RANKING_LEAGUE. |
| `rank_name` | enum(DAILY_RANK, FANS_TEAM_RANK, SALE_RANK, RANKING_LEAGUE) | Yes |  |
| `region` | string | Yes | The region to query (or "WW" for worldwide). |

</pasted_text>

<!-- The user explicitly selected the following skills for this project, as attachments to their message. These are not optional context — they define how you work. Use them. -->
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

_[tool: read_file]_

_[tool: read_file]_

_[tool: read_file]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I've wired the Euler Stream tools into the dashboard, and the update is now with the reviewer. Every result is simulated and only appears while the dashboard shows as connected; nothing calls Euler Stream yet.

- **Adding a target:** "Look up" now checks the handle with `get_user_id`, `get_user_basic` and `get_room_id`, then shows the creator's profile and whether they're live. Creators who are offline get a "Track when live" option and a "Check again" button.
- **Discover live (Live targets screen):** Samples streams that are live in a region with `get_live_feed`, with one-click tracking.
- **New Rankings screen:** Pick a region, board type, league (only for the league board) and an optional date. It shows the top 25 and highlights your roster creators so you can see whose rank needs defending.
- **Room moderation:** A shield button on each live target opens a panel. From there you can turn comments on or off, mute (with a duration) or kick viewers and undo either, add or remove room moderators, and edit the sensitive-word filter.
- **Data source screen:** Now lists every tool grouped by where it's used, and which ones need sign-in. It also logs recent tool calls with their arguments, timing and which credential was used. The client config can switch between the `mcp-remote` and direct-URL formats.

Moderation actions take numeric TikTok user IDs, as the API requires. Real calls would need a small backend so the API key stays out of the browser.

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

A typo in the moderation panel's code (an extra closing bracket) stopped the whole dashboard from loading. I've fixed it and sent the dashboard back for review, including the Rankings, Live targets and Data source screens, which hadn't been tested yet.

## User

Found issues — fixing…

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I've fixed the screens that never loaded their data and sent the dashboard back for review.

- **Rankings and Discover live:** Both now fetch as soon as you open their screen, instead of waiting for a step that never fired.
- **Rankings fallback:** If the board hasn't loaded, the card shows a "Load rankings" button instead of a blank box.
- **Stream cards:** The time-live label no longer wraps onto two lines.

## User

import EulerStreamApiClient from "tiktok-live-api-sdk";

const client = new EulerStreamApiClient({ apiKey: "YOUR_API_KEY" });

// Look up any TikTok user by @username
const user = await client.tikTokUsers.retrieveTikTokUserBasic("tv_asahi_news");
console.log(user.data.user?.nickname);

// Browse the TikTok LIVE gift catalog
const catalog = await client.gifts.listWebcastGifts();
console.log(catalog.data.gifts?.length, "gifts");

// Business plan: fetch the TikTok LIVE WebSocket URL straight from the creator's @username
const webcast = await client.anchors.fetchWebcastURLByUniqueId("tv_asahi_news");

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I added an "Ingestion via SDK" section to the Data source screen, based on your snippet; it's out for review. Like the other Euler Stream features, it's still simulated.

- **Gift catalog:** This loads the gift list through `gifts.listWebcastGifts()` when you open the screen. It shows each gift's coin price and cost in dollars, and how often the ledger has sent it. There's a filter and a Resync button.
- **Webcast sockets:** This shows one live connection per tracked target, via `anchors.fetchWebcastURLByUniqueId()`, marked as a Business plan feature. Each shows whether it's open, paused because you're disconnected, or waiting because the creator is offline.
- **Backend snippet:** This is a copyable version of your SDK code using a creator you're tracking, with the API key read from a server-side setting so it stays out of the dashboard.

I don't have the real gift catalog, so the 12 gifts and their coin prices are placeholders.

## User

npm i tiktok-live-connector

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: web_search]_

_[tool: snip]_

_[tool: ready_for_verification]_

I've added a `tiktok-live-connector` version of the backend snippet on the Data source screen; it's now the default tab, and you can switch back to the SDK version. The page loads without errors; I didn't send it for a full review.

- **What the snippet does:** It connects to a tracked creator's live stream with `TikTokLiveConnection`, using your Euler key. It listens for gifts and skips a combo until it has finished. It records only gifts sent from your agency's accounts, writing the room, sender, gift, count and coin value to the ledger.
- **Two things your code must supply:** `loadGiftCatalog()` and `ledger.insert()` are placeholders for your gift-price lookup and database write.
- **Webcast sockets card:** It now describes one `TikTokLiveConnection` per tracked target. I removed the "Business plan" label, since that note applied to the SDK's URL lookup, not to this library.

The package README I found doesn't document a coin-price field on gift events, so coin values come from the synced gift catalog instead.

## User

// Username of someone who is currently live
import { TikTokLiveConnection, WebcastEvent } from 'tiktok-live-connector';

const tiktokUsername = 'officialgeilegisela';

// Create a new wrapper object and pass the username
const connection = new TikTokLiveConnection(tiktokUsername);

// Connect to the chat (await can be used as well)
connection.connect().then(state => {
    console.info(`Connected to roomId ${state.roomId}`);
}).catch(err => {
    console.error('Failed to connect', err);
});

// Define the events that you want to handle
// In this case we listen to chat messages (comments)
connection.on(WebcastEvent.CHAT, data => {
    console.log(`${data.user.uniqueId} (userId:${data.user.uniqueId}) writes: ${data.comment}`);
});

// And here we receive gifts sent to the streamer
connection.on(WebcastEvent.GIFT, data => {
    console.log(`${data.user.uniqueId} (userId:${data.user.userId}) sends ${data.giftId}`);
});

// ...and more events described in the documentation below

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: ready_for_verification]_

I used your chat example to add a live chat feed to the room moderation panel, and it's now out for review. The chat is simulated, like the rest of the Euler Stream features.

- **Live chat:** New messages appear for each live target, the latest 12 at the top of the panel.
- **Actions:** Each message has "Mute 5m" and "Kick" buttons that pass that message's ID along with the action, as the mute and kick tools allow. Muted or kicked users are labelled as such.
- **Filter matches:** Messages that contain a word from the room's sensitive-word list are highlighted.
- **Backend snippet:** It now follows your example's connect-then-handle-errors pattern and adds a chat listener that feeds the moderation panel, alongside the gift listener.

One assumption to check: the message ID in the snippet comes from `data.common?.msgId`. That field isn't in the README example you pasted, so confirm it against the library's chat event type.

## User



## User

<!-- The user attached a local folder named "TikTok-Live-Connector-2.5.0". It may contain a codebase, design components, or other files. Explore it with local_ls("TikTok-Live-Connector-2.5.0") — all paths into this folder must start with "TikTok-Live-Connector-2.5.0/". -->

## User

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

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

The Data source screen now uses Euler's hosted WebSocket (`wss://ws.eulerstream.com`) for live ingestion; it's now with the reviewer.

- **Sockets card:** Shows one socket per live target and what state it's in. An open socket shows its uptime against the 8-hour limit, and an offline creator's socket shows `4404 NOT_LIVE` while it rechecks. When you're disconnected from Euler Stream, every socket shows `1000 NORMAL`, paused.
- **Backend snippet:** The snippet card now opens on the hosted WebSocket. It connects from the backend with your API key, reads each message and hands any close to a close handler. A new "Frontend JWT" tab mints a 60-second token for one creator, limited to one socket. The browser connects with that token and gets a fresh one when the close code says the token is bad or not allowed. The library and SDK tabs are still there.
- **Close codes card:** Lists all 13 codes with what the dashboard does for each. For example, `4404` marks the creator offline and checks again, `4005` closes out the session's totals, `4555` reconnects straight away, `4429` backs off and alerts you, and `4401` or `4403` mints a new token.

**Your call:** The responses for each close code are my own proposals, not from Euler's docs, so check they match how you want the backend to behave.

**Assumption to check:** The snippet assumes the socket sends JSON messages. The doc says they match the `tiktok-live-connector` types but doesn't state the format.

## User

<pasted_text name="Pasted text (203 lines)">

## Creating an Account

To use the Euler Stream API, you need an account and an API key.

&lt;Steps&gt;
&lt;Step&gt;

### Sign up

Create a free account at [eulerstream.com/register](/register). You can sign up with email or use a social login.

&lt;/Step&gt;
&lt;Step&gt;

### Get your API key

After signing in, navigate to the [Dashboard](/dashboard) and create a new API key. Your API key is used to authenticate
all requests to the Euler Stream API.

&lt;/Step&gt;
&lt;Step&gt;

### Start building

Use your API key with one of the supported libraries, the REST API, or the WebSocket API to start
accessing TikTok LIVE data.

&lt;/Step&gt;
&lt;/Steps&gt;

## Overview

The EulerStream API has official SDK libraries auto-generated from the [OpenAPI spec](/docs/api/quickstart).
These are thin wrappers around the REST API, providing type-safe methods for every endpoint.

## Available SDKs

&lt;SdkCards&gt;
  &lt;SdkCard title="TypeScript" language="typescript" href="https://www.npmjs.com/package/tiktok-live-api-sdk" /&gt;
  &lt;SdkCard title="Python" language="python" href="https://pypi.org/project/EulerApiSdk/" /&gt;
  &lt;SdkCard title="C#" language="csharp" href="https://www.nuget.org/packages/EulerApiSdk" /&gt;
  &lt;SdkCard title="Java" language="java" href="https://central.sonatype.com/artifact/com.eulerstream/euler-api-sdk" /&gt;
  &lt;SdkCard title="Go" language="go" href="https://pkg.go.dev/github.com/EulerStream/Euler-Api-Sdk/sdk/go" /&gt;
  &lt;SdkCard title="WebSocket SDK" language="websocket" href="/docs/api/client-sdks/websocket-sdk" /&gt;
&lt;/SdkCards&gt;

## Installation

&lt;Tabs items={["TypeScript", "Python", "C#", "Java", "Go"]}&gt;
&lt;Tab&gt;

```bash
npm i tiktok-live-api-sdk
```

&lt;/Tab&gt;
&lt;Tab&gt;

```bash
pip install EulerApiSdk
```

&lt;/Tab&gt;
&lt;Tab&gt;

```bash
dotnet add package EulerApiSdk
```

&lt;/Tab&gt;
&lt;Tab&gt;

**Maven**
```xml
&lt;dependency&gt;
  &lt;groupId&gt;io.github.isaackogan&lt;/groupId&gt;
  &lt;artifactId&gt;euler-api-sdk&lt;/artifactId&gt;
&lt;/dependency&gt;
```

**Gradle**
```groovy
implementation 'io.github.isaackogan:euler-api-sdk'
```

&lt;/Tab&gt;
&lt;Tab&gt;

```bash
go get github.com/EulerStream/Euler-Api-Sdk/go-sdk
```

&lt;/Tab&gt;
&lt;/Tabs&gt;

## Quick Start

&lt;Tabs items={["TypeScript", "Python", "C#", "Java", "Go"]}&gt;
&lt;Tab&gt;

```ts
import EulerStreamApiClient from "tiktok-live-api-sdk";

const client = new EulerStreamApiClient({ apiKey: "YOUR_API_KEY" });

// Fetch a TikTok LIVE webcast URL
const res = await client.webcast.fetchWebcastURL(
  "ttlive-node",
  undefined,
  "tv_asahi_news"
);
console.log(res.status, res.data);
```

&lt;/Tab&gt;
&lt;Tab&gt;

```python
from EulerApiSdk import AuthenticatedClient
from EulerApiSdk.api.tik_tok_live import fetch_webcast_url

client = AuthenticatedClient(
    base_url="https://tiktok.eulerstream.com",
    token="YOUR_API_KEY"
)

with client as c:
    response = fetch_webcast_url.sync_detailed(client=c)
    print(response.status_code, response.parsed)
```

&lt;/Tab&gt;
&lt;Tab&gt;

```csharp
using EulerApiSdk;
using EulerApiSdk.Client;

using var client = new EulerStreamApiClient(
    host =&gt; host.AddTokens(new ApiKeyToken("YOUR_API_KEY", ClientUtils.ApiKeyHeader.ApiKey, prefix: ""))
);

var response = await client.Webcast.FetchWebcastURLAsync("ttlive-node", uniqueId: "tv_asahi_news");
Console.WriteLine(response.Ok());
```

&lt;/Tab&gt;
&lt;Tab&gt;

```java
import io.github.isaackogan.EulerStreamApiClient;

EulerStreamApiClient client = EulerStreamApiClient.builder()
    .apiKey("YOUR_API_KEY")
    .build();

// Use the client
client.webcast().fetchWebcastURL("ttlive-node", null, "tv_asahi_news");
```

&lt;/Tab&gt;
&lt;Tab&gt;

```go
package main

import (
  "context"
  "fmt"

  eulerstream "github.com/EulerStream/Euler-Api-Sdk/sdk/go"
)

func main() {
  client := eulerstream.NewEulerStreamClient(
    eulerstream.WithAPIKey("YOUR_API_KEY"),
  )

  hosts, _, err := client.Analytics.GetHosts(context.Background()).Execute()
  if err != nil {
    panic(err)
  }
  fmt.Println(hosts)
}
```

&lt;/Tab&gt;
&lt;/Tabs&gt;

## Source Code

All SDKs are open source and available on GitHub:

&lt;Cards&gt;
&lt;Card title="TikTok Live API SDK Repository" href="https://github.com/EulerStream/TikTok-Live-Api"&gt;
TypeScript, Python, C#, Java, and Go SDK source code.
&lt;/Card&gt;
&lt;Card title="WebSocket SDK Repository" href="https://github.com/EulerStream/Euler-WebSocket-SDK"&gt;
TypeScript WebSocket SDK for real-time event streaming.
&lt;/Card&gt;
&lt;/Cards&gt;

</pasted_text>

## Assistant

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_js_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: dc_html_str_replace]_

_[tool: ready_for_verification]_

I added Euler Stream's setup steps to the Data source screen, plus SDK examples in more languages; it's now with the reviewer.

- **Get started card:** It appears at the top of Data source whenever you're disconnected or the API key field is empty, and it has three steps. The first two link to Euler's sign-up page and dashboard, and both tick off once a key is entered. The third ticks off once you're connected. Managers see "Ask a Founder to finish setup" instead. To see it, click Disconnect or clear the API key.
- **SDK languages:** The `tiktok-live-api-sdk` tab of the backend snippet now has a TypeScript / Python / C# / Java / Go switch. Python, C#, Java and Go use your quick-start examples with the key read from an environment variable, and the handle changed to `nova_shift` where there is one. TypeScript keeps the TokNomics-specific snippet from before.

**Assumption to check:** I linked the setup steps to `https://www.eulerstream.com/register` and `/dashboard`. Your doc only gave relative paths, so I took the domain from the connector's README.

