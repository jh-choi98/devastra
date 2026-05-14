# Screens — DevAstra

**Scope of this doc:** every distinct screen and overlay surface. Each entry lists *purpose · info displayed · actions · state variations · mobile/desktop deltas*. Use this with `docs/flow.md` (transitions) and `docs/data-schema.md` (data shape).

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
- Dim sky + *unlit/locked* constellation outline (six dim cluster outlines + faint star positions but no glow).
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

**Header:** `Pick your repos` + helper `These will form your constellation. You can change this later in settings.`

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

**Bottom counter:** `Selected N of M repos`.

**Single CTA:** `Build my constellation`.

**Special states:**
- **Zero public repos.** Top half: six dim cluster outlines. Bottom half: copy `No public repos yet. Push your first public repo to light up your sky.` + link to GitHub + secondary action `Skip & Build empty sky →`.
- **100+ repos.** Above the list: subtle note `Initial sync may take a few minutes`.
- **Sparse user (3 repos, few commits).** Helper copy below the header: `Every constellation starts here.`
- **GitHub API failure.** Full-page state: `Couldn't load your repos. Try again?` + Retry.

**Submit transition:** fade out → fade in main constellation page; pre-reveal sky already loading.

**Mobile:** single-column stack; sticky search; same content.

---

## C — Main constellation page (authenticated owner, `/`)

**Purpose:** the user's identity surface. Always visible; never blocked.

### Header (top bar)

- **Left:** Logo (star icon + `DevAstra` text; icon-only on narrow mobile) · `Last synced 2h ago` (relative; hover/long-press shows absolute timestamp).
- **Right:** Refresh button · Share button · Avatar dropdown (`Settings · My public profile (if is_public) · Sign out`).

**Refresh button states:**
- Idle: clock-arrow icon.
- Cooldown: countdown text (`4:32`) within button; disabled cursor; tooltip on hover.
- Loading: spinner.

**Share button states:**
- Default: share icon.
- After first drawer close: one pulse animation, then steady.

### Canvas (constellation)

- Background: subtle vertical gradient (top: `#0b1020`, bottom: `#020617`); no decorative particle dots (no ambient noise).
- Six cluster outlines always visible (dim if no stars; brighter if any star is lit).
- Cluster aura: weak radial gradient using cluster color at low opacity. Intensifies on stage-up (with one ripple wave).
- Cluster label: below the cluster, fixed position. Sans-serif, 14–16px, dim white; lit cluster's label is slightly brighter.
- Stars: positioned per `tech-catalog.md` (deterministic per-`tech_key` `{x, y}` within cluster). Color = cluster color. Size and glow scale with weight via layered concentric circles. Hover on desktop: glow + scale 1.1× + tooltip.
- Connection lines: MST among lit stars per cluster. Color: neutral gray `#475569`. Low opacity. Thin. Computed at render time.
- Empty/sparse: clusters with zero lit stars still show the outline (sense of "stars will land here").

**Viewport:** full viewport below the header. No scroll. Pan/zoom disabled (the constellation is identity, not a map).

**Mobile:**
- Header: logo icon + avatar. Refresh/share become floating actions (top-right of canvas).
- Constellation: viewport-aware cluster center positions (separate set from desktop, hardcoded in renderer config).
- Cluster labels: scaled down (no abbreviation — semantic meaning preserved).
- Star tap targets: invisible 24px (minimum) hit area, ideally 44px.
- Pull-to-refresh enabled on main constellation only.
- Safe-area-insets respected (notch / nav bar).

### Star tooltip (desktop hover)

- Trigger: hover 200ms.
- Content: `React · brightest · since Mar 12` (tech name · brightness descriptor · first lit date in product language).
- Position: above the star; auto-flips at edges.
- Dismissal: mouse leave → immediate hide.
- Mobile: not used (tap → drawer).

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
2. **Lit stars list** — each row: star icon (color, size matched to canvas), tech name, brightness descriptor (`brightest` / `bright` / `dim` mapped from weight quintiles), first-lit date, top contributing repo (`from juho/my-app`). Row is clickable → toggles inline `Why is this lit?` expansion. Recently unlocked/brightened rows are visually marked.
3. **`Why is this lit?` expansion (per star, on click)** — detection-rule summary (e.g. `Lit from TypeScript files and React-related paths`), contributing repos list (1–3 repos with the most matches), activity breakdown (`12 commits · 3 PRs`). Inside the expansion: a small `This doesn't look right` button → opens misclassification modal (Sub-flow D).
4. **Recent PRs** — up to 3 recent PR rows (title + repo + relative time). Titles fetched from GitHub API on drawer open; loading state shows skeleton rows. `See more on GitHub →` link.
5. **(Visitor view only) CTA footer** — `Want to see yours? Create yours, free →`.

