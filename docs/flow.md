# User Flow — DevAstra

**Scope of this doc:** step-by-step user journeys for each primary use case, including state transitions, error branches, and the transient cinematic moments that overlay the main constellation. Screen-by-screen field/action specs live in `docs/screens.md`. Entity names reference `docs/data-schema.md`. Architectural rationale lives in `docs/adr.md`.

## Cross-cutting principles (apply to every flow)

These emerged from 117 flow + sub-flow decisions and govern every implementation choice:

1. **Visual change reflects data change.** New star → spark. Brightened star → glow halo. Stage-up → cluster aura expansion + one-time ripple. No toast for unlocks. No "Level up!" or "+XP" framing.
2. **Sparse / empty users are never framed as deficient.** "Every constellation starts here." Sparse owners on public profile are rendered identically, not flagged. The renderer may use subtle sparse-mode framing and foreground emphasis, but it never invents stars or implies activity that does not exist.
3. **System limits are stated honestly.** "GitHub can take a few minutes to index commits." "Skipped after 2 quiet weeks."
4. **The constellation never disappears.** Sync failure, GitHub disconnect, token expiry, system outage — the cached constellation is always visible. Banners surface state without blocking the canvas.
5. **Share links must survive forever.** Username changes 301-redirect old paths to new ones permanently (`docs/adr.md` ADR-30). Old usernames are reserved permanently.
6. **Free is the entire MVP.** Conversion CTA copy is always `Create yours, free →`. No paid framing anywhere.
7. **Cluster click = full drawer; star click = focused drawer.** Single mental model. Hover shows tooltip on desktop only; mobile tap = drawer.
8. **Rare star labels are about the star, not the person.** "Lit by 3% of users" is allowed. "You are top 3%" is forbidden.

## Flow 1 — First-time activation

**Entry trigger:** unauthenticated visitor lands on `/`.

1. **Landing (`/`)** — Hero shows the founder's real constellation (`docs/screens.md` §Landing) with a one-shot reveal animation that plays once per visitor every 7 days. Headline `A developer skill constellation that lights up as you code.` Sub-line `Connect GitHub. See what you've built, brighter every week.` Single CTA `Sign in with GitHub`. Below the fold: a `See others' constellations →` link to a curated 3-card gallery of sample public profiles. Footer: Privacy · Terms · GitHub repo. No top nav.
2. **OAuth consent** — Redirect to GitHub. User approves `read:user` + `user:email`. On cancel: redirect to `/?auth_error=oauth_failed` with neutral copy `Connection was cancelled — try again?`.
3. **Callback (`/auth/callback`)** — Brand-themed dim sky with `Connecting your GitHub...` and six dim cluster outlines fading in to preview the next screen. Supabase Auth resolves session; trigger creates `users` row (`docs/data-schema.md` §Users). If callback exceeds 5 seconds, fallback copy `Taking longer than expected. Refresh to try again →` appears. On failure: redirect to `/` with error param.
4. **Repo selection (`/onboarding/repos`)** — Page header: `Pick your repos` + helper `These repositories will shape your constellation. All are included by default.` Loading state: skeleton rows. Each row: name + primary-language icon + last-update date + 90-day commit count + 2–3 cluster-color dots showing contributing domains. Default: all checked; sort: most recent activity first; search box appears at ≥20 repos. Controls: `Select all` / `Deselect all`; counter `Selected N of M repos`. Primary CTA `Build my constellation`; secondary `Start with empty sky`. If GitHub API fails: full-page `Couldn't load your repos. Try again?`.
5. **Initial sync trigger** — A `sync_jobs` row is created synchronously in `pending` state, then Inngest event `sync/initial.requested` fires with `user_id` + selected repo IDs. Initial sync refreshes selected repo metadata by GitHub node ID, fetches the last 1 year of activity, then runs a bounded historical bootstrap for selected repos with no recent activity so older-but-important repos can still seed the first constellation. Page fade-transitions to `/`, where the constellation shows a build-in-progress overlay until the job completes.
6. **First reveal** — Starts only after the initial sync job completes. Six cluster outlines fade in (dim). Counter bottom-right: `47 commits analyzed in 12 repos`. Bottom strip: `Lit: Frontend · Backend · Testing` (active clusters only). Stars appear in Realtime insert order with 0.1s stagger, each rendered as a _spark_ (small dot → brief plus-shape flash → settle). Connection lines (MST per cluster, neutral gray, low opacity) fade in after both endpoints are lit. Cluster labels fade in when each cluster's first star lights. Minimum total reveal duration: 12s. Maximum: 30s, after which remaining stars batch fade-in over 0.5s. Settling pulse on all stars + gentle attention cue (pulse + label highlight) on the brightest cluster, then a one-time `Click to explore` hint anchored to that cluster's label, auto-dismissed after 5s. Users may click stars or cluster labels during the reveal — the animation continues in the background.
7. **Post-reveal exploration** — Clicking a cluster label opens the cluster drawer (`docs/screens.md` §Cluster drawer). Clicking a star opens the same drawer with that star's row highlighted, auto-scrolled, and its `Why is this lit?` expansion automatically opened. Star hover (desktop only, 200ms delay) shows a tooltip: `tech name · brightness · first lit date`. The `cluster_click_hint_seen` flag is set when the user opens any drawer.
8. **First share moment** — After the first drawer close, the top-right Share button pulses once (`share_hint_seen` flag set after this pulse). Click opens the Share modal (`docs/screens.md` §Share modal): current dark-sky OG preview → public toggle + URL/copy/preview → share targets (X / LinkedIn / Copy link / Download PNG + native share on mobile). X pre-filled post: `My GitHub activity, as a constellation. {url}`. X and LinkedIn share the public profile URL and rely on platform link-preview cards for the image; they do not upload the generated PNG as a native image attachment. Share buttons are disabled while `is_public = false`; toggling on inlines the URL + Copy + Preview affordance. On share click: modal closes + brief toast `Shared!`.

