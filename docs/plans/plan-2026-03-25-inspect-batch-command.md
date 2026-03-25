---
title: "inspect batch command"
created-date: 2026-03-25
modified-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Implement batch-capable `word-counter inspect` behavior using the settled inspect-batch research contract, so inspect can process repeated file and directory `--path` inputs with counting-aligned path resolution while keeping inspect-specific per-file diagnostic output.

## Context

- The current `inspect` command is intentionally single-input only.
- The inspect-batch research now settles the CLI contract instead of leaving key behavior for later:
  - shared counting-style path acquisition
  - batch JSON container with `summary`, `files`, `skipped`, and `failures`
  - standard batch rendering
  - supported `--section` behavior
  - exit-status rules
  - no inspect-specific `--jobs`, `--merged`, or `--per-file`
- The implementation should reuse existing counting path-resolution helpers where practical, but should not inherit counting aggregation semantics.

## Scope

- In scope:
  - extend `inspect` to accept repeated `-p, --path <path>` inputs
  - support file and directory inputs in `--path-mode auto`
  - support literal-file treatment in `--path-mode manual`
  - support `--no-recursive`, `--include-ext`, `--exclude-ext`, and `--regex` in inspect batch
  - support batch `--format standard|json`
  - support batch `--section all|frontmatter|content`
  - implement batch JSON output with:
    - `summary`
    - `files`
    - `skipped`
    - `failures`
  - implement standard batch rendering with:
    - batch header
    - per-file inspect blocks
    - trailing `Skipped` / `Failures` sections
  - implement batch exit-status rules for:
    - mixed success/failure runs
    - all-skipped runs
    - no-inspectable-input runs after filtering
  - add command coverage for path resolution, section handling, rendering, and exit behavior
  - update README and any inspect-facing schema/docs to reflect the batch contract
- Out of scope:
  - inspect-specific merged or aggregate detector result output
  - inspect-specific `--jobs` or any other user-facing concurrency control
  - broader inspect-only section expansion such as `split`, `per-key`, or `split-per-key`
  - detector-engine changes unrelated to batch orchestration
  - configurable `contentGate` behavior
  - changes to the settled single-input inspect contract beyond what is needed for batch coexistence

## Decisions Settled for This Plan

- Batch inspect reuses counting path acquisition, not counting aggregation.
  - Reuse:
    - `-p, --path`
    - `--path-mode auto|manual`
    - `--no-recursive`
    - `--include-ext`, `--exclude-ext`, and `--regex`
  - Do not reuse:
    - `--merged`
    - `--per-file`
    - `--jobs`
- Default path behavior remains `--path-mode auto`.
- Batch inspect stays per-file only.
  - The only batch-level aggregate surface is `summary`, which reports counts and is not a merged inspect result.
- Batch inspect supports:
  - `--format standard`
  - `--format json`
  - `--section all|frontmatter|content`
- Batch inspect rejects:
  - positional text mixed with batch `--path` input
  - `--format raw`
  - `--section split`
  - `--section per-key`
  - `--section split-per-key`
- Summary counts are fixed:
  - `requestedInputs` counts raw `-p, --path` occurrences before expansion or dedupe
  - `succeeded` equals `files.length`
  - `skipped` equals `skipped.length`
  - `failed` equals `failures.length`
- Successful inspect targets are deduped by resolved absolute path across repeated file inputs, repeated directory inputs, and file-plus-directory overlap.
- Failure and skip reasons follow the settled vocabulary:
  - `not readable: <message>`
  - `not a regular file`
  - `directory read failed: <message>`
  - `extension excluded`
  - `regex excluded`
  - `binary file`
- `binary file` is classified differently by source:
  - explicit file input -> failure
  - directory-discovered file -> skip
- Exit behavior is fixed:
  - non-zero when any `failures` entry is present
  - non-zero when `files` is empty after path resolution/filtering, even if `failures` is empty
  - `0` when `files` is non-empty and `failures` is empty, even if `skipped` entries are present

## Phase Task Items

### Phase 1 - Inspect CLI Parsing and Validation

- [x] Extend `inspect` option parsing to accept repeated `-p, --path <path>` values.
- [x] Add inspect-local parsing/validation for:
  - `--path-mode auto|manual`
  - `--no-recursive`
  - `--include-ext`
  - `--exclude-ext`
  - `--regex`
  - `--section all|frontmatter|content`
- [x] Reject inspect-only misuse cases:
  - positional text mixed with batch `--path`
  - unsupported section modes
  - `--format raw`
  - inherited counting flags not part of the inspect contract
- [x] Preserve the current single-input inspect behavior when batch inputs are not used.

Validation for this phase:

- command tests for repeated `--path`
- command tests for supported and rejected `--section` values
- command tests proving single-input inspect still behaves as before

