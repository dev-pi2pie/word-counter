---
title: "inspect engine content gate info note implementation"
created-date: 2026-03-31
status: completed
agent: Codex
---

## Goal

Implement the settled `inspect --view engine` info-note behavior so raw engine inspection stays unchanged while users are explicitly redirected to `--view pipeline` when `contentGate` policy expectations would otherwise be misleading.

## Completed Work

- Updated `src/cli/inspect/run.ts` to emit a cyan `Info:` note to stderr when:
  - `inspect` is running with `--view engine`
  - the effective detector is `wasm`
  - `--content-gate ...` was explicitly passed, including `default`, or config/env resolves the effective mode to a non-default value
- Kept the note outside the inspect result body so both standard and JSON stdout payloads remain unchanged.
- Ensured the note is emitted once per inspect invocation, including inspect batch runs.
- Updated `src/cli/inspect/help.ts` so `--content-gate` is described as pipeline policy inspection behavior.
- Updated `README.md` and `docs/schemas/detector-inspector-output-contract.md` so engine vs pipeline responsibilities are explicit and the note trigger behavior is documented.
- Marked the implementation plan complete in `docs/plans/plan-2026-03-31-inspect-engine-content-gate-info-note-implementation.md`.

## Verification

- `bun test test/command-inspect.test.ts test/command-config-inspect.test.ts`
  - 49 tests passed
  - 0 tests failed

## Related Research

- `docs/researches/research-2026-03-31-inspect-engine-content-gate-info-note.md`

## Related Plans

- `docs/plans/plan-2026-03-31-inspect-engine-content-gate-info-note-implementation.md`
