---
title: "global debug observability model"
created-date: 2026-03-24
modified-date: 2026-03-24
status: in-progress
agent: Codex
---

## Goal

Define a repository-wide observability model for `word-counter` so debug and diagnostics data can be added consistently across single-input runs, batch runs, detector workflows, and future operational surfaces without breaking the stable output contract.

## Key Findings

- The current debug system is event-stream based, not result-schema based:
  - `src/cli/debug/channel.ts` emits structured JSON events
  - events are routed to `stderr` or a `.jsonl` debug report file
  - `--verbose` controls event volume through `compact` vs `verbose`
- The current debug channel is wired primarily into batch execution:
  - `src/command.ts` creates the channel globally for CLI counting
  - `src/cli/runtime/batch.ts` actively emits batch/path/progress-related events
  - single-input counting does not currently emit parallel runtime debug events
- Current JSON result payloads are mostly result-oriented, but there is already one mixed behavior:
  - per-file JSON can include `skipped` when debug skip diagnostics are enabled
- Existing docs already cover adjacent but narrower concerns:
  - `docs/researches/research-2026-02-13-cli-progress-indicator.md` defines progress/debug separation for batch UX
  - `docs/plans/plan-2026-02-16-debug-verbosity-and-report-file.md` defines compact/verbose debug routing and report-file behavior
  - `docs/researches/research-2026-02-17-json-output-schema-contract.md` defines additive JSON contract thinking for result payloads
  - `docs/researches/research-2026-03-13-doctor-command.md` defines a standalone diagnostics command
  - `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md` identifies detector-specific observability needs
- What is still missing is a global model that distinguishes:
  - stable result metadata
  - debug-only diagnostics
  - runtime event streams
  - topic/scope semantics shared across subsystems

## Current Mechanics Snapshot

### Debug Channel

- `--debug` enables structured diagnostics.
- `--verbose` enables higher-volume events.
- `--debug-report [path]` writes JSONL diagnostics to a file.
- `--debug-report-tee` / `--debug-tee` mirror the file stream to `stderr`.

### Output Behavior

- Normal counting results still go to `stdout`.
- Debug events go to `stderr` unless redirected to a report file.
- Per-file JSON output may also include debug-gated `skipped` data today.

### Event Shape Today

- Current debug entries are minimally structured JSON:
  - `event`
  - arbitrary event-specific fields
- There is no common event envelope yet for:
  - timestamp
  - run identifier
  - topic
  - scope
  - schema version
  - severity

## Design Problem

The repository now has enough operational features that local one-off diagnostics decisions are starting to collide:

- batch routing wants debug events
- detector quality work wants per-window metrics
- JSON output wants stable additive metadata
- doctor wants machine-readable host diagnostics

Without a single model, each new feature risks inventing its own payload shape and routing rules.

## Proposed Direction

Use a three-layer observability model:

### 1. Stable Result Metadata

Use `meta` for small, additive, stable fields that are part of the normal result contract.

Examples:

- `meta.detector.mode`
- `meta.detector.engine`
- `meta.totalOf`
- `meta.totalOfOverride`

Rules:

- must be additive
- must be small and predictable
- safe for downstream parsers
- should not expose high-volume internal traces

### 2. Debug-Gated Result Diagnostics

Use a dedicated debug section in JSON output only when debug-gated behavior explicitly allows it.

Examples:

- `debug.detector`
- `debug.batch`
- `debug.skipped`

Rules:

- only present when debug gating is enabled
- explicitly documented as non-default diagnostics
- heavier and more operational than `meta`
- should not appear silently in normal JSON output

### 3. Runtime Event Stream

Keep JSONL event reports as the highest-detail runtime trace surface.

Examples:

- path resolution decisions
- batch stage timings
- detector window acceptance/rejection events
- fallback reasons

Rules:

- streaming-friendly
- topic-based
- suitable for postmortem/debug analysis
- not part of the stable result payload contract

## Recommended Global Vocabulary

- `meta`: stable result metadata
- `debug`: debug-gated result diagnostics
- `event stream`: runtime trace records
- `topic`: subsystem such as `path`, `batch`, `detector`, `runtime`, `doctor`
- `scope`: unit of observation such as `run`, `file`, `section`, `chunk`, `detector-window`
- `verbosity`: `compact` or `verbose`

## Non-Overlap Boundaries

This model should not replace or duplicate the following:

- Batch progress UX:
  - keep progress behavior in the existing progress docs and plans
  - this doc only defines observability structure
- Doctor command:
  - doctor remains a standalone host-capability command
  - this doc only defines cross-cutting diagnostics conventions that doctor may reuse
- Detector quality tuning:
  - detector policy changes remain in the WASM detector quality plan
  - this doc only defines how detector diagnostics should be exposed consistently
- Existing JSON feature metadata:
  - current `meta.totalOf` and related result metadata stay where they are
  - this doc extends the contract shape rather than replacing it

## Recommendations

- Add a common debug event envelope before more subsystems add one-off event shapes.
- Extend debug coverage to single-input execution so the model is not batch-only.
- Move toward a consistent policy:
  - `meta` for stable additive metadata
  - `debug` for debug-gated result diagnostics
  - JSONL for rich runtime traces
- Keep default JSON output result-oriented and conservative.
- Treat any debug data in result JSON as additive and explicitly gated.

## Research Sequencing

- The contract questions are now resolved well enough to move this work into implementation planning.
- Once those questions are resolved, the implementation plan should still keep the work sliced into clear phases:
  - event-envelope normalization
  - single-input debug parity
  - detector observability adoption
  - JSON result metadata additions
- Treat detector quality work as a consumer of this model, not the owner of it.

## Recommended Resolution of Open Questions

- Enable debug-gated JSON diagnostics through `--debug --format json` in the first contract version.
  - Keep the gate global and predictable at first.
  - Defer topic-specific flags unless a later subsystem proves that result JSON volume is too large for one shared debug gate.
  - Keep richer topic-level detail in the JSONL event stream rather than multiplying JSON result flags early.
- Add explicit event-stream schema versioning now, together with the first shared event envelope.
  - Recommended minimum shared envelope fields:
    - `schemaVersion`
    - `timestamp`
    - `runId`
    - `topic`
    - `scope`
    - `event`
  - Optional envelope fields can then grow from a stable base:
    - `severity`
    - `verbosity`
  - Adding schema versioning before more topics land is lower-risk than retrofitting many one-off event shapes later.
- Treat top-level per-file `skipped` as a compatibility legacy shape, not the long-term debug JSON model.
  - Future normalized debug-gated JSON should hang off `debug.*`.
  - Recommended future target shape is `debug.skipped`.
  - A later implementation plan can decide whether the migration uses dual-emission, deprecation notes, or a major contract transition.

## Future Schema Documentation Notes

- Future implementation planning should include follow-up schema documentation work under `docs/schemas/`.
- Recommended documentation split:
  - one dedicated schema doc for JSONL runtime event-stream records: `docs/schemas/debug-event-stream-contract.md`
  - extend `docs/schemas/json-output-contract.md` for debug-gated JSON result diagnostics
- Each future schema doc should include a short `Version History` section that records contract changes by version/date and compatibility notes, instead of relying only on front-matter `modified-date`.

## Related Plans

- `docs/plans/plan-2026-03-24-debug-observability-and-wasm-latin-quality.md`

## Related Research

- `docs/researches/research-2026-02-13-cli-progress-indicator.md`
- `docs/researches/research-2026-02-17-json-output-schema-contract.md`
- `docs/researches/research-2026-03-13-doctor-command.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
