---
title: "global debug observability model"
created-date: 2026-03-24
modified-date: 2026-03-24
status: completed
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
  - `docs/researches/archive/research-2026-02-13-cli-progress-indicator.md` defines progress/debug separation for batch UX
  - `docs/plans/archive/plan-2026-02-16-debug-verbosity-and-report-file.md` defines compact/verbose debug routing and report-file behavior
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

## Current Contract Mocks

### Current Runtime Event JSONL Mock

Current report lines are flat JSON objects with no shared envelope:

```json
{"event":"batch.resolve.start","inputs":2,"pathMode":"auto","recursive":false}
{"event":"path.resolve.root.expand","root":"<resolved-path>","recursive":false,"regex":null}
{"event":"batch.stage.timing","stage":"resolve","elapsedMs":4}
```

Properties of the current shape:

- keeps event-specific fields top-level
- works well for ad hoc `jq`/grep-style inspection
- does not provide a per-run key for correlating lines across topics
- does not distinguish envelope fields from event payload fields

### Current Per-File JSON Debug Mock

Current per-file JSON uses a legacy top-level `skipped` field when debug-gated skip diagnostics are enabled:

```json
{
  "scope": "per-file",
  "files": [
    { "path": "<resolved-path>", "result": { "total": 2 } }
  ],
  "skipped": [
    { "path": "<resolved-path>", "reason": "extension excluded" }
  ],
  "aggregate": { "total": 2 }
}
```

Properties of the current shape:

- keeps normal result data easy to read
- mixes debug-only diagnostics into the top-level result contract
- does not leave room for multiple debug topics without accumulating more top-level fields

## Candidate Contract Mocks

### Candidate A: Flat Envelope, Preserve Current Event Names

This is the lowest-churn event-stream migration path.

```json
{"schemaVersion":1,"timestamp":"2026-03-24T00:00:00.000Z","runId":"wc-debug-1774330341123-4242","topic":"batch","scope":"run","event":"batch.resolve.start","verbosity":"compact","inputs":2,"pathMode":"auto","recursive":false}
{"schemaVersion":1,"timestamp":"2026-03-24T00:00:00.004Z","runId":"wc-debug-1774330341123-4242","topic":"path","scope":"run","event":"path.resolve.root.expand","verbosity":"compact","root":"<resolved-path>","recursive":false,"regex":null}
{"schemaVersion":1,"timestamp":"2026-03-24T00:00:00.008Z","runId":"wc-debug-1774330341123-4242","topic":"batch","scope":"run","event":"batch.stage.timing","verbosity":"compact","stage":"resolve","elapsedMs":4}
```

Benefits:

- keeps `.jsonl` and line-oriented workflow unchanged
- preserves current `event` values for existing human workflows
- keeps event-specific fields top-level for ergonomic filtering
- allows envelope growth without redesigning all current event producers

Risks:

- `topic` partly duplicates namespacing already embedded in `event`
- future field collisions remain possible because payload fields stay flat

### Candidate B: Envelope Plus Nested Payload

This is cleaner structurally, but more disruptive for current usage.

```json
{"schemaVersion":1,"timestamp":"2026-03-24T00:00:00.000Z","runId":"wc-debug-1774330341123-4242","topic":"batch","scope":"run","event":"batch.resolve.start","verbosity":"compact","payload":{"inputs":2,"pathMode":"auto","recursive":false}}
```

Benefits:

- clean separation between envelope and event-specific payload
- lower risk of future top-level field collision

Risks:

- higher migration cost for tests and ad hoc tooling
- less convenient for direct terminal inspection and `jq '.event, .elapsedMs'` style usage

### Candidate JSON Result Debug Shape

Normalized debug diagnostics can move under `debug.*` while keeping compatibility during migration:

```json
{
  "scope": "per-file",
  "files": [
    { "path": "<resolved-path>", "result": { "total": 2 } }
  ],
  "debug": {
    "skipped": [
      { "path": "<resolved-path>", "reason": "extension excluded" }
    ]
  },
  "skipped": [
    { "path": "<resolved-path>", "reason": "extension excluded" }
  ],
  "aggregate": { "total": 2 }
}
```