**Star focus from canvas star click:** the matching star row is highlighted (subtle background tint), auto-scrolled into view, and its `Why is this lit?` expansion is auto-opened.

**Dismissal:** X button, outside click, ESC, mobile swipe-down.

**Owner vs visitor:** identical structure; only the footer CTA differs.

### D.2 — Share modal

**Trigger:** Share button in header.

**Layout (top to bottom):**
1. **Header:** `Share your sky` + close X.
2. **OG preview** — rendered preview of `/api/og/profile/{username}` at 1200×630 ratio.
3. **Public toggle row** — `Make your constellation public at devastra.app/{username}` + toggle.
   - OFF state: share buttons below are disabled (visually grayed).
   - ON state: toggle expansion below — `Your constellation is public · devastra.app/{username} [Copy] [Preview →]`.
4. **Share targets row** — Twitter · LinkedIn · Copy link · Download PNG · (mobile) Native share. Twitter pre-filled tweet: `My GitHub activity, as a constellation. {url}`. Download PNG: filename `devastra-{username}-{date}.png`, dimensions 1200×630, watermark in bottom-right.

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

- **Trigger:** `This doesn't look right` inside drawer's `Why is this lit?` expansion (D.1).
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
- Header: `← Back` link · `Settings` title · avatar dropdown (right).
- Max width 800px, centered.
- Single long page, divider lines between sections (no card backgrounds).
- Mobile: single column scroll.

**Section order (top to bottom):**

1. **Account info** (read-only) — compact: avatar + `@username` on one line, email on the next.
2. **Public profile** — toggle. OFF state: just toggle + helper `Make your constellation public at devastra.app/{username}`. ON state: toggle expansion below with URL · Copy · `Preview →`.
3. **Email recap** — toggle + sub-text `Sundays. Skipped after 2 quiet weeks. Next recap: May 18`.
4. **Timezone** — IANA dropdown, browser default. Sub-text live: `Your weekly recap arrives Sunday at 6 PM in this timezone.` Auto-save on change.
5. **Username change** — text input + inline live validation + URL preview `devastra.app/{new}`. On save success: helper `Anyone with your old URL devastra.app/{old} will be redirected to your new one.`
6. **Included repos** — default *collapsed* section. Expand → search box + list of repos. Each row: name + last activity + 90-day commits + cluster-color dots + toggle + `View on GitHub →`. Save button at bottom of section. On save: pre-save change-summary modal (`These changes will affect your constellation:` + bullet list).
7. **Danger zone** — red border + heading `Danger zone`. Two sub-sections:
   - **Disconnect GitHub** — description + Disconnect button → E.1 modal.
   - **Delete account** — description + Delete button (red text) → E.2 modal.

**Save model:**
- Toggles (public, email recap, timezone): auto-save + toast.
- Username, repos: explicit Save button per section.

**Validation copy:**
- Username <2 chars: `At least 2 characters`
- >30 chars: `Up to 30 characters`
- Invalid chars: `Only lowercase letters, numbers, hyphens, and underscores`
- Reserved name: `This name is reserved`
- Collision: `This name is taken`

---

## G — Public profile page (`/{username}`)

Three render variations: visitor (unauthenticated or other user), owner self-view, logged-in visitor.

### G.1 — Visitor view (unauthenticated)

- **Header:** logo only (minimal, no actions).
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

- Refresh button spinner (header).
- Floating text bottom-right: `Looking for new activity...`
- After 30s: `Still syncing — this can take a moment for active accounts`

### H.2 — Sync-failed banner

- **Location:** bottom of viewport.
- **Copy:** `Sync failed. Your constellation is safe.` + Retry button.
- **Dismissible** via X.

### H.3 — System status banner

- **Location:** top strip (below header).
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

See `docs/flow.md` Sub-flow A. Cluster aura radius expansion 10–20% + intensity increase + one ripple wave (1.5s). Multiple cluster stage-ups: 0.3s stagger.

**Reduced-motion preference (`prefers-reduced-motion: reduce`):** all cinematics (I.1, I.2, I.3) skip animation and snap to final state instantly. Spark/ripple/pulse/aura-expansion are disabled.

---

## J — Email templates

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

**Edge case:** if the user navigates away during this transition and returns to `/`, the in-progress sync continues. The page surfaces `Still building your sky...` status until the sync emits its first batch of `landmarks` rows via Realtime.
