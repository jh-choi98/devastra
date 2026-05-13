# User Flow — DevAtlas

**Scope of this doc:** step-by-step user journeys for each primary use case, including state transitions and error branches. Entity names reference `docs/data-schema.md`. Architectural rationale lives in `docs/adr.md`.

## Flow 1 — First-time activation

Entry trigger: unauthenticated visitor lands on `/`.

1. **Landing** (`/`): animated procedural demo map (lower half) + one-line copy "Turn your GitHub into a developer world map" + single CTA "Sign in with GitHub".
2. **OAuth consent**: redirect to GitHub. User approves `read:user` + `user:email`. On cancel: redirect to `/` with soft "Connection was cancelled — try again?" + retry CTA.
3. **Callback** (`/auth/callback`): Supabase Auth resolves session. Trigger creates `users` row from `auth.users` (see `docs/data-schema.md` §Users). User redirected to `/onboarding/repos` if no `last_event_id`, else `/`.
4. **Repo selection** (`/onboarding/repos`): full-page screen listing user's public repos. Per-row: name + primary language icon + last update date + 90-day commit count. Default: all checked. Sort: most recent activity first. Search box appears if >20 repos. Two CTAs: "Skip & Build" (proceed with all) or "Build my world" (proceed with current selection). On submit: `repositories` rows UPSERTed with `is_included` flag.
5. **Initial sync trigger**: Inngest event `sync/initial.requested` fired with `user_id` + selected repo IDs. Page redirects to `/`.
6. **First reveal** (`/`): screen renders dark ocean. Supabase Realtime subscription opens on `territories` + `landmarks` + `sync_jobs` tables for this user. As sync writes data, islands rise one-by-one with Framer Motion animation. Bottom-left minimal text shows progress ("12 repos analyzed..."). For sparse users: small islands still render + "Your world was just born" copy overlay.
7. **Post-reveal hint**: after `sync_jobs.status='completed'`, camera pans 1 second to largest island; "click me" tooltip appears once. User explores freely afterward.
8. **Detail drawer**: clicking an island slides a 40%-wide right drawer. Drawer shows territory name + stage + 30-day growth + top 2 repos + one-line interpretation. The 3 recent PR titles are fetched on-demand from GitHub API (NOT stored locally — see `docs/adr.md` ADR-9). Drawer closes via X or by clicking map.
9. **Share discovery**: top-right Share button opens a modal with auto-generated OG image preview. If `users.is_public = false`, modal includes "Make it public to share?" toggle. Share buttons: Copy link / Twitter (pre-filled tweet) / LinkedIn / Download PNG.

Failure branches:
- OAuth fail → redirect to `/` with retry message.
- Initial sync fails (GitHub 5xx, rate limit, network) → `sync_jobs.status='failed'`. UI shows cached map (empty on first time) + bottom banner "Sync failed — retry". Inngest retries with exponential backoff up to 5 attempts.
- User has 0 public repos → repo selection screen shows "No public repositories found yet" + CTA to skip; first reveal shows empty ocean with onboarding copy.

## Flow 2 — Returning user via weekly recap

Entry trigger: user receives weekly recap email (delivered Sunday 18:00 their local time; generated Sunday 09:00 UTC by `recap/weekly.generated` Inngest cron).