This transitional mock keeps current consumers working while defining the normalized destination.

## Decision Surface for Follow-Up Research

- Keep `.jsonl` as the runtime event-stream format.
  - Current tooling and the existing `--debug-report` contract already align with line-oriented output.
  - The open decision is the envelope shape, not the container format.
- Compare two event-envelope candidates before implementation:
  - flat envelope with top-level payload fields
  - envelope plus nested `payload`
- Use `schemaVersion: 1` for the first shared event-envelope contract.
  - Keep the first version numeric and minimal.
  - Future schema docs can map version history entries to git tags or release tags.
- Lock the timestamp mock to UTC ISO-8601 strings in research examples.
  - This is the least ambiguous machine-readable shape.
- Treat `runId` as an opaque per-run correlation key in the first version.
  - Selected format for follow-up planning: `wc-debug-<epochMs>-<pid>`
  - Example: `wc-debug-1774330341123-55149`
  - This keeps the prefix aligned with existing debug-report naming while avoiding a second timestamp format inside the event envelope.
  - Tests should assert presence, prefix, and stability within a run rather than hard-coding the full generated value.
- Treat the default debug-report filename as a separate contract from `runId`.
  - Selected format for follow-up planning: `wc-debug-YYYYMMDD-HHmmss-utc-<pid>.jsonl`
  - Example: `wc-debug-20260324-053221-utc-55149.jsonl`
  - This should be generated from UTC clock components, not local-time clock components.
  - Letter tokens stay lowercase for naming consistency.

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
    - `schemaVersion` with first value `1`
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
- Before implementation starts, make one explicit contract decision from the mock comparison:
  - recommended current default is Candidate A
  - keep `event` names unchanged
  - keep payload fields flat
  - add only the shared envelope fields around them
- For the first Candidate A implementation pass:
  - use `runId: "wc-debug-<epochMs>-<pid>"` as the per-run event-stream correlation key
  - change the default debug-report filename contract to `wc-debug-YYYYMMDD-HHmmss-utc-<pid>.jsonl`

## Compatibility and Version History Notes

- The shared event envelope is an additive event-stream contract change.
- The default debug-report filename contract change is a behavioral compatibility change:
  - previous default format: `wc-debug-YYYYMMDD-HHmmss-<pid>.jsonl`
  - new default format: `wc-debug-YYYYMMDD-HHmmss-utc-<pid>.jsonl`
  - previous timestamps were derived from local runtime clock components
  - new timestamps should be derived from UTC clock components
- This filename change can break scripts or workflows that match the old autogenerated filename pattern.
- Future schema docs under `docs/schemas/` should record this change explicitly in `Version History`.
  - Record version history entries by git tag or release tag, not only by document edit date.
  - Include a short compatibility note describing whether a change is additive, behavioral, or breaking for automation consumers.

## Future Schema Documentation Notes

- Future implementation planning should include follow-up schema documentation work under `docs/schemas/`.
- Recommended documentation split:
  - one dedicated schema doc for JSONL runtime event-stream records: `docs/schemas/debug-event-stream-contract.md`
  - extend `docs/schemas/json-output-contract.md` for debug-gated JSON result diagnostics
- Each future schema doc should include a short `Version History` section that records contract changes by version/date and compatibility notes, instead of relying only on front-matter `modified-date`.

## Related Plans

- `docs/plans/plan-2026-03-24-debug-observability-and-wasm-latin-quality.md`

## Related Research

- `docs/researches/archive/research-2026-02-13-cli-progress-indicator.md`
- `docs/researches/research-2026-02-17-json-output-schema-contract.md`
- `docs/researches/research-2026-03-13-doctor-command.md`
- `docs/researches/research-2026-03-24-wasm-latin-detector-quality-false-positives.md`
