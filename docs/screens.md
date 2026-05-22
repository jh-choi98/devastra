# Screens — DevAstra

**Scope of this doc:** every distinct screen and overlay surface. Each entry lists _purpose · info displayed · actions · state variations · mobile/desktop deltas_. Use this with `docs/flow.md` (transitions) and `docs/data-schema.md` (data shape).

Screens are grouped into 10 categories (A–J) plus 5 missing-screen additions (M1–M5). Every screen maintains brand consistency: dim sky background (`#0b1020` gradient), constellation as identity, sticky CTAs only on visitor surfaces.

---

## A — Public / unauthenticated pages

### A.1 — Landing (`/`)

**Purpose:** unauthenticated visitor → OAuth decision.

**Layout:**

- Hero: founder's real constellation, rendered with one-shot reveal animation playing once per visitor every 7 days (localStorage flag).
- Headline: `A developer skill constellation that lights up as you code.`
- Sub-line: `Connect GitHub. See what you've built, brighter every week.`
- Single CTA: `Sign in with GitHub`
- Below the fold: link `See others' constellations →` to a curated 3-card gallery of sample public profiles (founder-selected, static for MVP).
- Footer: `Privacy · Terms · GitHub repo`
- No top navigation.

**State variations:**

- First visit (or >7 days): reveal animation plays once.
- Within 7 days: static hero.
- Post-OAuth-cancel return: small inline message above CTA `Connection was cancelled — try again?`
- Post-signout return (`/?signed_out=true`): brief toast `Signed out`.

**Gallery clicks:** open target public profile in a new tab.

**Mobile:** identical layout, scaled. Constellation hero retains full viewport height; sub-line stacks under headline; gallery is a horizontal scroll if needed.

---

### A.2 — 404 page (`/{nonexistent}` or `not-found.tsx`)

**Purpose:** recovery from invalid URL.

**Layout:**

- Dim sky background with faint constellation outline (decorative).
- Copy: `No constellation at this address`
- CTAs: `Create yours, free →` (primary) · `Browse other constellations →` (secondary, links to landing gallery)

### A.3 — Private profile placeholder (`/{username}` where `is_public = false`)

**Purpose:** indicate a real but private constellation.

**Layout:**

- Dim sky + _unlit/locked_ constellation outline (six dim cluster outlines + faint star positions but no glow).
- Copy: `{username}'s sky is private`
- CTA: `Create yours, free →`

### A.4 — Rate-limit page (429)

**Purpose:** rate-limit guard recovery.

**Layout:**

- Brand-consistent dim sky.
- Copy: `Too many requests — try again in a moment`
- Manual `Retry` button (page reload).

### A.5 — Account deleted page (`/account-deleted`)

**Purpose:** confirm hard delete + auto-redirect.

**Layout:**

- Dim sky.
- Copy: `Thanks for trying DevAstra. Your account has been deleted.`
- Button: `Go to landing now →`
- Auto-redirect to `/` after 5s.

---

## B — Onboarding

### B.1 — OAuth callback (`/auth/callback`)

**Purpose:** complete GitHub OAuth handshake; bridge to onboarding or `/`.

**Layout:**

- Dim sky background.
- Six dim cluster outlines fade in to preview the next screen.
- Copy: `Connecting your GitHub...`
- If >5s elapsed: copy changes to `Taking longer than expected. Refresh to try again →`.

**Outcomes:**

- Success + no `last_event_id` → redirect to `/onboarding/repos`.
- Success + `last_event_id` present → redirect to `/`.
- Failure → redirect to `/?auth_error=oauth_failed`.

### B.2 — Repo selection (`/onboarding/repos`)

**Purpose:** user picks which repos contribute to their constellation.

**Header:** `Pick your repos` + helper `These repositories will shape your constellation. All are included by default.`

**Loading state:** 8 skeleton rows. Fetched from GitHub via server-side API.

**Repo row (per-repo):**

- Checkbox (default: checked).
- Repo name + owner.
- Primary language icon.
- Last update date (relative).
- 90-day commit count.
- 2–3 cluster-color dots showing the domains this repo contributes to (inferred from primary language + simple heuristics).
- Visually dim when unchecked.

**Search box:** appears at ≥20 repos, sticky to the top of the list on mobile.

**Sort:** most recent activity first (fixed; no user override).

**Bulk actions + counter:** `Selected N of M repos` with `Select all` and `Deselect all`.

**Actions:** primary `Build my constellation`; secondary `Start with empty sky`.

**Special states:**