**Failure branches:**

- OAuth fail → `/?auth_error=oauth_failed`.
- Zero public repos → repo selection shows top half: six dim cluster outlines; bottom half: copy `No public repos yet. Push your first public repo to light up your sky.` + GitHub link + `Skip & Build empty sky →` secondary action.
- Start with empty sky → main constellation: six cluster outlines + dark sky + one-time persistent hint `Your constellation begins when you push code.` (`cluster_click_hint_seen` does not auto-fire).
- Sync fails (GitHub 5xx, rate limit, network) → `sync_jobs.status='failed'`. Bottom banner `Sync failed. Your constellation is safe.` + Retry button. Inngest retries with exponential backoff up to 5 attempts.

## Flow 2 — Returning user via weekly recap

**Phase 2 deferred:** Weekly recap email is dormant for MVP launch. The Settings Email recap section is hidden, weekly recap Inngest generate/send functions are not registered unless `ENABLE_EMAIL_RECAPS=1`, and this flow remains the re-enable specification after Resend domain verification and deliverability checks pass.

**Entry trigger:** user receives weekly recap email (Sunday 18:00 user local time; generated Sunday 09:00 UTC by `recap/weekly.generated` Inngest cron).

1. **Email arrives.** Subject is active-week dynamic with priority _stage-up > new star > brightest cluster_:
   - Stage-up present: `Backend cluster expanded`
   - New stars (1): `Docker is new this week`
   - New stars (2+): `3 new stars this week`
   - Otherwise: `Backend brightened` (most-grown cluster)
   - Empty week subject (static): `Your sky — this week`
   - First week subject: `Your first week on DevAstra`
     Preview text always orders constellation change before activity counts: `Backend expanded · 2 new stars · 12 commits`.
2. **Email body** — Hero is a full-constellation OG image (1200×630) with this week's changed stars getting a brighter glow + the changed cluster's aura intensified. A small top-right stat strip overlays the image: `+2 stars · Backend +18%`. Three fixed slots follow:
   - **Slot 1:** stage-up bundle (if any) — `Backend cluster expanded`; otherwise the brightest cluster line — `Backend brightened most this week`.
   - **Slot 2:** new stars — 1–3 names inline (`Docker, TypeScript, Playwright are new this week`); 4+ collapses (`4 new stars this week — Docker, TypeScript, Playwright, +1`); none → `2 stars brightened — TypeScript, React`.
   - **Slot 3:** activity totals — `5 active days · 12 commits · 3 PRs shipped`. Empty fields are omitted naturally.
     CTA is dynamic: active week `See what's new →` / empty week `See your sky →`. Email background is dark sky tone (consistent with Gmail dark mode). Image alt text: `Your DevAstra constellation, week of May 10`. Footer: Unsubscribe · Privacy · Settings.
