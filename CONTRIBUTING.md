# Contributing to DevAstra

Thank you for your interest in DevAstra.

## Current status

DevAstra is in **MVP development** and is operated by a single-founder team. We are **not accepting external pull requests** at this stage.

However, the following kinds of contributions ARE welcome:

- **Bug reports.** Open an issue with a clear repro, your environment, and observed vs expected behavior.
- **Security reports.** See [`SECURITY.md`](./SECURITY.md). Do NOT open a public issue for security; use the private advisory channel.
- **Feature feedback.** Open an issue tagged `feedback`. Describe the use case, not the solution. We may or may not act on it, depending on roadmap fit.
- **Misclassification feedback.** Use the in-product "This doesn't look right" button on a star. This routes the signal directly to our classifier improvement queue.
- **Discussion.** GitHub Discussions are open for high-level questions about the product or the architecture.

## Why we don't accept external PRs yet

- The product is in a tight design loop where a single contributor reviewing every change against the compass (`memory/project_devastra_compass.md`) is the bottleneck. External PRs would either (a) be rejected for compass drift, (b) wait weeks in review, or (c) require us to re-design what we already designed.
- The codebase has a dual-license boundary (see `LICENSE-MIT` and `LICENSE-PROPRIETARY`). Contributor License Agreement infrastructure is not yet set up.
- A subset of files carry the MIT license (`SPDX-License-Identifier: MIT`); contributions to those files will eventually be welcome once the boundary stabilizes.

We will revisit this policy after MVP launch and the open-source extractable modules ship as standalone packages.

## If you must fork

You are free to fork the repository for the purposes described in `LICENSE-PROPRIETARY` §1 (security review, academic study, personal evaluation). For other use, see `LICENSE-MIT` for the modules carrying that header.

You may not operate a hosted service derived from this code without an explicit commercial license.

## Code style

If you're filing an issue with code examples, follow the conventions in `docs/code-architecture.md`:

- TypeScript-first.
- `kebab-case.ts` files, `PascalCase.tsx` React components.
- `snake_case` database columns.
- `SCREAMING_SNAKE_CASE` environment variables.

## Contact

- Issues / Discussions: this repository.
- Security: `security@devastra.app` (see `SECURITY.md`).
- Privacy / data requests: `privacy@devastra.app`.
- General: `hello@devastra.app`.