- **Zero public repos.** Top half: six dim cluster outlines. Bottom half: copy `No public repos yet. Push your first public repo to light up your sky.` + link to GitHub + secondary action `Start with empty sky`.
- **100+ repos.** Above the list: subtle note `Initial sync may take a few minutes`.
- **Sparse user (3 repos, few commits).** Helper copy below the header: `Every constellation starts here.`
- **GitHub API failure.** Full-page state: `Couldn't load your repos. Try again?` + Retry.

**Submit transition:** fade out → fade in main constellation page; pre-reveal sky already loading.

**Mobile:** single-column stack; sticky search; same content.

---

## C — Main constellation page (authenticated owner, `/`)

**Purpose:** the user's identity surface. Always visible; never blocked.

### Header (top bar)

- **Placement:** floating overlay above the full-viewport constellation, not a reserved layout row. It must never crop or push the star field down; the constellation remains the primary first-viewport object.
- **Style:** separate low-opacity glass controls (`bg-slate-950/40`, subtle border/backdrop blur), no hard full-width divider line between header and sky. Header elements are `pointer-events-auto`; the surrounding overlay frame is non-blocking.
- **Left:** text brand (`DevAstra`; compact but still readable on mobile). The constellation mark is reserved for the browser/app icon, not repeated in the in-app header.
- **Right:** Refresh button · Share button · Avatar dropdown (`Settings · My public profile (if is_public) · Sign out`).

**Refresh button states:**

- Idle: `Refresh`.
- Queued: `Queued...`; disabled cursor.
- Running: `Syncing...`; disabled cursor.
- Cooldown: `Refresh (Nm)`; disabled cursor. Clicks are ignored so no duplicate refresh request is sent.
- Disconnected/dispatch-failed responses return the control to idle; the cached constellation remains visible.

**Share button states:**

- Default: share icon.
- After first drawer close: one pulse animation, then steady.

### Canvas (constellation)

Visual language: Stellarium atmosphere-OFF mode (`docs/adr.md` ADR-61). Cluster identity is conveyed by spatial grouping + boundary lines + connections + labels — never by persistent color. Default canvas reads as an observational star atlas, not a colorful skill dashboard.

**Renderer stack:** WebGL via React Three Fiber + drei on the web. `@react-three/postprocessing` remains available as an optional low-resolution debug / experiment layer, but the production steady-state canvas does not rely on full-screen bloom. SVG-only fallback is kept for OG image generation and for browsers that cannot run WebGL. The shared math (anchors, palette, Voronoi cells, magnitude curve, label-selection rule, MST) lives in `features/constellation/render/*` and is consumed by both. See `docs/adr.md` ADR-62.

**Layers (back to front):**