3. **Empty-week variant** — Subject `Your sky — this week`. Hero: last-known constellation rendered statically (no glow / no stat strip). Body: single line `Steady week — your constellation is the same.` + CTA `See your sky →`. The email is sent for the first empty week; **skipped after 2 consecutive empty weeks** (`docs/adr.md` ADR-32). Activity resumes the cycle.
4. **First-week variant** — Sent on the first Sunday after signup, even with partial week. Subject `Your first week on DevAstra`. Body: standard 3-slot structure with the user's first star explicitly highlighted (e.g. `Your first star: Docker`). If the partial week has zero activity: body `Welcome — push a commit to begin your constellation.` + CTA.
5. **Click-through (`/?from=recap&week=2026-W19`)** — Main constellation loads from server-prerendered state (no full reveal). Only the changed stars (1–5 spark animations over 3–5s). Top header-area strip: `This week: 2 new stars · Backend +18%` + dismiss X. The most-changed cluster pulses once. Stage-up takes priority in the strip: `Backend cluster expanded · 2 stars brightened`.
6. **Diff visualization** — New star: `+` badge + weekly spark + `New this week` in tooltip. Brightened star: glow halo + `Brightened this week`. Stage-up cluster: aura radius 10–20% expansion + intensity increase + one ripple (1.5s). Diff persists 1 week (until the next Sunday recap); a second visit during that week auto-hides the strip but preserves the star-level glow/spark.
7. **Manual refresh during the same week** — Newly discovered changes are folded into the same "this week" diff layer (single timeline; no double-counting).

**Failure branches:**

- 3 consecutive bounces → `users.email_recap_enabled` auto-set to `false` (logged via `email_sends.bounced`).
- Zero activity for 2 consecutive weeks → email skipped; resumes when activity returns.

## Flow 3 — Public profile visitor (conversion funnel)

**Entry trigger:** unauthenticated visitor clicks `devastra.app/{username}` link from social media. Most traffic is mobile.

1. **Profile page (`/{username}`)** — Resolved server-side: first check current `users.display_username`; if absent, check `username_history.old_username` → 301 redirect to current. ISR 1h revalidation + on-demand revalidate on sync completion, public toggle, username change, and `OG_RENDER_VERSION` bump. Layout: dim sky background, constellation as hero, top-left compact identity block (avatar / `@username` / `12 stars lit · 4 clusters active`). A small header text `Viewing {username}'s constellation` denotes visitor mode. Top header is minimal (text brand only, no actions). On visitor's first time per session, a 3–5s short reveal of the constellation plays.
2. **Sticky bottom CTA** — Always visible, full-width bar: `Create yours, free →`. Pulses once after the visitor opens their first drawer.
3. **Star / cluster interaction** — Identical drawer to owner view (cluster summary → lit stars → `Why is this lit?` per star → recent PRs → visitor footer `Want to see yours? Create yours, free →`). Star tooltip on hover shows product language only (`brightness`, `first lit`), never raw weight. Repo / PR links in drawer open in new tab.
4. **Owner self-view** — When the owner visits their own public URL, a narrow strip below the header reads `This is how others see your constellation` + `← Back to my private view`. Sticky CTA is hidden. The constellation is shown identically to visitors.
5. **Logged-in visitor (different user)** — Header right shows `Back to my sky →`. Sticky CTA is hidden. No other differentiation.
6. **Conversion** — CTA click → `/?from=profile&inviter={username}` → landing → standard Flow 1.

**Failure branches:**

- `users.is_public = false` → render `{username}'s sky is private` (with username displayed) on a dim-sky page; constellation outline is shown as an _unlit/locked_ shape. CTAs: `Create yours, free →` and `Browse other constellations →`.
- Username not found in either `users` or `username_history` → 404 page with `No constellation at this address` + same two CTAs.
- Rate limit exceeded (60 req/min/IP non-crawler) → dim-sky 429 page `Too many requests — try again in a moment` + manual retry button.

## Flow 4 — "Just shipped" refresh

**Entry trigger:** user pushes a commit and returns to `/` expecting to see change. Or the user uses the Refresh button to check for updates.

