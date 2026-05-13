# Task Creation Prompt

This prompt generates the task files for serial phase execution, given that an implementation plan already exists in context.

---

## Instructions

Based on the implementation plan in context (phase list, per-phase work, dependencies, AC, etc.), generate the artifacts below.

### 0. Decide task ID and name

- If the user did not specify, use `last id + 1` from the `tasks` array in `/tasks/index.json` as the new ID.
- Name is a kebab-case slug. One or two words for the task's core purpose.
- Directory name: `{id}-{name}` (e.g., `1-auth`, `2-billing`).

### 1. `/tasks/index.json` (top-level task index)

If it exists, append a new entry to the `tasks` array. If not, create it.

```json
{
  "tasks": [
    {
      "id": 0,
      "name": "mvp",
      "dir": "0-mvp",
      "status": "completed",
      "created_at": "...",
      "completed_at": "..."
    },
    {
      "id": 1,
      "name": "<task-name>",
      "dir": "1-<task-name>",
      "status": "pending",
      "created_at": "..."
    }
  ]
}
```

- `status`: `"completed"` when all phases complete, `"error"` if any phase fails, otherwise `"pending"`.
- Timestamps: `created_at` at task creation; `completed_at` on overall completion; `failed_at` on failure. ISO 8601 (e.g., `2026-03-19T01:55:23+0900`).
- Record only `created_at` at creation. `completed_at` and `failed_at` are filled in automatically by `scripts/run-phases.py`.

### 2. `/tasks/{id}-{name}/index.json` (task-level phase index)

```json
{
  "project": "<project-name>",
  "task": "<task-name>",
  "prompt": "<verbatim original prompt the user used to start this task discussion>",
  "totalPhases": <N>,
  "created_at": "...",
  "phases": [
    { "phase": 0, "name": "<phase-slug>", "status": "pending" }
  ]
}
```

- `prompt`: the verbatim original prompt that started this task discussion. Records the task's intent and context.
- `name`: kebab-case slug. One or two words for the phase's core module/work.
- All phases start with status `"pending"`.
- task-level `created_at`: record at creation. `completed_at` is filled by `scripts/run-phases.py` on overall completion.
- phase-level timestamps (`started_at`, `completed_at`, `failed_at`) are filled by `scripts/run-phases.py` at execution time. Do not include them at creation.

### 3. `/tasks/{id}-{name}/docs-diff.md` (documentation change record)

After Phase 0 completes, `scripts/run-phases.py` invokes `scripts/gen-docs-diff.py` to generate this automatically.
The HEAD before Phase 0 starts is recorded as the baseline; after Phase 0 completes, `git diff {baseline} -- docs/` extracts the actual diff.

**The agent does not write this file directly.** Phase 0 only needs to update the docs.

Generated format:

```markdown
# docs-diff: {task-name}

Baseline: `a1b2c3d`

## `docs/spec.md`

\`\`\`diff
@@ -45,6 +45,18 @@

### `<command> agent list`

+### `<command> run <agent-name>`
+...
\`\`\`
```

- Subsequent phases reference this file in their "Preparation" section.

### 4. `/tasks/{id}-{name}/phase{N}.md` (one per phase)

Each file must be **self-contained enough that an independent claude session, looking only at this file, can complete the work.**
Remember: phase execution happens in a separate claude session. Be specific so that intent is conveyed exactly.

Use this structure:

```markdown
# Phase {N}: {Phase Name}

## Preparation

First, read the documents below to fully understand the project's overall architecture and design intent:

- {list of relevant doc paths — spec, architecture, ADR, etc.}
- `/tasks/{id}-{name}/docs-diff.md` (this task's documentation change record)

Then verify the previous phase's output:

- {list of files created/modified by the previous phase}

Carefully read the code from previous phases. Understand the design intent before working.

## Work

{Concrete implementation instructions. Include file paths, class/function signatures, logic descriptions.
Code snippets show interface/signature only — leave the body to the agent.
Hard-code the design rules that must NOT be violated.}

## Acceptance Criteria

{Concrete verification commands. Example:}
\`\`\`bash
npm run build # no compile errors
npm test # all tests pass
\`\`\`

## How to verify AC

Run the AC commands above. If all pass, set the phase {N} status to `"completed"` in `/tasks/{id}-{name}/index.json`.
If you cannot make them pass after 3 attempts, set status to `"error"` and write the error in the phase's `"error_message"` field in index.json.

## Notes

- {what NOT to do in this phase, edge cases, compatibility notes}
- Do not break existing tests.
```