- **Sky background.** Pure near-black (`#020207` zenith → `#050307` edges). No vertical gradient toward a warm horizon and no warm nebulosity wash in the default product canvas.
- **Milky Way nebulosity.** Disabled in the default web renderer and share/OG renderer by final visual decision: the canvas should read as a clean observational star atlas, not a nebula illustration. Texture assets may remain for historical experiments, but the active product surface does not render the Milky Way layer.
- **Atmospheric haze.** A very faint cool blue-gray additive layer between sky and stars, capped at ~5% peak alpha. It gives depth without becoming a colored aura or warm nebula. Its low-frequency drift is disabled under `prefers-reduced-motion: reduce`.
- **Field stars** (2000 desktop / 1000 mobile baseline; 1500 OG). Deterministic seed; density biased toward a diagonal star-field band, not a rendered Milky Way texture. Spectral palette weighted 70% white / 20% blue-white / 7% yellow-white / 3% orange-red. Sizes: 80% 1px / 15% 2px / 5% with visible halo, with the current background-star size profile enlarged 10% from the original baseline. The renderer generates a larger deterministic pool and uses viewport-aware draw ranges, opacity, spread, and size scale: small canvases get a quieter sky so tech stars remain foreground; wide canvases get more fill without adding semantic work. Per-star bounded twinkle stays within the profile cap. No labels, no hover, no click. Sparse constellations may dim field/mid stars by at most ~10–12% so lit tech stars read as the foreground; density, color, and twinkle character do not change.
- **Mid-depth stars** (420 desktop baseline / lower on small mobile / 280 OG). Deterministic, slightly larger than field stars, and slightly stronger in parallax response. They sit between field stars and tech stars to restore depth without increasing semantic star count. Like field stars, this tier is pool-backed and viewport-adaptive.
- **Territory boundary lines.** Six Voronoi cells computed at render time from the cluster anchors (see `docs/adr.md` ADR-63). Always visible. Thin (~10% opacity) muted blue-gray polygonal strokes. Fixed regardless of which stars are lit. This is the persistent "map layer" that establishes cluster regions without color.
- **Connection lines.** MST among lit stars per cluster. Muted blue-gray (not cluster color), rendered as thin tapered quad strips with a narrow blue-white core and a very soft shader-local halo. The line should read like a real sky chart thread: more legible than a 1px stroke, but never like a bright game-UI overlay or cluster-color route line. Web tuning keeps the same MST geometry while modestly lifting core/glow visibility on dense dark skies. Share/OG uses a separate stronger static stroke profile because the 1200×630 image is commonly downscaled in previews.
- **Tech stars.** Positions come from `tech-catalog.md` (deterministic per-`tech_key` `{x, y}` within cluster anchor + jitter). Spectral colors from the same palette as field stars (deterministic mapping by tech_key — see `features/constellation/render/palette.ts`). Airy disk core + soft shader-local halo. Visible 4-spike diffraction cross (vertical + horizontal) only for bright-or-stronger stars in the current top-brightness tier. Brightness scales with `landmarks.weight` via the logarithmic magnitude curve in `features/constellation/render/magnitude.ts`: newly lit stars remain pinpoints, steady stars gain a visible halo, and heavy hitters gain larger cores plus longer diffraction spikes. Sparse constellations gently boost tech star scale/intensity/spike length (bounded, data-preserving) so a small number of lit stars still feels intentional. Small viewports reduce tech-star core/spike intensity and label scale together so mobile constellations stay readable without changing generation accuracy or layout topology. Tech stars have NO ambient motion — identity is preserved.
- **Cluster aura (event-only).** Steady state: OFF. Cluster color appears only on these triggers, in priority order: `cinematic/stage-up > drawer-selected > hover > none`. Only one aura is active at a time. Hover region is the boundary polygon interior; star hover and label hover also count as cluster hover. While the drawer is open with cluster X selected, X's aura stays on; hovering another cluster Y highlights Y's boundary line but does NOT activate Y's aura. Fade in/out ~200ms; additive blend; does not depend on full-screen bloom.
- **Labels.** Small blue-white sans-serif, Stellarium typography. NOT cluster color, NOT caps, NOT letter-spaced.
  - Cluster labels: always visible, one per cluster (e.g. `Backend`). The inline `· STAGE N` suffix is removed; stage information lives in the drawer / strip instead.
  - Tech star labels (persistent rule):
    - label every lit tech star, including newly lit / low-brightness stars
    - smaller stars use quieter, smaller map-style labels; brighter stars get slightly stronger labels
    - labels are offset outward from each cluster anchor so dense clusters stay readable without leader lines
  - Unlit stars: no label, no hover.

**Postprocessing:** OFF by default in the production steady-state canvas. The default glow is shader-local (Airy disk halo + diffraction spikes + soft field/mid-star points) so first paint and FPS stay stable. A low-resolution Bloom + Vignette stack remains available for manual `/dev/map` layer checks and future experiments, but it is not part of the default visual contract.

**Camera / parallax:** User pan/zoom is disabled. Dense constellations use the full atlas framing. Sparse constellations (1–17 lit tech stars) use a bounded system framing boost: orthographic zoom up to ~10% desktop / ~6% mobile, with a small blend toward the lit-star bounding box. Mouse-driven camera parallax is disabled in steady state; bounded background-layer parallax on field/mid stars is allowed because tech stars and labels remain fixed.

**First paint / fallback:** `Skeleton` (HTML/SVG: background + boundary lines + cluster labels, ≈3KB) is the dynamic loading fallback and the WebGL-unsupported / Scene-crash fallback. In the normal WebGL path, the Skeleton is removed once the WebGL wrapper and Scene mount; the Scene then fades in over 300–500ms. This avoids keeping duplicate map layers under the canvas during steady state.

**Viewport:** full viewport behind the floating header. No scroll. User pan/zoom disabled (the constellation is identity, not a map); sparse-mode system framing is the only zoom/pan-like adjustment. Star position resolution applies a viewport-safe edge inset so lit tech stars do not drift out of frame on wider aspect ratios.

**Mobile:**

