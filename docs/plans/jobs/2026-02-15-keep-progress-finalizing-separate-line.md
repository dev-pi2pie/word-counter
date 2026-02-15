---
title: "Keep progress 100% bar while finalizing on separate line"
created-date: 2026-02-15
status: completed
agent: Codex
---

## Scope

Fix `--keep-progress` (and debug keep-visible mode) so the final `100%` progress bar remains visible, while `Finalizing aggregate...` is shown on a separate line instead of replacing the bar.

## What Changed

- Updated progress reporter behavior in `src/cli/progress/reporter.ts`:
  - In TTY keep-visible mode (`clearOnFinish === false`), `startFinalizing()` now writes `Finalizing aggregate...` on a new line.
  - In transient mode (`clearOnFinish === true`), finalizing keeps overwrite behavior and is still cleared on finish.
- Updated progress tests in `test/command.test.ts`:
  - `--keep-progress` now asserts a 100% counting-bar line is present and finalizing is emitted as `\nFinalizing aggregate...`.
  - `--debug` keep-visible path asserts the same separate-line behavior.

## Validation

- `bun test test/command.test.ts`
- `bun test`
- `bun run type-check`

## Related Plans

- `docs/plans/plan-2026-02-15-v0-1-0-canary-phased-delivery.md`
