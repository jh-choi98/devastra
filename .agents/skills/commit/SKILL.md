Procedure followed when the user asks to git commit (and optionally push) the work done so far. Triggered by any utterance signaling commit/push intent: "commit", "commit it", "commit and push", "commit the work so far", and similar.

---

## 0. Cardinal rules (do not break)

1. **Commit only files related to the current conversation context.** Files I created or modified in this session, or that we deliberately touched while discussing — those only. Never commit incidentally changed local files, leftovers from prior sessions, or changes of unclear origin. When unsure, ask the user.
2. **Logically distinct changes go in separate commits.** One thing per commit.
3. **Push only when explicitly requested.** ("push", "push it up", etc.)
4. **Never use `--no-verify`.** pre-commit / pre-push hooks must always pass. If a hook fails, fix the cause or report it.
5. **If committing directly to `main` / `master`, confirm first.** Usually a mistake.
6. **Never `git add .` / `git add -A`.** Always stage by explicit path.
7. **No secrets / build artifacts.** `.env*`, `*.log`, `dist/`, `build/`, `node_modules/`, `.DS_Store`, large binaries — never commit unless deliberately added. Confirm with the user if found.

---

## 1. Procedure

### 1-1. Inspect current state

```bash
git status --short
git diff --stat
git log --oneline -15   # re-confirm message style
git branch --show-current
```

- Check whether the working branch is `main` / `master`. If yes, apply Cardinal Rule 5.
- Note all changed files.

### 1-2. Select related files (Cardinal Rule 1)

Classify changed files into 3 buckets relative to the current session context:

| Bucket | Action |
|---|---|
| **IN** — files I modified/created in this conversation, or that were discussed | commit candidate |
| **UNKNOWN** — files whose when/why is unclear | **ask the user, file by file** |
| **OUT** — files clearly unrelated (other features, local config, IDE files) | exclude. Tell the user "these look unrelated, excluded" |

If any UNKNOWN or OUT files exist, show the list and classification to the user and get approval before staging. **Do not skip this step.**

### 1-3. Split into logical commits (Cardinal Rule 2)

Group the IN set by nature into multiple commits. Examples:

- refactor + new feature → **2 commits** (refactor first, feat second)
- bug fix + related test → **1 commit** (same context)
- bug fix + unrelated typo fix → **2 commits**
- UI change + a util extracted along the way → **2 commits** (refactor first)

If a single file mixes different kinds of changes, use `git add -p` (hunk-level staging). Do not stage the whole file.

Show the split (per-commit files + draft message) to the user and get approval. If only 1-2 related files with an obviously single purpose, the approval step can be skipped.

### 1-4. Write the commit message

Match the style of `git log --oneline -30` for this repo exactly.

**Format**

```
<type>(<scope>): <summary>

<body — only when needed; bullets or short paragraph>
```

**type** (use only those observed in this repo)

- `feat` — new feature
- `fix` — bug fix
- `enhance` — UX/feature improvement (renewal-level)
- `refactor` — internal restructure with no behavior change
- `perf` — performance improvement
- `chore` — build/config/version-bump and other periphery
- `docs` — docs only
- `skill` — create/modify/delete a `.Codex/skills/` file. scope is the **skill name**. e.g., `skill(commit): initial create`, `skill(plan-and-build): tighten test-discussion step`

**scope** (prefer scopes already observed in this repo's log)

- domain or package name as observed in the codebase
- if a change spans multiple scopes, use `(a,b)` or omit
- for `skill` type, scope is always the target skill name (e.g., `commit`, `plan-and-build`)

**Summary rules**

- Noun phrase or verb phrase. Real logs typically read "add ~", "improve ~", "restructure ~".
- No trailing period.
- Single line, ≤72 chars.

**Body rules**

- Omit for simple changes.
- When multiple items must be combined, list as bullets (`- `).
- If "why" is not self-evident, add a one-line reason.

**Co-author trailer (required)**

End every commit message with one blank line then this trailer:

```
Co-Authored-By: Codex <noreply@anthropic.com>
```

### 1-5. Stage & commit

```bash
# stage related files explicitly
git add <path1> <path2> ...
# or hunk-level
git add -p <path>

# verify once more
git diff --cached --stat

# commit — heredoc for multi-line message (with trailer)
git commit -m "$(cat <<'EOF'
<type>(<scope>): <summary>

<body>

Co-Authored-By: Codex <noreply@anthropic.com>
EOF
)"
```

If multiple commits, repeat 1-5. Run `git status` between commits to re-check remaining changes.

### 1-6. Verify result

```bash
git log --oneline -<N>   # N = number of commits just made
git status               # working tree as expected?
```

If commits are missing or unexpected residual changes exist, report to the user immediately.

### 1-7. Push (only if requested)

Only when push intent was in the utterance:

```bash
git push
```

- If no upstream, `git push -u origin <current-branch>`.
- `--force` / `--force-with-lease` only when **the user explicitly requested it**. If a normal push is rejected as non-fast-forward, explain the situation and present options.
- After push, report the latest remote state in one line (branch + latest commit hash).

---

## 2. Report format

When commits are done, report concisely:

```
✅ N commits created (+ push status)
  1. <hash> <type>(<scope>): <summary>
  2. <hash> <type>(<scope>): <summary>
Excluded files: <list if any, omit otherwise>
```

## 3. Common mistakes (avoid)

- ❌ Stage everything with one `git add .` — unrelated files leak in
- ❌ Combine multiple kinds of changes into one commit with a vague message like "reflect work done"
- ❌ Commit `.env`, lock files, build artifacts without user confirmation
- ❌ Mention conversation context in the message ("as requested by user", "per the discussion")
- ❌ Sneak in unrelated working-tree changes alongside the intended commit
- ❌ Push when push was not requested
- ❌ Bypass a hook failure with `--no-verify`