1. **Email contents**: subject "Your DevAtlas — this week". Body: OG image hero (1200×630 map snapshot for that week's `weekly_recaps` row) + 3 highlights ("Backend Fortress grew 18%", "New landmark: Rust Bastion", "5 active days · 3 PRs shipped") + CTA "See your full world →".
2. **Empty-week variant**: same hero (previous map) + softer copy ("Steady week — see you next Sunday") + same CTA. Sent unless `users.email_recap_enabled = false`.
3. **Click-through** → `/`: same authenticated map view, but the reveal animation is a 3-second short version (not full 30-60s cinematic — that runs only on first lifetime visit, gated by `users.last_login_at`).
4. **Diff visualization**: islands grown since previous `weekly_recaps.week_start` show a glow effect and "+18% this week" badge. Source: comparing current `territories.total_weight` against previous recap's snapshot.
5. **Same actions as Flow 1 step 8 onward** — drawer, share, etc.

Failure branches:
- Email bounces 3× consecutively → `users.email_recap_enabled` auto-disabled (logged in `email_sends`).
- User has 0 activity since last recap → empty-week variant sent.

## Flow 3 — Public profile visitor (conversion funnel)

Entry trigger: unauthenticated visitor clicks `devatlas.app/{username}` link from social media.

1. **Profile page** (`/{username}`): server-rendered via ISR (1h revalidation, on-demand revalidate on sync completion + public toggle + username change). If `users.is_public = false` or username not found → "This DevAtlas is private" screen + "Create your own DevAtlas" CTA. If found and public: render same interactive map as owner sees, but without Share, Refresh, or Settings access.
2. **Sticky CTA**: bottom of viewport shows persistent "Get your own DevAtlas →" bar throughout scroll.
3. **Drawer interaction**: same drawer as Flow 1 step 8 — clicking islands works, GitHub URL links work, but no edit affordances.
4. **Conversion**: clicking CTA → redirect to `/` (landing) → Flow 1 begins for this visitor.

Failure branches:
- Username does not exist → 404 with DevAtlas-voiced copy ("This land doesn't exist yet") + home link.
- Visitor abuses public profile (>60 req/min/IP) → rate limited by Vercel Edge Middleware with 429.

## Flow 4 — "Just shipped" refresh

Entry trigger: user pushes a commit, returns to `/`, sees stale map.

1. **Refresh click**: top-right Refresh button. Click handler checks last `sync_jobs` row: if `started_at < NOW() - 5 minutes`, dispatch `sync/manual.requested` Inngest event; otherwise show toast "Refresh available in N minutes".
2. **Sync indicator**: top-right shows "Syncing..." spinner. Map remains interactive (no blocking overlay). Job processes via same path as Flow 1 step 6, but only incremental delta (events since `users.last_event_id`).
3. **Completion**: `sync_jobs.status='completed'`. Newly affected territories receive a brief glow + badge (same diff visualization as Flow 2).
4. **Token refresh edge case**: if `users.github_token_expires_at < NOW() + 10min`, refresh token before sync. If refresh fails or GitHub returns 401 on actual API call, retry once with forced refresh, then fail with banner.

Failure branches:
- 5-min cooldown not elapsed → toast only, no job dispatched.
- Sync fails → bottom banner "Last sync failed — retry" appears; cached map remains visible.

## Flow 5 — Settings management

Entry trigger: user clicks avatar dropdown → "Settings", or navigates to `/settings`.

1. **Settings page** lists 7 sections (see `docs/data-schema.md` §Users for backing fields):
   - **Public profile toggle** → updates `users.is_public`. Toggling ON triggers `revalidatePath('/${username}')`.
   - **Email recap toggle** → updates `users.email_recap_enabled`.
   - **Timezone** → IANA timezone dropdown, default detected from browser. Affects only display + email delivery time.
   - **Username change** → Zod validation (regex `/^[a-z0-9-_]+$/`, length 2-30, reserved-name check). On save, triggers `revalidatePath` for both old and new URLs.
   - **Included repos** → list of `repositories` rows with `is_included` toggle per repo. Save triggers backfill via `sync/backfill.requested` Inngest event.
   - **Disconnect GitHub** → confirm modal → sets `users.github_access_token_enc = NULL`, `is_public = false`. Map data preserved. Re-OAuth restores sync (see `docs/adr.md` ADR-13).
   - **Delete account** → typed-confirmation modal → CASCADE delete via `auth.users` row deletion. All `public.*` rows cascade.

2. **All mutations** use Next.js Server Actions with Zod input validation. Errors surface as inline messages or toast.

Failure branches:
- Username collision → form error "This name is taken".
- Reserved username (system path or other user's GitHub login) → form error "This name is reserved".
- Delete account: typed confirmation must match exactly, else button disabled.
