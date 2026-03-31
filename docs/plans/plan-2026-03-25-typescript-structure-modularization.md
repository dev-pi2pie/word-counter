---
title: "TypeScript structure modularization follow-up"
created-date: 2026-03-25
modified-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Reduce maintenance risk in the current oversized TypeScript files with small, behavior-preserving modularization passes that match the repo's existing CLI, detector, and `wc` split patterns.

## Context

- `src/cli/inspect/run.ts` now combines inspect-specific parsing, validation, file loading, section slicing, batch classification, standard rendering, JSON shaping, and top-level execution.
- `src/detector/wasm.ts` now combines hint-deferral helpers, detector window construction, engine execution, debug/evidence emission, window resolution, counting entrypoints, and inspect entrypoints.
- `src/cli/path/resolve.ts` mixes recursive directory traversal, dedupe, regex/filter tracking, and debug accounting in one file.
- `src/cli/batch/aggregate.ts` mixes per-mode merge logic, section aggregation, segment compaction, and batch-summary orchestration.
- `test/command.test.ts` and `test/word-counter.test.ts` are broad integration files with many unrelated domains in one place, which makes source refactors harder to review.
- Recent repo history already favors thin orchestrators plus focused modules:
  - `src/command.ts` was previously reduced by moving runtime and output logic into `src/cli/**`.
  - `src/wc/wc.ts` was previously reduced by moving locale detection, segmentation, and analysis into `src/wc/**`.

## Ranked Candidates

### 1. `test/command.test.ts`

- Highest-value first split.
- The file currently mixes path resolution, detector mode, inspect, batch aggregation, jobs, doctor, progress, debug, filters, totals, and compatibility gates.
- A test-only split is low risk and improves the safety of every source refactor that follows.

Proposed layout:

- `test/support/cli-harness.ts`
- `test/command-path-resolution.test.ts`
- `test/command-detector.test.ts`
- `test/command-inspect.test.ts`
- `test/command-batch-output.test.ts`
- `test/command-jobs.test.ts`
- `test/command-doctor.test.ts`
- `test/command-progress.test.ts`
- `test/command-debug.test.ts`
- `test/command-filters.test.ts`
- `test/command-total-of.test.ts`
- `test/command-compatibility.test.ts`

Expected import/export changes:

- Move shared fixture helpers (`makeTempFixture`, `captureCli`, debug-event parsing helpers, captured stream helpers) into `test/support/cli-harness.ts`.
- Keep test assertions unchanged; only rebalance imports.

### 2. `src/cli/inspect/run.ts`

- Strongest source refactor candidate.
- The file has at least four distinct responsibilities with obvious seams.
- It also grew immediately after the inspect-batch work, so the split can follow the settled contract instead of changing behavior.

Proposed layout:

- `src/cli/inspect/run.ts` as thin public entry
- `src/cli/inspect/parse.ts`
- `src/cli/inspect/help.ts`
- `src/cli/inspect/input.ts`
- `src/cli/inspect/render.ts`
- `src/cli/inspect/batch.ts`

Write boundaries:

- `parse.ts`: option parsing, validation, inspect-local types
- `input.ts`: single-path loading, batch input loading, section selection
- `render.ts`: single-result and batch standard rendering
- `batch.ts`: batch JSON payload creation and batch execution helpers
- `run.ts`: `isExplicitInspectInvocation` and `executeInspectCommand`

Expected import/export changes:

- Internal only.
- Keep `executeInspectCommand` and `isExplicitInspectInvocation` exported from `src/cli/inspect/run.ts`.

### 3. `src/cli/path/resolve.ts`

- Good medium-risk follow-up after the test split.
- The file is structurally dense rather than algorithmically complex, so extraction should be straightforward.
- It is shared by counting and inspect flows, so clearer boundaries here reduce duplicated future fixes.

Proposed layout:

- `src/cli/path/resolve.ts` as facade
- `src/cli/path/resolve-directory.ts`
- `src/cli/path/resolve-debug.ts`
- `src/cli/path/resolve-types.ts`

Write boundaries:

- directory traversal and filtering
- dedupe and direct-vs-directory source reconciliation
- debug stats/default channel helpers

Expected import/export changes:

- Keep `resolveBatchFileEntries` and `resolveBatchFilePaths` exported from `src/cli/path/resolve.ts`.
- New helpers stay internal to `src/cli/path/**`.

### 4. `src/cli/batch/aggregate.ts`

- Clear candidate with predictable seams by breakdown mode.
- Most of the file is mechanical merge logic, which is a good refactor target once the CLI tests are easier to navigate.

Proposed layout:

- `src/cli/batch/aggregate.ts` as facade
- `src/cli/batch/aggregate-word-counter.ts`
- `src/cli/batch/aggregate-sections.ts`
- `src/cli/batch/aggregate-compact.ts`

