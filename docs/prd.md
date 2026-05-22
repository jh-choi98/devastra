# PRD — DevAstra

**Scope of this doc:** what we are building and why. For _how_, see `docs/code-architecture.md` and `docs/data-schema.md`. For _user steps_, see `docs/flow.md`. For _screen-level specs_, see `docs/screens.md`. For _why specific technical choices_, see `docs/adr.md`.

## Mission

Turn a developer's public GitHub activity into a **living skill constellation** where each technology they use lights up as a star and each domain they grow brightens as a nebula cluster. The outcome we sell: developers _feel_ their growth and _recognize their identity_ in a single shareable image, instead of reading dashboards.

This is not a GitHub analytics tool, not a skill ranking, not a developer evaluation, not a leaderboard. The product fails if it makes users feel judged or measured.

## The four value pillars

Every implementation decision is checked against these. See `memory/project_devastra_compass.md`.

1. **Growth feeling** — Users see _what brightened_, not _how many commits_. "React grew. Testing lit for the first time. Docker is new this week."
2. **Portfolio value** — A constellation is a better share artifact than a contribution graph. Fits LinkedIn / X / Discord / personal-site embed without feeling game-like.
3. **Motivation through collection** — Lighting new stars, brightening dim ones, filling empty clusters, this week's new stars. Drives the "I want to do a bit more" feeling _without numeric rankings_.
4. **Self-understanding** — "I write more docs than I thought." "My backend is bigger than my frontend." "Testing is empty — maybe try Playwright next." Helps users see their actual habits.

## Failure mode

If the constellation is **pretty but disconnected from meaning**, the user reaction is _"so what?"_ Every visual flourish must earn its keep against this question. Required couplings (see `memory/project_devastra_compass.md`):

- star ↔ actual `tech_key` (with detection rule)
- cluster ↔ actual growth domain (one of six)
- drawer ↔ explanation ("why is this lit?")
- weekly recap ↔ this-week change (Phase 2; dormant in MVP launch)
- public profile ↔ shareable identity
- labels ↔ clarity without clutter
- sparse users ↔ honest early-state visual treatment; never fake stars or inflate activity

## Target user

| Attribute            | Detail                                                                                                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Segment              | Students, interns, junior developers, portfolio builders                                                                                                           |
| Geography (initial)  | English-speaking developers globally; beta seeded via founder's network + X/Discord developer circles                                                              |
| Current workaround   | GitHub profile contribution graph + hand-curated portfolio site + LinkedIn                                                                                         |
| Pain                 | Static portfolios don't capture growth over time; contribution graph treats every commit equally; nothing celebrates "you became a backend developer this quarter" |
| Willingness to share | High — these users _already_ share GitHub profiles, ProductHunt launches, side projects                                                                            |

## In scope (MVP — free only)

- **GitHub OAuth login** — public data only, scopes `read:user` + `user:email`
- **Repo selection** — user picks which public repos contribute; defaults to all
- **Skill constellation** — 6 fixed cluster nebulae; per-`tech_key` stars at globally fixed positions; brightness scales with weight; MST connection lines between lit stars
- **Cluster drawer** — `"Why is this lit?"` per-star explanation, contributing repos, recent PRs (fetched on demand from GitHub at view time)
- **First-time reveal** — cinematic stars-light-up animation, minimum 12s
- **First-ever star cinematic** — separate moment when `lit_star_count` transitions 0 → ≥1
- **Stage-up moments** — cluster aura expansion + ripple when `total_weight` crosses thresholds
- **Manual refresh** — 5-minute cooldown per user; pull-to-refresh on mobile
- **Public profile** — opt-in `/{username}` page with identical interactive constellation + sticky `Start yours for free →` CTA
- **Welcome-back overlay** — appears after ≥4 weeks of absence
- **Misclassification feedback plumbing** — per-star correction modal and rate-limited storage are prepared, but the drawer entrypoint is hidden while a lower-friction feedback surface is redesigned
- **Static OG image generation** — dark-sky share image for `/api/og/profile/[username]`, aligned with the live constellation's current stars/background while remaining an SVG-only static renderer
- **Settings** — public toggle, disconnect GitHub, delete account, timezone, username change, included repos
- **Username history with permanent redirect** — old `/{username}` URLs forward to new ones forever

## Out of scope (explicit non-goals)

| Category        | Items                                                                                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Monetization    | Paid tier · Team/org constellation · Private repo support · Multi-identity (work + personal GitHub) · Custom domain · Theme customization · Embed widget · Poster export |
| Social          | Friend comparison · Weekly shipping league · Leaderboards · Skill ranking · Following / subscriptions · Comments / reactions                                             |
| Analytics depth | Rare star UI (logic prepared, hidden until `tech_global_stats.eligible_user_count ≥ 500`) · Per-star numeric rankings · "You are top N%" framing                         |
| Notifications   | Weekly recap email (Phase 2 deferred) · Push · Slack · Discord · Welcome email · Achievement / level-up copy · "+XP" framing                                             |
| Platforms       | Mobile native app · PWA / service worker · Browser extension · Public API · Embed iframe                                                                                 |
| Content         | `/recap/{id}` archive page · LLM-generated copy in core flow · Tutorial / help center · Status page · View-in-browser email link                                         |
| Other           | i18n (English only) · Cookie consent banner (PostHog runs in cookieless mode)                                                                                            |

## Success criteria

Decision rule for "MVP succeeded, build v0.2":

| Metric           | Threshold                                                              | Source                                                   |
| ---------------- | ---------------------------------------------------------------------- | -------------------------------------------------------- |
| Closed beta size | ≥50 invited users with completed signup                                | Supabase `users` count                                   |
| Activation rate  | ≥60% of OAuth-completed users reach first-reveal                       | PostHog funnel: `landing_view` → `first_reveal_complete` |
| Share rate       | ≥20% of activated users toggle profile to public                       | PostHog event: `public_toggle_on`                        |
| Return rate      | ≥40% of activated users return within 7 days after first reveal        | PostHog cohort / pageview analysis                       |
| Qualitative      | ≥3 unsolicited social shares (X / LinkedIn) of own constellation       | Founder manual count                                     |

If activation < 60%, fix onboarding before scaling. If share rate < 20%, the constellation isn't compelling enough — iterate viz, not features.

## Launch strategy

Closed beta, 1–2 weeks, 50–100 invites from founder network + X/Discord. Funnel measured via PostHog. Public launch (ProductHunt) deferred until beta success criteria met. See `docs/adr.md` ADR-24.

## Open-source posture

DevAstra is an **open-core** product. Extractable modules (constellation renderer, classifier, tech catalog, rules, scoring) carry `SPDX-License-Identifier: MIT` headers; the rest of the codebase is proprietary. See `docs/adr.md` ADR-27 and ADR-55. No npm packages are published in MVP — boundaries are designed for future extraction.