- Header: logo + avatar/actions remain floating over the canvas with safe-area-aware padding; controls stay compact and do not reserve vertical space above the constellation.
- Constellation: viewport-aware cluster center positions (separate set from desktop, hardcoded in renderer config).
- Cluster labels: scaled down (no abbreviation — semantic meaning preserved).
- Star tap targets: enlarged invisible coarse-pointer hit areas, tuned to stay at or above the 44px mobile target size on common viewports.
- Pull-to-refresh enabled on main constellation only.
- Safe-area-insets respected (notch / nav bar).
- **Adaptive quality:** background star counts, opacity, spread, and size are derived from the real canvas area; tech-star size, spike length, and label scale shrink together on small screens. DPR cap `Math.min(devicePixelRatio, 2)`. Postprocessing remains default-off; if manually enabled, it uses a low-resolution render target.

**Reduced motion (`prefers-reduced-motion: reduce`):** field/mid-star twinkle off, background-layer parallax off, haze drift off, spark / ripple / aura fade replaced by instant final-state swap. Postprocessing is default-off; if explicitly enabled, it remains static composition.

**Accessibility:** WebGL canvas is purely visual. A DOM overlay layer with invisible buttons is absolutely positioned over (a) each Voronoi cluster cell, (b) each cluster label, (c) each lit tech star and its visible label. The overlay receives the same sparse-mode transform as the WebGL camera so visual stars and hit targets stay aligned. Keyboard tab + ARIA + screen-reader summary all flow through this overlay. Field stars and unlit anchors are NOT accessible targets (`docs/adr.md` ADR-63).

**Browser without WebGL:** Skeleton stays mounted (boundary + labels + dim sky), with a small banner: `Your browser doesn't support advanced graphics; using simplified view.` See `docs/adr.md` ADR-62.

### Star tooltip (desktop hover)

- Trigger: hover 200ms.
- Content: `React · radiant · since Mar 12` (tech name · brightness descriptor · first lit date in product language).
- Position: above the star; auto-flips at edges.
- Dismissal: mouse leave → immediate hide.
- Mobile: not used (tap → drawer).

### Brightness scale

- Location: bottom-right of the constellation viewport by default. It sits below drawer/scrim layers and is hidden during first-reveal/build overlays to avoid competing with transient status copy.
- Compact state: a small, low-opacity Stellarium-style brightness ladder. It shows five star samples plus their signal thresholds (`5`, `10`, `30`, `80`, `200+`) instead of long text, so it does not compete with the constellation.
- Expanded state: hover, focus, or tap reveals a concise table for `faint → emerging → steady → bright → radiant`, with each row showing the star sample and signal range. Below the table, a compact signal rule explains the user-visible scoring model: matched commits add `+1`, issues add `+2`, and PRs add `+5`; if one activity matches multiple techs, signal is split across those stars. Avoid paragraph copy and renderer-internal terms in this overlay.
- If the user has lit stars, the expanded state summarizes only the current lit-star count.
- Mobile: the same compact scale is tappable and expands upward so it does not cover the main star field more than necessary.

### Initial page load

- Server-prerendered via ISR or RSC. No spinner on the page itself; data arrives with the HTML.
- Realtime subscription connects on mount; subsequent updates within session spark new/changed stars (context guard: if drawer/modal open, updates apply silently and highlight on next focus).

---

## D — Constellation overlays

### D.1 — Cluster drawer