Write boundaries:

- word-counter result merge logic
- sectioned-result grouping and ordering
- collector-segment stripping/compaction
- top-level batch-summary assembly

Expected import/export changes:

- Keep `buildBatchSummary`, `finalizeBatchSummaryFromFileResults`, and `compactCollectorSegmentsInCountResult` exported from `src/cli/batch/aggregate.ts`.

### 5. `src/detector/wasm.ts`

- Largest file and most obvious long-term modularization target.
- Not the first handoff because it is also the highest-risk file: it is recent, async, policy-driven, and tied to debug/evidence and inspect contracts.
- It should be split only after the test harness and nearby CLI modules are easier to work with.

Proposed layout:

- `src/detector/wasm.ts` as public facade
- `src/detector/wasm-presegment.ts`
- `src/detector/wasm-windows.ts`
- `src/detector/wasm-engine.ts`
- `src/detector/wasm-resolution.ts`
- `src/detector/wasm-inspect.ts`

Write boundaries:

- Latin hint deferral and relabel helpers
- detector-window construction
- engine execution and remap packaging
- resolution + evidence/debug emission
- inspect-result shaping

Expected import/export changes:

- Keep the current public exports in `src/detector/wasm.ts` unchanged.
- New modules stay internal to `src/detector/**`.

### 6. `test/word-counter.test.ts`

- Worth splitting, but after the main source refactors.
- It currently mixes `wc` behavior, detector entrypoints, segmentation, counting helpers, char modes, and collector/non-word coverage.

Proposed layout:

- `test/word-counter-core.test.ts`
- `test/word-counter-detector.test.ts`
- `test/segment-text-by-locale.test.ts`
- `test/word-counter-char-modes.test.ts`
- `test/word-counter-collector.test.ts`

## Do Not Refactor Yet

### `src/detector/policy.ts`

- The file is above the line-count threshold, but the responsibilities are still cohesive: route policy types, sample construction, content-gate logic, acceptance thresholds, and exported route policies.
- It was just extracted as a policy boundary on 2026-03-25.
- Splitting it again immediately would increase churn without much readability gain.

### `src/wc/locale-detect.ts`

- The file is moderately oversized, but it is a stable follow-up module from the earlier `wc.ts` split.
- Its two main concerns are related enough to keep together for now:
  - hint/context resolution
  - per-character locale detection
- Only revisit if more script families or hint-rule complexity are added.

### `src/cli/batch/jobs/worker-pool.ts`

- This file can be improved, but it is concurrency-sensitive and only lightly above the threshold.
- The best first pass here is a later extraction of worker-entry discovery and runtime bookkeeping after the higher-value CLI and detector refactors land.

## Phase Task Items

### Phase 1 - CLI Test Harness and Command Spec Split

- [x] Split `test/command.test.ts` into focused spec files plus a shared harness module.
- [x] Move temp-fixture helpers, `captureCli`, JSON capture helpers, debug-event parsers, and captured progress-stream helpers into `test/support/cli-harness.ts`.
- [x] Preserve existing assertions and test intent exactly; this phase should not change product code.
- [x] Keep the split aligned to the current describe-block domains:
  - path resolution
  - detector mode
  - inspect
  - batch aggregation and batch output
  - jobs
  - doctor
  - progress
  - debug
  - filters
  - total-of
  - compatibility gates

### Phase 2 - Inspect Command Modularization

- [x] Refactor `src/cli/inspect/run.ts` into a thin entry file plus focused helpers under `src/cli/inspect/`.
- [x] Extract inspect-local parsing and validation into `src/cli/inspect/parse.ts`.
- [x] Extract help text and help rendering into `src/cli/inspect/help.ts`.
- [x] Extract path loading, binary rejection, and section selection into `src/cli/inspect/input.ts`.
- [x] Extract standard output shaping for single-input and batch flows into `src/cli/inspect/render.ts`.
- [x] Extract batch JSON payload creation and batch execution helpers into `src/cli/inspect/batch.ts`.
- [x] Keep only `executeInspectCommand` and `isExplicitInspectInvocation` exported from `src/cli/inspect/run.ts`.
- [x] Preserve help text, validation messages, batch JSON shape, standard rendering, and exit-code behavior exactly.

### Phase 3 - Shared Path-Resolution Split

- [x] Refactor `src/cli/path/resolve.ts` into a facade plus internal helper modules.
- [x] Extract directory traversal and filter application into `src/cli/path/resolve-directory.ts`.
- [x] Extract debug stats and debug-channel helpers into `src/cli/path/resolve-debug.ts`.
- [x] Extract shared types and bookkeeping helpers into `src/cli/path/resolve-types.ts` or an equivalent internal boundary.
- [x] Preserve ordering, skip reasons, regex-excluded accounting, and direct-vs-directory precedence exactly.
- [x] Keep `resolveBatchFileEntries` and `resolveBatchFilePaths` as the stable public functions in `src/cli/path/resolve.ts`.