#### Phase file authoring rules

1. **Phase 0 = documentation update.** The first phase always updates the relevant docs (spec, architecture, ADR, etc.). `docs-diff.md` is generated automatically by `scripts/gen-docs-diff.py` after Phase 0 completes — the agent does not write it.
2. **Self-contained.** Each phase file runs in an independent session. Do not write "as discussed earlier". Put all needed information inside the file.
3. **Preparation is mandatory.** List relevant doc paths + `docs-diff.md` + previous phase outputs. Force the session to read code and understand context before working.
4. **Signature-level instructions.** Show only function/class interfaces. Body is the agent's discretion. But always specify hard business rules (idempotency, security, data integrity).
5. **AC must be runnable commands.** No abstract phrases like "X should work". Use runnable commands like `npm run build && npm test`.
6. **Minimize scope.** One layer/module per phase. Split if multiple modules must change together.
7. **Notes must be concrete.** Replace "be careful" with "do not do X. Reason: Y."

### 5. `/scripts/run-phases.py` (runner script)

Do not overwrite if already present. Otherwise, create a Python script that:

1. Takes a task directory name as a CLI argument (e.g., `python3 scripts/run-phases.py 0-mvp`).
2. Reads `tasks/{task-dir}/index.json` and finds the next `"pending"` phase.
3. Reads the corresponding `phase{N}.md` and combines it with the common preamble to form the prompt.
   - **Embed the file content directly into the prompt — do not pass file paths.**
4. Runs `claude -p --dangerously-skip-permissions --output-format json "{prompt}"`.
5. Saves stdout/stderr to `tasks/{task-dir}/phase{N}-output.json`.
6. Re-reads `{task-dir}/index.json` and checks status:
   - `"completed"` → next phase
   - `"error"` → print error and exit
   - `"pending"` (unchanged) → mark as error and exit
7. When all phases are completed, update the task's status in `/tasks/index.json` to `"completed"` and exit.

Common preamble:

```
You are a developer on the {project-name} project. Carry out the phase work below.

Important rules:
1. Before starting work, read the docs and understand the overall design.
2. Carefully read code from previous phases. Maintain consistency with existing code.
3. Run the AC verification yourself. Update /tasks/{task-dir}/index.json based on pass/fail.
4. Do not add unnecessary files or code. Do only what the phase specifies.
5. Do not break existing tests.
6. After AC passes and index.json is updated, commit all changes in this format:
   feat({task-name}): phase {N} — {phase-name}

The phase details follow:
```

---

## Execution example

```bash
# After task is created
python3 scripts/run-phases.py 0-mvp

# If a phase errors: edit task index.json then re-run
# → set the error phase's status to "pending"
python3 scripts/run-phases.py 0-mvp
```

### scripts/run-phases.py automatic behavior

- Auto-creates / checks out a `feat-{task-name}` branch (resumes if it already exists)
- Two-step commit after each phase:
  1. **Claude fallback commit**: `feat({task-name}): phase {N} — {phase-name}` — only if Claude did not commit code changes itself
  2. **Runner housekeeping commit**: `chore({task-name}): phase {N} output + timestamps` — phase-output.json save and index.json timestamp updates as a separate commit
  - Commit message templates are managed via `COMMIT_MSG_TEMPLATE` and `RUNNER_COMMIT_MSG_TEMPLATE` constants in `scripts/run-phases.py`
- Spinner + progress display (current phase / total phases / elapsed)