**Trigger:** click on cluster label (full drawer) or click on a star (drawer opens with that star's row focused, scrolled, and `Why is this lit?` expanded).

**Layout:**

- Desktop: right slide panel, 480px fixed width.
- Mobile: bottom sheet — half-screen by default, swipe up for full screen.

**Header:**

- Cluster name (`Backend`).
- Status line: `Active this week` (if any activity in last 7 days) and/or `· Recently expanded` (if `stage_changed_at` within last 7 days).

**Body (top to bottom):**

1. **Cluster summary** — brief stats: `12 stars lit · 4 brightened this week`. Stage info as small footer text: `Stage 2`.
2. **Lit stars list** — each row: star icon (color, size matched to canvas), tech name, brightness descriptor (`faint` / `emerging` / `steady` / `bright` / `radiant` mapped from landmark weight), first-lit date, top contributing repo (`from juho/my-app`). Row is clickable → toggles inline `Why is this lit?` expansion. Recently unlocked/brightened rows are visually marked.
3. **`Why is this lit?` expansion (per star, on click)** — detection-rule summary (e.g. `Lit from TypeScript files and React-related paths`), contributing repos list (1–3 repos with the most matches), activity breakdown (`12 commits · 3 PRs`). It does not include inline correction links; the drawer should stay focused on explanation and exploration.
4. **Recent PRs** — up to 3 recent PR rows (title + repo + relative time). Titles are fetched from GitHub API on drawer open and are never persisted. The client dedupes in-flight requests for the same user/cluster and may reuse a few-minute success result for immediate reopens; the route may also reuse a bounded, instance-local success result keyed by user id + cluster. Loading state shows skeleton rows. `See more on GitHub →` link.
5. **(Visitor view only) CTA footer** — `Want to see yours? Create yours, free →`.

**Star focus from canvas star click:** the matching star row is highlighted (subtle background tint), auto-scrolled into view, and its `Why is this lit?` expansion is auto-opened.

**Dismissal:** X button, outside click, ESC, mobile swipe-down.

**Owner vs visitor:** identical structure; only the footer CTA differs.

### D.2 — Share modal

**Trigger:** Share button in header.

**Layout (top to bottom):**

1. **Header:** `Share your DevAstra` + close X.
2. **OG preview** — rendered preview of `/api/og/profile/{username}` at 1200×630 ratio. The modal shows the standard render immediately, then swaps in the high-resolution 2× render for crisp Retina display while preserving the same composition. The preview uses the current dark-sky OG renderer: deterministic field/mid-star layers, current lit tech stars, current labels, current background, and static connection strokes tuned for downscaled share cards.
3. **Public toggle row** — `Make your constellation public at devastra.app/{username}` + toggle.
   - OFF state: share buttons below are disabled (visually grayed).
   - ON state: toggle expansion below — `Your constellation is public · devastra.app/{username} [Copy] [Preview →]`.
4. **Share targets row** — Copy link · X (icon-only, accessible label `Share on X`) · LinkedIn (with `in` logo) · Download PNG · (mobile) Native share. X pre-filled post: `My GitHub activity, as a constellation. {url}`. X and LinkedIn open native share composers with the public profile URL; the generated image appears as a platform link preview card only when the public URL and `og:image` are crawlable, not as an uploaded image attachment. Download PNG: filename `devastra-{username}-{date}.png`, dimensions 2400×1260, watermark in bottom-right.

**Feedback after a share button click:** modal closes + brief toast `Shared!`.

**Animation:**

- Desktop: fade in/out.
- Mobile: slide up from bottom.

**Dismissal:** X · outside click · ESC · mobile swipe-down.

---

## E — Action modals / forms

### E.1 — Disconnect GitHub confirm modal

- **Heading:** `Disconnect GitHub?`
- **Body:** `Your constellation stays. Public profile becomes private. Reconnect anytime.`
- **Actions:** Cancel (text link, left) · Disconnect (red filled, right).
- **Dismissal:** X / Cancel / ESC. Outside-click is **disabled** (deliberate friction).
- **Mobile:** centered modal (not full-screen).

### E.2 — Delete account confirm modal

- **Heading:** `Delete your account`
- **Body:** `This cannot be undone. We will delete:`
  - Your constellation
  - All weekly recaps
  - Your public profile
  - All account data
- **Input:** `Type your username to confirm: {username}` (label above input).
- **Actions:** Cancel (text link, left) · `Permanently delete` (red filled, right, **disabled** until input matches exactly).
- **Dismissal:** X / Cancel / ESC. Outside-click is **disabled**.
- **Mobile:** full-screen modal (severity signal).

### E.3 — Misclassification feedback modal

- **Trigger:** not exposed in the drawer UI while the correction entrypoint is being redesigned. The backend action and modal remain available for a future low-friction feedback surface.
- **Heading:** `Help us understand. What looks off?`
- **Form:**
  - Category select: `Wrong category` / `Shouldn't be lit` / `Activity not mine` / `Other`
  - Optional textarea (`Add a note (optional)`)
- **Footer disclaimer:** `We may use this to improve classification. We won't email you about this submission.`
- **Submit:** server action inserts into `misclassification_feedback`. Rate limit: 5 per user per 24h (inline error if exceeded).
- **Post-submit:** modal closes + toast `Thanks. We'll look into it.`

---

## F — Settings page (`/settings`)

**Purpose:** account, preferences, danger zone.

**Layout:**

- Header: `Settings` title · avatar (right) with a `← Back` link. On `lg` and wider screens, Back sits in the left gutter, vertically centered to the title; below `lg`, Back stacks above the title so it never overlaps or clips on narrow browser widths.
- Max width 800px, centered.
- Single long page, divider lines between sections (no card backgrounds).
- Mobile: single column scroll.

**Section order (top to bottom):**

1. **Account info** (read-only) — compact: avatar + `@username` on one line, email on the next.
2. **Public profile** — toggle. OFF state: just toggle + helper `Make your constellation public at devastra.app/{username}`. ON state: toggle expansion below with URL · Copy · `Preview →`.
3. **Timezone** — IANA dropdown, browser default. MVP sub-text live: `Dates are shown in this timezone.` Auto-save on change. When weekly recap email is re-enabled in Phase 2, this line becomes `Your weekly recap arrives Sunday at 6 PM in this timezone.` The dropdown is rendered from a deterministic server-provided option list, with the user's current timezone always included; client-only `Intl.supportedValuesOf('timeZone')` must not drive the initial option render because Node and Chrome can ship different ICU timezone lists.
4. **Username change** — text input + inline live validation + URL preview `devastra.app/{new}`. On save success: helper `Anyone with your old URL devastra.app/{old} will be redirected to your new one.`
5. **Included repos** — default _collapsed_ section. The collapsed state shows only the included/total count and privacy note; the full repo list is lazy-loaded when the user expands the editor. Expand → search box + list of repos. Each row: name + language + toggle. Save button at bottom of section. On save: pre-save change-summary modal (`These changes will affect your constellation:` + brief rebuild note).
6. **Danger zone** — red border + heading `Danger zone`. Two sub-sections:
   - **Disconnect GitHub** — description + Disconnect button → E.1 modal.
   - **Delete account** — description + Delete button (red text) → E.2 modal.

**Save model:**

- Public profile toggle and timezone: auto-save + toast.
- Username, repos: explicit Save button per section.

**Validation copy:**

- Username <2 chars: `At least 2 characters`
- > 30 chars: `Up to 30 characters`
- Invalid chars: `Only lowercase letters, numbers, hyphens, and underscores`
- Reserved name: `This name is reserved`
- Collision: `This name is taken`

---

## G — Public profile page (`/{username}`)

Three render variations: visitor (unauthenticated or other user), owner self-view, logged-in visitor.

### G.1 — Visitor view (unauthenticated)

- **Header:** text brand only (minimal, no actions; no repeated mark).
- **Top-left compact block:** avatar + `@username` + stats line `12 stars lit · 4 clusters active`.
- **Header text below:** `Viewing {username}'s constellation`
- **Constellation:** identical interactive rendering as owner view; tap/click opens drawer.
- **First-time reveal per session:** short 3–5s reveal animation when the user lands on this URL for the first time per session.
- **Sticky bottom CTA:** full-width bar `Create yours, free →`. Visible from page load. Pulses once after the visitor opens the first drawer.
- **Drawer footer:** `Want to see yours? Create yours, free →`
- **Footer:** none.

### G.2 — Owner self-view

- **Same as G.1** plus:
- **Strip below header:** `This is how others see your constellation` + `← Back to my private view` link.
- **Sticky CTA:** hidden.
- **No dismiss** on the strip — page navigation is the only exit (intentional, context-bound).

### G.3 — Logged-in visitor (another user viewing this one)

- **Same as G.1** plus:
- **Header right:** `Back to my sky →` link (replaces actions).
- **Sticky CTA:** hidden (no CTA — user already has a constellation).

### Edge variants

- **Private profile (`is_public = false`):** see A.3.
- **404 (no such username, history not found):** see A.2.
- **Sparse owner:** rendered identically — no "this person is new" framing.

---

## H — State overlays / banners on main page

All banners apply over the main constellation, never block it. Multi-banner priority in the top strip area: `disconnected > system status > welcome back > this-week diff`. Bottom sync-failed banner occupies a separate region.

### H.1 — Refresh-in-progress

- Refresh button shows `Queued...` while the manual job is pending, then `Syncing...` while it is running.
- Floating text bottom-right: `Looking for new activity...`
- After 30s: `Still syncing — this can take a moment for active accounts`
- Realtime is primary. A lightweight `/api/sync/latest-job` polling fallback runs only while a manual sync is active, so missed Realtime events do not leave the header stuck in an in-progress state.

### H.1a — Constellation build-in-progress

- Triggered by `sync_jobs.kind = initial|backfill` with `status = pending|running`.
- The existing constellation stays visible and interactive context is preserved; a subtle dim/blur veil and bottom-right status panel clarify that the displayed sky is being rebuilt.
- Initial copy: `Building your constellation` + `Your selected repositories are being analyzed. Stars and connections will settle in as the first build becomes ready.`
- Settings backfill copy: `Updating your constellation` + `Your repo choices are being applied. Stars and connections will redraw after saved activity and project manifests are checked.`
- The panel detail line uses `sync_jobs.progress.current_step` when available; otherwise it falls back to a calm starting message.
- As new data lands, tech stars fade/grow into place and connection lines draw from one endpoint to the other. Reduced-motion users receive the final state without draw animation.
- The overlay is removed only when the sync job reaches `completed` or `failed`. On failure, the normal sync-failed banner appears and the cached constellation is visible.

### H.2 — Sync-failed banner

- **Location:** bottom of viewport.
- **Copy:** `Sync failed. Your constellation is safe.` + Retry button.
- **Dismissible** via X.

### H.3 — System status banner

- **Location:** top strip below the floating header controls, over the constellation but outside the main star focus area.
- **Default copy:** `Sync is delayed right now. Your constellation is safe.` Admin may override the `system_messages.message` for specific incidents.
- **Dismissible** for the session; reappears in new sessions until `active = false`.

### H.4 — GitHub disconnected banner

- **Location:** top strip.
- **Copy:** `GitHub disconnected — reconnect to sync new activity`
- **Action:** `Reconnect →` button.
- **Dismissible.**

### H.5 — Token expired (special case of H.4)

- **Copy:** `Your GitHub connection expired — Reconnect`
- **Action:** `Reconnect` button.
- Otherwise identical to H.4.

### H.6 — Welcome-back strip

- **Trigger:** `NOW() - users.last_login_at > 28 days`.
- **Location:** top strip.
- **Copy:** `Welcome back — your constellation has new activity` + sub-line `Since your last visit: 3 stars lit · Backend expanded` + dismiss X.
- The most-changed cluster pulses once on canvas.
- **Dismiss persists for the visit only.** Future ≥4-week absences trigger again.

### H.7 — This-week diff strip

- **Trigger:** entry via `/?from=recap` or any post-sync state where this week has changes.
- **Location:** top strip.
- **Copy:** `This week: 2 new stars · Backend +18%` + dismiss X. If stage-up present, priority copy: `Backend cluster expanded · 2 stars brightened`.
- **Auto-hide** on second visit (within the week); star-level glow/spark remains until next Sunday.

### H.8 — Hint tooltips

- **Style:** small floating bubble with arrow pointing to target.
- **Cluster click hint** (`cluster_click_hint_seen`): `Click to explore` (desktop) / `Tap to explore` (mobile). Anchored to brightest cluster's label after first reveal. Auto-dismiss in 5s. At most 2 appearances total; opening any drawer permanently sets the flag.
- **Share pulse:** one-time pulse animation on Share button after first drawer close. Not a tooltip — visual cue only.
- **Recap diff hint** (`recap_diff_hint_seen`): `See what's new in {Cluster}` near brightest changed cluster on `/?from=recap` entry. Dismisses on target click.

---

## I — Special moments (transient cinematic layers)

### I.1 — First-time reveal

See `docs/flow.md` Flow 1 step 6 for choreography. Triggered only on a user's first lifetime entry to `/` after onboarding. Subsequent post-sync changes use shorter spark-only animations.

**Reveal countdown text (bottom-right):** `47 commits analyzed in 12 repos` (updates live during sync).

**Cluster status strip (bottom):** `Lit: Frontend · Backend · Testing` (lit clusters only, updates live).

**Mobile:** counter + strip stacked at the bottom.

### I.2 — First-ever star cinematic

See `docs/flow.md` Sub-flow B. ~8s. Cluster outlines slightly brighten → first star sparks (with 0.3s stagger if multiple) → strip copy `Your first star lit: Docker` (or `Your first stars: ...`) followed by `Your constellation has begun` → long glow on first stars. Cannot be skipped.

After cinematic: only the clusters containing first stars retain permanent activation; other five clusters revert to dim.

### I.3 — Stage-up moment

See `docs/flow.md` Sub-flow A. Stage-up is the moment cluster color **becomes visible** on the canvas (steady state has no colored aura — see §C and `docs/adr.md` ADR-61). Sequence: aura fades in at the cluster center → radius expands 10–20% over 1.5s → one ripple wave at full radius → aura settles back to the "event-active" steady level (still cluster color, not dim) → fades out unless a follow-on trigger (drawer-selected or hover) keeps it active. Multiple cluster stage-ups: 0.3s stagger.

**Reduced-motion preference (`prefers-reduced-motion: reduce`):** all cinematics (I.1, I.2, I.3) skip animation and snap to final state instantly. Spark/ripple/pulse/aura-expansion are disabled.

---

## J — Email templates

**Phase 2 deferred:** Weekly recap email templates are retained as the re-enable spec, but MVP launch does not expose the Settings Email recap control or register recap send/generate Inngest functions unless `ENABLE_EMAIL_RECAPS=1`.

All emails are dark-sky themed (Gmail dark mode looks correct without inversion). Max width 600px. Footer: `Unsubscribe · Privacy · Settings`. Image-blocked clients: alt text `Your DevAstra constellation, week of May 10`.

### J.1 — Weekly recap active

- **Subject:** dynamic, priority `stage-up > new star > brightest cluster`.
- **Preview text:** constellation change first, activity counts last (e.g. `Backend expanded · 2 new stars · 12 commits`).
- **Hero:** full constellation OG image with changed stars getting brighter glow + changed cluster aura intensified + small top-right stat strip `+2 stars · Backend +18%`.
- **3 fixed slots:**
  - Slot 1: stage-up bundle (`Backend cluster expanded`) or brightest cluster line (`Backend brightened most this week`).
  - Slot 2: new stars list (1–3 names inline, 4+ collapses to `+N`). No new stars → `2 stars brightened — TypeScript, React`.
  - Slot 3: activity totals (`5 active days · 12 commits · 3 PRs shipped`).
- **CTA:** `See what's new →`

### J.2 — Weekly recap empty

- **Subject:** `Your sky — this week` (static).
- **Preview text:** `Steady week — your constellation is the same.`
- **Hero:** last-known constellation, static (no glow, no stat strip).
- **Body:** single line `Steady week — your constellation is the same.`
- **CTA:** `See your sky →`
- **Sent only for the first empty week.** Skipped after 2 consecutive empty weeks.

### J.3 — First-week recap

- **Subject:** `Your first week on DevAstra`.
- **Body:** standard 3-slot structure with the user's first star explicitly highlighted (`Your first star: Docker`).
- **Partial week empty case:** body `Welcome — push a commit to begin your constellation.` + CTA `See your sky →`.

---

## M — Missing screens (legal, recovery, transitions)

### M1.1 — Privacy Policy (`/privacy`)

**Layout:**

- Dim sky background with a light-colored document card (dark text on white, readable for long-form).
- Header: same as Landing (logo + Sign in CTA).
- Single column, sections top to bottom, no sidebar TOC.
- `Last updated: {date}` at the top.
- Content sourced from `docs/legal/privacy.md` rendered as markdown.

### M1.2 — Terms of Service (`/terms`)

Same layout as Privacy Policy. Content sourced from `docs/legal/terms.md`.

### M2 — Generic 500 error page (`app/error.tsx`)

**Layout:**

- Dim sky.
- Copy: `Something went wrong on our end. We've been notified. Please try again in a moment.`
- Buttons: `Retry` (page reload) · `Home` (`/`).

### M3 — Sign-out state

No dedicated page. After Avatar dropdown → Sign out:

- Redirect to `/?signed_out=true`.
- Landing page detects the param and shows toast `Signed out`.

### M4 — Email unsubscribe landing (`/unsubscribe?token={jwt}`)

**Purpose:** one-click unsubscribe from weekly recap emails. Works without login.

**Phase 2 deferred:** This page and API remain available for existing/test recap links, but no new weekly recap emails are sent during MVP launch unless `ENABLE_EMAIL_RECAPS=1`.

**Behavior on GET with valid token:**

- Server action (idempotent via signed token) sets `users.email_recap_enabled = false`.
- Render confirmation page (M4.1).

**Behavior on invalid / expired token:**

- Render error page (M4.2).

**Important:** the unsubscribe mutation runs only on POST (server action) to prevent GET prefetch from accidentally unsubscribing. The page issues a POST under the hood; the URL itself is a confirmation surface.

### M4.1 — Unsubscribe success

- Dim sky.
- Copy heading: `You've been unsubscribed from weekly recaps.`
- Sub-line: `You'll no longer receive Sunday recap emails. Your constellation and account remain.`
- Inline action: `Undo →` (visible for 30s, then fades).
- Below: `Sign in to manage your email preferences →`

### M4.2 — Unsubscribe expired/invalid

- Dim sky.
- Copy: `This unsubscribe link has expired. Sign in to manage your email preferences.`
- Action: `Sign in →` link.

### M5 — Repo selection → first reveal transition

Brief fade transition between submit and first reveal. No additional copy on this transition itself — pre-reveal screen already shows `Analyzing your repos...`.

**Edge case:** if the user navigates away during this transition and returns to `/`, the in-progress sync continues. The page surfaces the build-in-progress overlay until the `sync_jobs` row reaches `completed` or `failed`.