1. **Refresh button** — Top-right; four visual states: idle (`Refresh`) → queued (`Queued...`) → running (`Syncing...`) → cooldown (`Refresh (Nm)`). On mobile, pull-to-refresh is enabled on the main constellation only (not in settings / drawers).
2. **Dispatch and gatekeeping** — The route first verifies the GitHub connection, repairs any stale active sync job for the user, blocks duplicate `pending|running` jobs, and enforces the 5-minute cooldown from the latest `started_at`. A successful manual refresh creates a concrete `sync_jobs` row in `pending` state before dispatching `sync/manual.requested` with that `job_id`.
3. **Cooldown** — If `MAX(sync_jobs.started_at) > NOW() - 5min`, the button shows a countdown only — no toast. Click is disabled, so no network request is sent from the button.
4. **Sync in progress** — Refresh button shows `Queued...` until the job starts, then `Syncing...`. Bottom-right floating text: `Looking for new activity...`. After 30s: `Still syncing — this can take a moment for active accounts.` The constellation remains fully interactive; an open drawer auto-updates with changed rows highlighted. Realtime is the primary completion path; while a manual sync is active, a lightweight `/api/sync/latest-job` polling fallback clears missed updates without duplicating the initial/backfill build overlay polling.
5. **Sync result — changes** — Top header-area strip surfaces the diff: `Backend cluster expanded · 2 stars brightened` (stage-up takes priority over star counts). The most-changed cluster pulses once. New stars spark; brightened stars get a glow halo. No toast for unlocks. The diff persists 1 week (folded into the same "this week" diff layer as the weekly recap).
6. **Sync result — no changes** — Refresh button leaves the in-progress state and enters cooldown if applicable. Status text changes to `No new activity yet · GitHub can take a few minutes to index commits.` (honest disclosure of GitHub's indexing delay — `docs/adr.md` ADR-34). The user is not penalized for refreshing too soon.
7. **Sync failure (server error / network)** — `sync_jobs.status = 'failed'`. Bottom banner `Sync failed. Your constellation is safe.` + Retry button. Banner is dismissible via X. The cached constellation stays visible. If the Inngest dispatch itself fails, the pre-created manual job is immediately marked failed and the button returns to idle instead of staying stuck.
8. **Token missing / expired / refresh failed** — Missing GitHub connection returns `github_disconnected` without creating or dispatching a sync job, and the button remains idle. Expired or unusable tokens use the existing reconnect banner: `Your GitHub connection expired — Reconnect` + Reconnect button. The cached constellation stays visible. Reconnect triggers GitHub OAuth flow (re-auth, not re-signup).

**No automatic refresh.** Tab focus does not trigger sync. Users control the refresh cadence.

**Anxiety pattern guard.** No artificial limits beyond the 5-minute cooldown. The honest indexing-delay copy (step 5) educates users that immediate refresh after push is mostly noise.

## Flow 5 — Settings management

**Entry trigger:** user clicks avatar dropdown → `Settings`, or navigates to `/settings`. The avatar dropdown contains `Settings · My public profile (if is_public) · Sign out`. Sign out is dropdown-only.

The settings page is a single long page, max 800px centered, single column on mobile. Header: `← Back` link + page title `Settings` + avatar dropdown. Sections are separated by divider lines (no card backgrounds).

Section order, top to bottom:

1. **Account info** (read-only) — compact: avatar + `@username` on one line, email on the next.
2. **Public profile** — toggle. When `is_public = true`, expansion below toggle: `Your constellation is public · devastra.app/{username} [Copy] [Preview →]`. Toggling OFF: immediate apply + toast `Your constellation is now private. Existing shared links will show a private placeholder.` Toggling ON: immediate apply with the URL/Copy/Preview inline expansion. Both update the path via `revalidatePath('/${username}')`.
3. **Timezone** — IANA dropdown, default detected from browser. MVP sub-text: `Dates are shown in this timezone.` Auto-save on change. When weekly recap email is re-enabled in Phase 2, this line becomes `Your weekly recap arrives Sunday at 6 PM in this timezone.`
4. **Username** — text input with inline live validation (length 2–30, regex `/^[a-z0-9-_]+$/`, reserved name check, collision check). Live URL preview: `devastra.app/{new_username}`. On save: confirmation note `Anyone with your old URL devastra.app/{old} will be redirected to your new one.` Old username is written to `username_history` and reserved permanently. Validation errors:
   - <2 chars → `At least 2 characters`
   - > 30 chars → `Up to 30 characters`
   - Invalid chars → `Only lowercase letters, numbers, hyphens, and underscores`
   - Reserved → `This name is reserved`
   - Collision → `This name is taken`
5. **Included repos** — default collapsed section. The collapsed state reads only the repo summary count; expanding lazy-loads the full `repositories` list so Settings remains quick to open. Toggling repos and pressing Save first opens a pre-save confirmation note. Confirming creates a `sync_jobs` row in `pending` state, dispatches `sync/backfill.requested` with the fast rebuild path, and returns to the main constellation. The existing constellation is subtly dimmed/blurred behind a bottom-right build-in-progress panel until saved activity and project manifests have both been checked, so the user never mistakes language-only intermediate data for the final result. The fast path refreshes selected repo metadata by GitHub node ID, reuses parsed dependency cache only when the source `pushed_at` value proves the repo has not changed, skips repeat historical scans only when the same `pushed_at` value proves a quiet repo was already checked, and skips repeat recent commit-list REST calls only when the same `pushed_at` value proves authored commits were already cached. If selected repos have no saved matching activity, the job waits for GitHub historical bootstrap before completing. Newly discovered stars/connections animate into the constellation when the completed build refreshes.
6. **Danger zone** — red border + heading `Danger zone`. Two sub-sections, Disconnect above and Delete below.
   - **Disconnect GitHub** — confirm modal: heading `Disconnect GitHub?` + body `Your constellation stays. Public profile becomes private. Reconnect anytime.` Buttons: Cancel (text link, left) + Disconnect (red filled, right). Dismiss via X / Cancel / ESC; outside-click is disabled. On confirm: `users.github_access_token_enc = NULL`, `is_public = false`. Mobile: centered modal. The main page surfaces a dismissible banner `GitHub disconnected — reconnect to sync new activity` + Reconnect button, and the settings page reveals a Reconnect entry point.
   - **Delete account** — confirm modal: heading `Delete your account` + body `This cannot be undone. We will delete:` followed by bullets (your constellation / all weekly recaps / your public profile / all account data). Input labeled `Type your username to confirm: {username}`. Delete button is enabled only when input exactly matches. Button copy: `Permanently delete` (red filled). Dismiss via X / Cancel / ESC; outside-click is disabled. Mobile: full-screen modal. On confirm: hard delete via `auth.users` cascade. After confirm: page `/account-deleted` with body `Thanks for trying DevAstra. Your account has been deleted.` + `Go to landing now →`. Auto-redirect to `/` after 5s.

**All mutations** are Next.js Server Actions with Zod input validation. Errors surface as inline messages or toast.

**Save model:** public toggle and timezone auto-save; complex forms (username, included repos) require explicit Save.

## Sub-flow A — Stage-up moment

Triggered when `territories.total_weight` crosses a threshold from `STAGE_THRESHOLDS = [0, 50, 200, 500, 1500]`.

- **Copy:** `Backend cluster expanded` (never `Level up!`). The word `Stage 2` may appear as secondary info in the drawer header but is never the primary surface.
- **Visual:** cluster aura radius expands 10–20% and intensity increases; one ripple wave (1.5s) emits from cluster center outward.
- **Multiple cluster stage-ups in same sync:** 0.3s stagger between cluster ripples.
- **Manual refresh strip integration:** stage-up takes priority over star count in the top strip — `Backend cluster expanded · 2 stars brightened`.
- **Weekly recap:** stage-up bundle occupies slot 1 of the 3-slot body when present.
- **Drawer indicator:** header gains `· Recently expanded` suffix (e.g. `Backend · Active this week · Recently expanded`).
- **First-ever star + stage-up combo:** first-ever cinematic plays first, then stage-up moment fires sequentially (~13–15s combined).

## Sub-flow B — First-ever star cinematic

Triggered when `lit_star_count` transitions 0 → ≥1 within a single sync. Cinematic is gated by the `users.first_star_cinematic_pending` flag (set during sync) rather than inferred from current state — this protects existing users from spurious triggers when the feature is deployed.

1. **Sync detects transition.** Backend sets `first_star_cinematic_pending = true` on `users` row.
2. **User's next visit to `/`** — the client checks the flag and runs the cinematic in the main canvas. Total duration ~8s. Sequence:
   - Six cluster outlines slightly brighten.
   - Newly lit star sparks; if multiple stars lit at once, they cascade with 0.3s stagger.
   - Copy appears in the bottom strip area: `Your first star lit: Docker` (single) or `Your first stars: Docker, React` (multiple) followed by `Your constellation has begun`.
   - A long glow stays on the first star(s) after the spark settles.
3. **Cluster activation:** only the clusters containing the first stars retain permanent activation (the other five clusters revert to dim outline after the cinematic).
4. **Completion:** `first_star_cinematic_pending = false`, `first_star_cinematic_seen = true`. Cannot be dismissed or skipped — 8s is short enough.
5. **No share push.** The Share button does NOT pulse after this cinematic — the moment is emotional reward only.

If a user signs up with zero public repos and later pushes their first commit, the first-ever cinematic supersedes a standard first-time reveal (`docs/adr.md` ADR-38).

## Sub-flow C — Long absence return (≥4 weeks)

Triggered when `NOW() - users.last_login_at > 28 days` on the next authenticated `/` page render.

- **Welcome strip** (replaces this-week strip for the duration of the visit): `Welcome back — your constellation has new activity` + `Since your last visit: 3 stars lit · Backend expanded` + dismiss X. The most-changed cluster pulses once.
- **No cumulative recap dump.** Activity from skipped weeks is not surfaced as a digest; only the diff since the previous `last_login_at` is shown.
- **Dismiss behavior:** dismissing hides the strip for that visit. If the user returns ≥4 weeks later again, the welcome-back overlay fires again.
- **Mental model boundary:** `weekly recap = this week` (Flow 2), `welcome back = since last visit` (this sub-flow), `main constellation = current state always`.

## Sub-flow D — Misclassification feedback

Trigger: currently hidden from the cluster drawer while the correction entrypoint is being redesigned. The backend action and modal flow remain available for a future low-friction feedback surface.

1. **Modal overlay** opens on top of the drawer. Heading: `Help us understand. What looks off?`
2. **Form fields:** category select (`Wrong category` / `Shouldn't be lit` / `Activity not mine` / `Other`) + optional textarea.
3. **Footer disclaimer:** `We may use this to improve classification. We won't email you about this submission.`
4. **Rate limit:** server action checks the user has submitted ≤5 entries in the past 24h. If exceeded, return inline error: `You've reached today's feedback limit. Thanks!`
5. **On submit:** insert row into `misclassification_feedback` table with `user_id`, `tech_key`, `territory_type`, `related_repo_id` (nullable), `category`, optional `note`, `created_at`. Modal closes; toast `Thanks. We'll look into it.`
6. **No echo of submitted feedback** to the user — feedback is forward-only (`docs/data-schema.md` §misclassification_feedback policy).
7. The user cannot directly override classification in MVP. Repo exclusion (Flow 5 §Included repos) is the available adjustment.

## Sub-flow E — Onboarding hint lifecycle

Three boolean flags on `users` track hint exposure: `cluster_click_hint_seen`, `share_hint_seen`, `recap_diff_hint_seen`. All persist forever once set.

- **Cluster click hint** (`Click to explore` / `Tap to explore`): appears next to the brightest cluster's label after the first-time reveal completes. Auto-dismisses after 5s. Appears at most 2 times across sessions. Opening any drawer permanently sets the flag.
- **Share button pulse** (`share_hint_seen`): one pulse after the first drawer close. Fires once total.
- **Recap diff hint** (`recap_diff_hint_seen`): when entering via `/?from=recap`, a small floating bubble near the brightest changed cluster: `See what's new in {Cluster}`. Auto-dismisses on target click.

Hint dismissal is by _action_, not by X button — there is no manual dismiss UI.

## Sub-flow F — Cross-device / multi-tab

- **Concurrent sync prevention:** `sync_jobs.status = 'pending' | 'running'` row blocks duplicate dispatches. Second tab's refresh button reflects the existing queued/running job instead of starting a duplicate. Stale active jobs older than 30 minutes are failed before the refresh gate is evaluated.
- **Settings change propagation:** changes apply on next page load / next Realtime event on the relevant tables. Live cross-device propagation is v0.2.
- **Sensitive state (public toggle, disconnect, delete):** server-side authoritative; subsequent reads from any tab see the new state immediately.

## Sub-flow G — System status banner

Triggered when an admin (founder) inserts a row into `system_messages` table with `active = true`. No UI for admin write — `system_messages` is written via Supabase dashboard SQL.

- **Banner location:** top overlay strip below the floating header controls, same strip area as welcome-back and disconnected banners.
- **Default copy:** `Sync is delayed right now. Your constellation is safe.` Admin may override the message column for incident-specific copy.
- **Dismissible.** User-dismissed for the session only; reappears in new sessions until the row is set `active = false`.
- **Multi-banner priority** (top strip): `disconnected` > `system status` > `welcome back` > `this-week diff`. Only the highest-priority strip is shown; the bottom sync-failed banner is a separate region and may co-exist.

## Sub-flow H — Watermark / share artifacts

- **OG image (1200×630)** uses the current dark-sky static renderer, not a captured WebGL screenshot: deterministic field/mid-star layers, current lit tech stars, current labels, current background, and share-tuned static connection strokes. It carries a small `devastra.app/{username}` watermark in the bottom-right corner. Style: light gray, low-contrast, single line.
- **Public profile** does NOT add additional watermark — the sticky CTA serves that role.
- **Download PNG** is high-resolution 2400×1260 with the same watermark, filename `devastra-{username}-{date}.png`. Standard OG cards remain 1200×630 for social metadata and email compatibility.
- **Social preview cards** use the public profile page's absolute `og:url`, `og:image`, and `twitter:image` metadata. The public app origin comes from `NEXT_PUBLIC_APP_URL` or `NEXT_PUBLIC_BASE_URL`; if that origin is not externally resolvable, X / LinkedIn cannot scrape the image.
- **Landing/demo OG** (when no username is involved) shows `devastra.app` only.

## Sub-flow I — Persona walkthroughs

Pre-launch QA checklist; not an implementation flow. Run all five flows end-to-end through each persona:

1. **Student (sparse user)** — 3 repos, course homework, <20 commits/month.
2. **Junior (active weekly)** — 10 repos, daily activity, occasional weekend.
3. **Career switcher (long inactive)** — 60 repos, last active 6 months ago.
4. **OSS maintainer** — 50 repos, many PRs to others' repos; attribution may be imperfect (MVP does not over-optimize for this case).

## Sub-flow J — GDPR / privacy flows

- **Delete account** is the user-facing right-to-be-forgotten path (Flow 5 §Danger zone). Hard delete; no soft-delete window.
- **Data export** is not in the UI. Privacy Policy states: `Email privacy@devastra.app for data export. We will respond within 30 days.` Founder runs an internal SQL script to produce a zip on request.
- **Unsubscribe link** behavior is retained for Phase 2 recap emails. Each footer link leads to `/unsubscribe?token={jwt}` — token includes `user_id`, `email_type`, version claim. One-click action sets `email_recap_enabled = false` and shows post-unsubscribe page (`docs/screens.md` §Unsubscribe page) with 30s `Undo →` action. Token never expires (so old emails still work) but supports incident-time revocation via version bump (`docs/adr.md` ADR-48).
- **Sub-processors disclosed in Privacy Policy:** Supabase, Vercel, Inngest, Resend, Sentry, PostHog, GitHub. Each with one-line purpose.
- **Cookie consent:** PostHog runs in cookieless mode (`docs/adr.md` ADR-60); no banner.
- **PII scrubbing:** PostHog masks all inputs and URL `/{username}` paths; Sentry `beforeSend` strips token / authorization / cookie patterns automatically.

## Sub-flow K — Auth edge cases

Always preserve the cached constellation. _"Sync can die, but the constellation cannot disappear."_ (`docs/adr.md` ADR-43.)

- **GitHub OAuth permission revoked externally** → next sync fails with 401 → token cleared → banner `GitHub disconnected — reconnect to sync new activity` + Reconnect button.
- **Token expired and refresh failed** → same banner.
- **GitHub account suspended / inaccessible** → sync fails with 403 or 404 → bottom banner `Sync failed. Your constellation is safe.` + Retry. Token state preserved; user may try later or disconnect/reconnect manually.
- **Cron sync failures (silent background)** → not surfaced to user unless visible result (e.g. stale `last_synced_at` triggers the soft "stale" color change on the header timestamp).
