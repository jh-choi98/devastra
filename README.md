# DevAstra

> Turn your GitHub activity into a living skill constellation. Each technology you use becomes a star; each domain you grow brightens as a nebula cluster.

DevAstra is a free, open-core developer portfolio tool. It is **not** a GitHub analytics dashboard, **not** a skill ranking, **not** a leaderboard. Read [`docs/prd.md`](docs/prd.md) for the four value pillars before contributing or extending.

This repository is **dual-licensed.** Files carrying `SPDX-License-Identifier: MIT` at the top are released under [LICENSE-MIT](LICENSE-MIT) (the renderer, classifier, tech catalog, scoring, rules). Everything else is covered by [LICENSE-PROPRIETARY](LICENSE-PROPRIETARY). See [ADR-27](docs/adr.md#adr-27) and [ADR-55](docs/adr.md#adr-55).

## Documentation

Read in this order before touching code:

1. [`docs/prd.md`](docs/prd.md) — mission, target user, in/out of scope, success criteria
2. [`docs/flow.md`](docs/flow.md) — 5 user flows + 11 sub-flows
3. [`docs/screens.md`](docs/screens.md) — every screen + overlay spec
4. [`docs/data-schema.md`](docs/data-schema.md) — entities, RLS, retention
5. [`docs/code-architecture.md`](docs/code-architecture.md) — directory layout, layers, env vars
6. [`docs/adr.md`](docs/adr.md) — 60 architecture decisions
7. [`docs/security-checklist.md`](docs/security-checklist.md) — pre-launch verify items

For local development, see [`docs/dev-setup.md`](docs/dev-setup.md).

## Running locally

```bash
git clone <repo-url> devastra
cd devastra
npm install
cp .env.example .env.local   # populate with your credentials
npm run dev                   # Next.js dev server at http://localhost:3000
```

To run background jobs locally, start the Inngest dev server in a second terminal:

```bash
npx inngest-cli@latest dev
```

### Tests

```bash
npm test              # unit + integration (Vitest)
npm run e2e:local     # E2E smoke test (requires running dev server)
```

## Deploying to production

1. Create a Supabase project (prod). Apply migrations with `DIRECT_URL=<prod-direct> npm run db:migrate` **before** merging the code PR (see [ADR-57](docs/adr.md#adr-57)).
2. Configure a GitHub OAuth App — callback URL: `https://devastra.app/auth/callback`.
3. Set all required env vars in Vercel (see [`docs/dev-setup.md`](docs/dev-setup.md) for the full list, including `DATABASE_URL` pooler / `DIRECT_URL` direct).
4. Deploy via `git push` — Vercel builds and deploys automatically.
5. Set up SPF/DKIM/DMARC on `devastra.app` for Resend deliverability.
6. Verify the [pre-launch security checklist](docs/security-checklist.md).

## Reporting issues

- **Bug / feature feedback:** open an issue on this repository (see [CONTRIBUTING.md](CONTRIBUTING.md) — external PRs are not accepted at MVP stage).
- **Security vulnerabilities:** use the private channel described in [SECURITY.md](SECURITY.md). Do not open a public issue.
- **Privacy / data requests:** email `privacy@devastra.app` (see [docs/legal/privacy.md](docs/legal/privacy.md)).

---

# claude-harness-template

A minimal Stage-0 harness for Claude Code projects. The flow:

1. **Discuss** — interactive `claude` session, user explains the product.
2. **Document** — invoke `prompts/docs-create.md` → AI writes `docs/{prd, flow, data-schema, code-architecture, adr}.md`.
3. **Plan & build** — trigger the `plan-and-build` skill → reads `docs/`, discusses gates with the user, generates `tasks/{N}-{name}/`, then runs `scripts/run-phases.py`.
4. **Execute** — `scripts/run-phases.py` spawns one `claude -p` per phase, sequentially. Exit code drives a Discord notification.

This is **the floor**. No autonomous loop, no headless server, no agent self-collusion. The user is the decision partner at every gate. Add autonomy at Stage 2+ when there are real inputs (customer data, persona simulation) to drive it.

## Layout

```
.claude/
  skills/
    plan-and-build/SKILL.md        — read docs → discuss with user → generate task & phases → run phases → Discord notify
    commit/SKILL.md                — disciplined commit playbook (triggered when the user says "commit")
prompts/
  docs-create.md                   — generate the 5 foundational docs from a discussion
  task-create.md                   — generate task / phase files from an implementation plan
scripts/
  run-phases.py                    — phase runner (one claude -p per phase, sequential)
  _utils.py                        — find_project_root + gh env helpers
  gen-docs-diff.py                 — generates docs-diff.md after phase 0 of each task
```

## Prerequisites

| Required | Why |
|---|---|
| Python 3.9+ | runs `scripts/run-phases.py` and `scripts/gen-docs-diff.py` |
| `claude` CLI in PATH | `run-phases.py` spawns `claude -p` per phase |
| `git` | `_utils.find_project_root` locates the project via `.git/`; phases commit via git |

| Optional | When you need it |
|---|---|
| `gh` CLI authenticated | only if you set `gh_user` in a task's `index.json` to commit under a specific GitHub identity |
| Discord MCP **or** webhook | `plan-and-build` Step 6 notification on `run-phases.py` exit. See [Discord notification setup](#discord-notification-setup-optional). Without setup the AI reports unavailable and the flow continues. |

## Discord notification setup (optional)

`plan-and-build` Step 6 sends a notification on `run-phases.py` exit. Without setup, that step reports unavailable and the flow continues unaffected.

### Option 1 — Discord MCP

Install a Discord-capable MCP server (search the MCP registry for `discord`). Register it with Claude Code:

```bash
claude mcp add discord <command or URL>
# or edit .claude/mcp.json directly
```

The AI in Step 6 will use whatever Discord-sending tool the MCP exposes.

### Option 2 — Webhook + wrapper script

1. In Discord: **Channel → Settings → Integrations → Webhooks → New Webhook → Copy URL**.
2. Export the URL (add to your shell rc file for persistence):

   ```bash
   export DISCORD_WEBHOOK_URL="https://discord.com/api/webhooks/..."
   ```

3. Drop a wrapper at `scripts/notify.sh` so the AI has a reliable single-command tool to call:

   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   MSG="${1:-}"
   [[ -z "${DISCORD_WEBHOOK_URL:-}" ]] && exit 0
   curl -fsS -X POST -H "Content-Type: application/json" \
     -d "$(jq -nc --arg c "$MSG" '{content: $c}')" \
     "$DISCORD_WEBHOOK_URL" >/dev/null
   ```

   ```bash
   chmod +x scripts/notify.sh
   ```

   The AI can then call `bash scripts/notify.sh "<message>"` from `plan-and-build` Step 6 without re-deriving curl + JSON escaping each time. The `[[ -z ... ]] && exit 0` line makes the script a no-op (not a failure) when the env var is missing — useful in CI or shared envs.

### Verify

```bash
bash scripts/notify.sh "test from claude-harness-template"
```

A message should appear in the configured channel. If nothing appears: webhook URL wrong, channel deleted, or curl/jq missing.

---

## Quick start

```bash
# 1. Clone the template, then in the new repo:
git init                                       # if not already a git repo

# 2. (Optional) Set up Discord — see § Discord notification setup.

# 3. Start an interactive session:
claude
```

In the chat (multi-turn — the AI pauses at each gate for user input):

- **a)** Describe the product, target user, constraints, and the non-obvious decisions you have already made.
- **b)** Ask for docs, referencing the prompt:
  > "Now create the foundational docs based on our discussion, following `prompts/docs-create.md`."
  → AI writes `docs/{prd, flow, data-schema, code-architecture, adr}.md`.
- **c)** Trigger build for a specific feature:
  > "Now build the X feature using the `plan-and-build` skill."
  → skill pauses for clarification, plan approval, task-creation approval, then writes `tasks/{N}-{name}/` and runs `scripts/run-phases.py {N}-{name}`.
- **d)** Step away. When `run-phases.py` exits, you get a Discord ping with success / error / blocked status.

## Key principles encoded

1. **USER is the decision partner.** `plan-and-build` pauses at three gates — clarification, plan approval, task creation — and waits for the user. No critic agent autonomously approving its own plans.
2. **Docs are the source of truth, not chat.** `prompts/docs-create.md` enforces concise but intent-preserving docs that downstream phase sessions read instead of re-discussing.
3. **Self-contained phase files.** Each `phase{N}.md` is written so a fresh `claude -p` session can complete it from that file alone (per `prompts/task-create.md` rules).
4. **Phase isolation + async visibility.** `run-phases.py` spawns one ephemeral `claude -p` per phase, capturing per-phase output to `phase{N}-output.json` and committing each phase separately. On exit, Discord notification (success / error / blocked) lets the user step away during multi-hour runs.

## Growing past Stage 0

This template is the floor. Three growth stages, each **adds** — never restructures the floor.

| Stage | Trigger | What you add |
|---|---|---|
| **1** — docs maturity | `docs/*` has stable shape; project has identity | per-area docs (`testing.md`, `deployment.md`), optional `test-strategy` skill |
| **2** — autonomous loop | 1+ personas + customer evidence to drive requirement selection | persona simulation, autonomous supervisor, read-only critic — **detailed below** |
| **3** — production | shipping to real users | domain-specific skills (publish, ui-design, monitoring, etc.) and matching critic agents — project-unique, not template material |

### Stage 2 graduation — detailed steps

When you have at least one persona and want to move from "user-gated interactive" to "self-driving autonomous":

**1. Set up persona infrastructure**
```bash
mkdir -p persuasion-data/{personas,runs}
echo "persuasion-data/runs/**/*.log" >> .gitignore
```

**2. Add the persona simulation skill** — copy from a Stage-2 reference (e.g. argos), translating per the writing principles in `prompts/docs-create.md`:
- `.claude/skills/persuasion-review/SKILL.md`
- `.claude/skills/persuasion-review/SPEC.md`
- `.claude/skills/persuasion-review/scripts/`

**3. Create your first persona** — trigger the persuasion-review skill in interactive `claude` (it has a guided creation flow). At least one persona must exist before ideation can run.

**4. Add the ideation skill** — copy `.claude/skills/ideation/SKILL.md`. Reads `persuasion-data/personas/`, runs simulation via persuasion-review, produces one ranked requirement.

**5. Add the read-only critic agent** — copy `.claude/agents/tech-critic-lead.md`. Tailor the `## Beliefs` section to your domain.

**6. Replace `plan-and-build/SKILL.md` with the critic-consultation version** — Stage 0 asks the **user** at three gates; Stage 2 asks **tech-critic-lead** at the same gates. Same structure, different decision partner. Source: the post-MVP version in your reference repo.

**7. Add the autonomous supervisor** — copy `scripts/run-server.py`. Outer loop: `ideation → commit → build → check → rollback`. Spawns each phase as `claude -p --dangerously-skip-permissions` under `HARNESS_HEADLESS=1`.

**8. Update workflow**
- Stage 0 day: open `claude`, walk through gates, watch `run-phases.py`, Discord ping at end.
- Stage 2 day: `python3 scripts/run-server.py`, walk away. Server pulls iteration N from ideation output, snapshots HEAD, runs build, runs check (writes `iterations/N-{ts}/check-report.json` with `status: pass|warn|fail`), rolls back on fail. Inspect `iterations/` for outcomes.

### Five invariants that come online at Stage 2

The files copied in steps 5–7 encode these — knowing them helps debugging:

1. **Prompt-level headless lock** — `HARNESS_HEADLESS=1` env var + a preamble forcing the session to verify it as the first Bash call. Skill-body "ask user" lines become unreachable.
2. **Marker-based commit verification** — every iteration carries a unique `iter-id`; the supervisor requires every new commit to have it as a trailer.
3. **Structured JSON handoff** — the check phase emits a fixed schema (`status`, `progress`); the supervisor parses one field to decide rollback.
4. **HEAD snapshot for cheap rollback** — the supervisor records `pre_build_head` before the risky phase. On fail: `git reset --hard <pre_build_head>` + empty marker commit.
5. **Read-only critic in front of every change** — `tech-critic-lead` has `Read/Grep/Glob/Bash` only. Judges, cannot ship.

### Stage 3 note

Stage 3 is project-specific by definition. A reference Stage-3 instance (argos) has `ui-design-system`, `publish-cli`, etc. — these reflect argos shipping a Next.js dashboard + npm CLI. Your project will have a different set. Add them as skills under `.claude/skills/<name>/SKILL.md` following the same shape as the Stage 0 skills here.
