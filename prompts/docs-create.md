# Docs Creation Prompt

This prompt generates the project's foundational `docs/` from the discussion already in context. Use it after an interactive discussion has clarified the product mission, target user, technical constraints, and the non-obvious decisions made along the way — typically right after a PRD-level conversation, before any phase planning.

If the discussion in context is too thin to ground every doc below, ask the user one targeted question per missing area first. Do not invent facts.

---

## Output

Generate these 5 markdown files under `/docs/`:

| File | Scope |
|---|---|
| `docs/prd.md` | What we are building and why. Product mission, target user, in-scope features, out-of-scope, success criteria. |
| `docs/flow.md` | User flow per primary use case. Step-by-step from entry trigger → outcome, including state changes and error branches. |
| `docs/data-schema.md` | Data model. Entities with fields/types/constraints, relationships, indexes, retention. |
| `docs/code-architecture.md` | Code layout. Directory tree, layer responsibilities, dependency direction, naming/test conventions, external deps with justification. |
| `docs/adr.md` | Architecture decisions. One entry per non-obvious technical choice: context → decision → alternatives → consequences. |

If `docs/` already contains any of these files, **do not overwrite without confirming**. Extend or merge in place.

---

## Writing principles

These docs are read by AI agents inside short-lived `claude -p` sessions. Optimize for that audience.

1. **Concise but not lossy.** Strip prose redundancy; preserve every fact and constraint that affects implementation.
2. **State decision intent, not just outcomes.** "We chose X because Y, rejected Z because W." Future agents must be able to reason about edge cases under the same intent.
3. **Each fact lives in exactly one doc.** No duplication. Cross-reference by relative path (e.g. "see `docs/data-schema.md` §Users").
4. **Front-load the contract.** Each doc's first section states its scope and what it explicitly does NOT cover.
5. **Tables / bullets over paragraphs** for enumerable content. Reserve paragraphs for rationale.
6. **Code-style precision** for schemas, signatures, command names, limits. No prose ambiguity ("around 5 chars" → "exactly 5 chars").
7. **No conversational filler.** Drop "as discussed", "we agreed", "the user mentioned". The doc is the source of truth, not a meeting note.

---

## Per-doc structure

### `docs/prd.md`

- **Mission** — 1-2 sentences. Customer outcome, not the feature list.
- **Target user** — segment, current workaround, what they pay or sacrifice today.
- **In scope** — bulleted feature list with one-line purpose each.
- **Out of scope** — explicit non-goals. Prevents scope creep in later phases.
- **Success criteria** — observable metric or decision rule, not a feeling.

### `docs/flow.md`

- One subsection per primary use case.
- Numbered steps: trigger → … → outcome.
- Note state changes, side effects, and error branches at each step.
- Reference `docs/data-schema.md` entities by name.

### `docs/data-schema.md`

- One subsection per entity.
- Fields as a table: `name | type | nullable | constraint/note`.
- Relationships as a separate subsection (one-to-many, etc.).
- Indexes, retention, and migration notes if relevant.

### `docs/code-architecture.md`

- Top-level directory tree, 1-2 levels deep.
- Layer responsibilities and the dependency direction (e.g. "ui → service → repo → db; never the reverse").
- File naming conventions, test colocation rules.
- External dependencies, one line per dep on why it is justified.

### `docs/adr.md`

One entry per non-obvious decision, in chronological order. Per entry:

```
## ADR-{N}: {short title}
**Date:** {ISO date}
**Status:** accepted | superseded by ADR-X
**Context:** {what forced the decision}
**Decision:** {what we chose}
**Alternatives:** {options rejected, one-line reason each}
**Consequences:** {what this commits us to or makes harder later}
```

Trivial conventions (formatter, lint rules) do NOT need an ADR. Things that constrain future implementation choices do.

---

## Procedure

1. Confirm the discussion in context covers mission, user, scope, data, architecture, and the key decisions. For any gap: one targeted question per gap before generating.
2. Generate the 5 files in order: `prd → flow → data-schema → code-architecture → adr`. Earlier files inform later ones.
3. Cross-link wherever a fact in one doc is referenced from another.
4. Validation pass: re-read each doc and confirm a fresh AI agent could implement the next feature using only that file + its cross-references. If not, tighten until it can.