### Phase 2 - Shared Path Resolution and Input Slicing

- [x] Reuse existing path-resolution helpers so inspect batch follows counting behavior for:
  - directory expansion in `auto`
  - literal-file behavior in `manual`
  - recursion
  - extension filters
  - regex filtering
  - absolute-path ordering
  - overlap dedupe
- [x] Add inspect-specific classification after resolution/load so outcomes become:
  - `files`
  - `skipped`
  - `failures`
- [x] Reuse the current text-like file guard and map `binary file` outcomes according to the settled explicit-path vs directory-discovered rule.
- [x] Apply inspect section slicing per file for:
  - `all`
  - `frontmatter`
  - `content`
- [x] Ensure missing/empty selected sections still produce valid empty inspect results instead of skip/failure records.

Validation for this phase:

- path-resolution parity checks against counting behavior
- tests for explicit `-p <dir>` in `auto` vs `manual`
- tests for directory-filter-only runs
- tests for empty selected-section files

### Phase 3 - Batch JSON Contract

- [x] Add the batch JSON container for inspect:
  - `schemaVersion`
  - `kind`
  - `detector`
  - `view`
  - `section`
  - `summary`
  - `files`
  - `skipped`
  - `failures`
- [x] Ensure `files[i].result` reuses the full single-result inspect object rather than inventing a reduced batch-only payload.
- [x] Implement `summary` counts exactly as settled in the research.
- [x] Emit absolute paths in `files`, `skipped`, and `failures`.
- [x] Ensure partial-failure and empty-result batch runs still emit JSON payloads.

Validation for this phase:

- command tests for mixed `files` / `skipped` / `failures`
- tests proving summary counts match payload array lengths
- tests for all-skipped and all-failed outcomes

### Phase 4 - Standard Batch Rendering

- [x] Add standard batch rendering with:
  - batch header
  - `Requested inputs: ...`
  - `Summary: X succeeded, Y skipped, Z failed`
  - per-file blocks prefixed by `File: <path>`
  - `Skipped` section
  - `Failures` section
- [x] Reuse the existing single-result standard inspect body inside each file block.
- [x] Render `Skipped` and `Failures` entries as one line each:
  - `<path> | <reason>`
- [x] Keep `Skipped` and `Failures` entries out of the per-file inspect block format:
  - do not render them as `File: <path>` blocks
- [x] Always print the batch header, even when `files` is empty.
- [x] When `files` is empty:
  - omit per-file inspect blocks
  - still print `Skipped` and/or `Failures` sections when present
  - rely on the header summary plus those sections to explain the non-zero result
- [x] Keep batch standard output deterministic and result-first, with no progress UI.

Validation for this phase:

- command tests for standard output with:
  - mixed success/skip/failure
  - all-skipped runs
  - all-failed runs
  - empty-result runs
  - stable path ordering

### Phase 5 - Exit Codes, Docs, and Regression Audit

- [x] Implement the settled exit-status rules across JSON and standard output paths.
- [x] Update README inspect usage examples for:
  - repeated `--path`
  - directory inputs
  - `--path-mode auto|manual`
  - supported `--section` values
  - standard vs JSON batch output
- [x] Update any inspect-facing schema/docs so batch output and single-output documentation stay aligned.
- [x] Record follow-up implementation work in job records under `docs/plans/jobs/`.
- [x] Run a regression audit to ensure existing count and single-input inspect behavior remain intact.

Validation for this phase:

- `bun test test/command.test.ts`
- targeted tests for exit-code contracts
- targeted tests proving standard-output behavior matches JSON behavior for:
  - all-skipped runs
  - all-failed runs
  - mixed success / skip / failure runs
- doc/schema review against the settled research contract

## Execution Notes

- Prefer reusing counting path modules over duplicating directory logic inside inspect code.
- Keep the inspect batch implementation modular rather than growing the current hand-rolled single-input parser into another monolith.
- Preserve parity between standard and JSON batch runs for ordering and outcome classification.
- Treat the settled research doc as the source of truth for inspect batch behavior; do not reopen CLI-contract design inside implementation unless a concrete contradiction is found.

## Related Research

- `docs/researches/research-2026-03-25-inspect-batch-mode.md`
- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
- `docs/researches/research-2026-02-13-batch-file-counting.md`
- `docs/researches/research-2026-02-19-batch-concurrency-jobs.md`

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`
- `docs/plans/plan-2026-02-17-path-mode-clarity-and-regex-filtering.md`
- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`

## Related Jobs

- `docs/plans/jobs/2026-03-25-inspect-batch-phase1-phase2-implementation.md`
- `docs/plans/jobs/2026-03-25-inspect-json-pretty-output.md`