### Phase 4 - Batch Aggregation Split

- [x] Refactor `src/cli/batch/aggregate.ts` into a facade plus merge-domain helpers.
- [x] Extract word-counter result merge logic into `src/cli/batch/aggregate-word-counter.ts`.
- [x] Extract sectioned-result grouping and ordering into `src/cli/batch/aggregate-sections.ts`.
- [x] Extract collector-segment stripping and compaction helpers into `src/cli/batch/aggregate-compact.ts`.
- [x] Keep `buildBatchSummary`, `finalizeBatchSummaryFromFileResults`, and `compactCollectorSegmentsInCountResult` exported from `src/cli/batch/aggregate.ts`.
- [x] Preserve output totals, section ordering, and collector-compaction behavior exactly.

### Phase 5 - WASM Detector Helper Extraction

- [x] Refactor `src/detector/wasm.ts` in staged, compatibility-first passes rather than one large rewrite.
- [x] First extract Latin hint deferral and relabel helpers into `src/detector/wasm-presegment.ts`.
- [x] First extract detector-window construction helpers into `src/detector/wasm-windows.ts`.
- [x] In a follow-up pass, extract engine execution and remap packaging into `src/detector/wasm-engine.ts` if the first pass remains stable.
- [x] In a follow-up pass, extract window resolution and evidence/debug emission into `src/detector/wasm-resolution.ts` if the first pass remains stable.
- [x] Extract inspect-specific result shaping into `src/detector/wasm-inspect.ts` only when the prior helper extraction is complete.
- [x] Preserve exported function names, debug event payloads, inspect payload shapes, and fallback behavior exactly.

### Phase 6 - Word Counter Test Split

- [x] Split `test/word-counter.test.ts` after the source-module boundaries above have settled.
- [x] Separate coverage into focused files for core counting, detector entrypoints, segmentation, char modes, and collector behavior.
- [x] Keep current assertions intact while updating imports to match the refactored boundaries.

## Execution Notes

- Prefer additive extraction with thin orchestrator files, matching the earlier `src/command.ts` and `src/wc/wc.ts` refactors.
- Keep public export surfaces stable during each phase.
- Keep each phase small enough to review and verify independently.
- Do not combine Phase 5 with other source refactors in the same pass.

## Validation

- Run targeted tests after each completed phase.
- Run at minimum:
  - `bun test test/command*.test.ts`
  - `bun test test/word-counter*.test.ts`
  - `bun run type-check`
- Run a broader build/test pass after any change to `src/detector/wasm.ts` or shared CLI path logic.

## Refactorer Handoff Prompts

### Chunk 1: CLI test harness and command spec split

Refactor `test/command.test.ts` into focused spec files plus one shared helper module. Preserve assertions and behavior exactly. Move temp-fixture helpers, `captureCli`, JSON capture helpers, debug-event parsers, and captured-progress-stream helpers into `test/support/cli-harness.ts`. Then split the describe blocks into domain files that mirror the current sections. Do not change product code in this pass.

### Chunk 2: Inspect command modularization

Refactor `src/cli/inspect/run.ts` into a thin entry file plus focused helpers under `src/cli/inspect/`. Preserve the current CLI contract exactly, including help text, validation messages, batch JSON shape, standard rendering, and exit-code behavior. Keep only `executeInspectCommand` and `isExplicitInspectInvocation` exported from `src/cli/inspect/run.ts`.

### Chunk 3: Shared path-resolution split

Refactor `src/cli/path/resolve.ts` by extracting directory traversal/filtering, dedupe bookkeeping, and debug-channel helpers into internal modules. Preserve ordering, skip reasons, regex-excluded accounting, and direct-vs-directory precedence exactly. Keep `resolveBatchFileEntries` and `resolveBatchFilePaths` as the stable public functions in `src/cli/path/resolve.ts`.

### Chunk 4: WASM detector helper extraction

Refactor `src/detector/wasm.ts` in a compatibility-first pass by extracting only internal helpers. First move the Latin hint deferral/relabel and detector-window construction helpers into separate modules. Then, in a second pass if needed, extract engine execution plus window-resolution/evidence helpers. Do not change exported function names, debug event payloads, inspect payload shapes, or fallback behavior.

## Related Plans

- `docs/plans/archive/plan-2026-01-02-wc-refactor-locale-research.md`
- `docs/plans/archive/plan-2026-02-16-command-ts-separation-pass-2.md`
- `docs/plans/plan-2026-02-19-batch-jobs-concurrency.md`
- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`
- `docs/plans/plan-2026-03-25-inspect-batch-command.md`
