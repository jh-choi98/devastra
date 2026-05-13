# PRD — DevAtlas

**Scope of this doc:** what we are building and why. For *how*, see `docs/code-architecture.md` and `docs/data-schema.md`. For *user steps*, see `docs/flow.md`. For *why specific technical choices*, see `docs/adr.md`.

## Mission

Turn a developer's public GitHub activity into a **living world map** where each tech area grows visually as they code. The outcome we sell: developers *feel* their growth instead of reading dashboards.

This is not a GitHub analytics tool, not a skill ranking, not a developer evaluation. The product fails if it makes users feel judged or measured.

## Target user

| Attribute | Detail |
|---|---|
| Segment | Students, interns, junior developers, portfolio builders |
| Geography (initial) | English-speaking developers globally; beta seeded via founder's network + Twitter/Discord developer circles |
| Current workaround | GitHub profile contribution graph + hand-curated portfolio site + LinkedIn |
| Pain | Static portfolios don't capture growth over time; contribution graph treats every commit equally; nothing celebrates "you became a backend developer this quarter" |
| Willingness to share | High — these users *already* share GitHub profiles, ProductHunt launches, side projects |

## In scope (MVP)

- **GitHub OAuth login** — public data only, scopes `read:user` + `user:email`
- **Repo selection** — user picks which public repos contribute to their map (defaults to all)
- **Living map** — 6 territories visualized as procedural SVG islands; size grows by stage, decoration grows by tech-specific landmarks
- **Territory detail drawer** — recent PRs, top repos, single-line interpretation per territory
- **Manual refresh** — 5-min cooldown per user
- **Public profile** — opt-in toggle exposing `/{username}` with identical interactive map + "Get your own" CTA
- **Weekly recap email** — Sunday delivery, OG image + 3-line highlights + CTA
- **Static OG image generation** — for social share previews on Twitter / LinkedIn / Discord
- **Settings** — public toggle, disconnect GitHub, delete account, email preferences, timezone, username change, included repos

## Out of scope (explicit non-goals)

Private repo analysis · Skill ranking / leaderboards · Friend comparison (Weekly Shipping League) · Mobile native app · Public API · Custom domains · Welcome email · `/recap` archive page · Landmark tier system · Push / Slack / Discord notifications · Search · GitHub App migration · Team or organization maps · Multi-identity (work + personal GitHub) · i18n (English only) · LLM-generated copy in core classification or display · Algorithm Arena and AI Workshop territories (planned for v0.2)

## Success criteria

Decision rule for "MVP succeeded, build v0.2":

| Metric | Threshold |
|---|---|
| Closed beta size | ≥50 invited users with completed signup |
| Activation rate | ≥60% of OAuth-completed users reach first-reveal |
| Share rate | ≥20% of activated users toggle profile to public |
| Return rate | ≥40% of activated users click weekly recap email at least once |
| Qualitative | ≥3 unsolicited social shares (Twitter / LinkedIn) of own DevAtlas |

If activation < 60%, fix onboarding before scaling. If share rate < 20%, the visualization isn't compelling enough — iterate viz, not features.

## Launch strategy

Closed beta, 1–2 weeks, 50–100 invites from founder network + Twitter/Discord. Funnel measured via PostHog (`docs/code-architecture.md` §External dependencies). Public launch (ProductHunt) deferred until beta success criteria met.
