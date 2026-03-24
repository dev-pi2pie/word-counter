---
title: "debug observability and WASM Latin quality"
created-date: 2026-03-24
status: draft
agent: Codex
---

## Goal

Implement the cross-cutting debug observability contract and the WASM Latin false-positive guardrails in one coordinated plan so detector diagnostics can use the same debug model while reducing wrong language upgrades on noisy technical English.

## Context

- The debug research now settles the contract direction well enough to implement:
  - debug-gated JSON diagnostics should use `--debug --format json` as the first shared gate
  - runtime JSONL events should move to a shared, versioned envelope
  - top-level per-file `skipped` should be treated as a compatibility legacy shape while normalized debug diagnostics move toward `debug.*`
- The WASM Latin quality research now settles the detector direction well enough to implement:
  - keep fallback conservative and prefer `und-Latn` over confident-but-wrong labels for technical-noise windows
  - require at least one `reliable = true` sample for Latin corroborated acceptance
  - add a Latin token-quality gate because threshold tuning alone does not address reliable false positives on command/list-like English windows
- These two tracks should be implemented together because detector-quality investigation needs better structured observability, and the new observability contract should include detector decision surfaces from the start.

## Scope

- In scope:
  - add a shared debug event envelope with schema versioning
  - extend debug coverage to single-input execution and detector workflows
  - add debug-gated JSON result diagnostics using the `debug.*` model
  - preserve compatibility for existing per-file `skipped` consumers while introducing the normalized debug placement
  - harden WASM Latin corroborated acceptance and add a Latin token-quality gate
  - add regression coverage and schema/docs updates for both tracks
- Out of scope:
  - replacing default regex detection
  - broad retuning of the primary reliable-path Latin confidence threshold unless regression results prove it is necessary
  - redesigning progress UX or doctor command output beyond adopting shared observability conventions where already in scope
  - removing the legacy top-level `skipped` field in this plan

## Decisions Settled for This Plan

- `--debug --format json` is the first shared gate for debug-gated JSON result diagnostics.
- Runtime debug events gain a shared envelope now with these minimum fields:
  - `schemaVersion`
  - `timestamp`
  - `runId`
  - `topic`
  - `scope`
  - `event`
- Optional shared envelope fields may include:
  - `severity`
  - `verbosity`
- Per-file top-level `skipped` remains temporarily for compatibility, but normalized debug diagnostics should be added under `debug.*` in the same phase.
- The normalized per-file skipped-path placement for this plan is `debug.skipped`.
- The selected first-pass `runId` format is `wc-debug-<epochMs>-<pid>`.
- The selected default debug-report filename format is `wc-debug-YYYYMMDD-HHmmss-utc-<pid>.jsonl`.
  - This replaces the previous local-time default filename format.
- Latin corroborated acceptance must require at least one corroborating sample with `reliable = true`.
- The initial detector-quality fix should prioritize a Latin token-quality gate before any broad threshold increase.
- If the tighter policy causes some borderline markdown/frontmatter-like Latin windows to remain `und-Latn`, that tradeoff is acceptable in this phase.

## Phase Task Items

### Phase 1 - Contract Scaffolding and Envelope Foundation

- [ ] Add a shared debug event envelope abstraction in the debug channel and route existing event emission through it.
- [ ] Introduce stable generation for `runId` and event timestamps for every debug-enabled CLI run.
- [ ] Normalize topic/scope naming for current batch/path events so future detector and single-input events can reuse the same vocabulary.
- [ ] Preserve current compact vs verbose filtering behavior while moving event shape generation behind the shared envelope.
- [ ] Add regression coverage for envelope presence, schema versioning, and routing to terminal vs debug report sinks.
- [ ] Add regression coverage for `runId` presence/stability and the new UTC default debug-report filename contract.

### Phase 2 - Single-Input Debug Parity and JSON Debug Surfaces

- [ ] Extend debug instrumentation into single-input counting paths so non-batch runs emit runtime diagnostics under the same model.
- [ ] Add debug-gated JSON result diagnostics for `--debug --format json`.
- [ ] Introduce normalized `debug.*` payload placement for result diagnostics while keeping default JSON output result-oriented when debug is not enabled.
- [ ] For per-file JSON, add `debug.skipped` for skipped-path diagnostics and retain top-level `skipped` as a compatibility legacy shape in this phase.
- [ ] Add tests covering:
  - single-input debug event emission
  - debug JSON gating behavior
  - compatibility behavior for per-file `skipped`

### Phase 3 - Detector Observability Adoption

- [ ] Add detector-focused debug events that expose raw decision stages without making normal JSON output noisy.
- [ ] Instrument detector window routing, normalized-sample use, acceptance path, fallback reason, and final locale outcome under the shared event envelope.
- [ ] Add compact detector summary events plus verbose per-window events so false-positive investigation can use the same contract as batch/path diagnostics.
- [ ] Add debug-gated JSON detector diagnostics only for small, additive summaries that are useful to downstream consumers.

### Phase 4 - WASM Latin Quality Guardrails

- [ ] Build a focused regression corpus for noisy English README/CLI/docs windows and known non-English Latin fixtures.
- [ ] Change Latin corroborated acceptance so matching raw/normalized remaps are not enough on their own; at least one corroborating sample must be `reliable = true`.
- [ ] Add a Latin token-quality gate ahead of final detector acceptance for ambiguous Latin windows.
- [ ] Keep the main reliable-path threshold unchanged initially unless the new corpus shows a clear need for targeted retuning.
- [ ] Add tests proving:
  - noisy English technical samples stay `und-Latn` or resolve to `en`, not `fr`
  - valid non-English Latin prose can still upgrade correctly
  - borderline markdown/frontmatter-like samples behave according to the new conservative policy

### Phase 5 - Schema Docs, CLI Docs, and Closure

- [ ] Add `docs/schemas/debug-event-stream-contract.md` for the versioned debug event stream.
- [ ] Extend `docs/schemas/json-output-contract.md` for the debug-gated JSON result diagnostics contract.
- [ ] Add `Version History` sections to the new or updated schema docs so contract evolution is recorded explicitly by git tag or release tag.
- [ ] Update README guidance where debug JSON, debug reports, and detector behavior need user-facing clarification.
- [ ] Document the default debug-report filename change as a compatibility note for users and automation consumers.
- [ ] Add completion job records under `docs/plans/jobs/` once implementation phases land.

## Compatibility Gates

- [ ] Default non-debug output remains unchanged.
- [ ] Existing `--debug`, `--verbose`, `--debug-report`, and `--debug-report-tee` routing behavior remains intact aside from the new shared event envelope shape.
- [ ] The default autogenerated debug-report filename change is treated as a compatibility-impacting change and documented explicitly.
- [ ] Existing per-file top-level `skipped` consumers continue to work during this phase.
- [ ] `--detector wasm` keeps the already-fixed detector-first Latin hint ordering behavior.
- [ ] The new Latin guardrails bias toward fallback to `und-Latn` rather than broadening forced language upgrades.

## Validation

- `bun test test/word-counter.test.ts`
- `bun test test/command.test.ts`
- `bun run type-check`
- `bun run build`

## Related Research

- `docs/researches/research-2026-03-24-global-debug-observability-model.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
- `docs/researches/research-2026-02-17-json-output-schema-contract.md`
- `docs/researches/research-2026-02-18-wasm-language-detector-spike.md`

## Related Plans

- `docs/plans/plan-2026-02-16-debug-verbosity-and-report-file.md`
- `docs/plans/plan-2026-03-24-wasm-mode-latin-hint-ordering.md`
