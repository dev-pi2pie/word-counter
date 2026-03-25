---
title: "inspect batch mode"
created-date: 2026-03-25
modified-date: 2026-03-25
status: draft
agent: codex
---

## Goal

Define the follow-up design space for batch and directory-oriented `inspect` behavior after the first single-input inspect contract is implemented.

## Key Findings

- The current inspect contract intentionally stays single-input only.
  - The detector-policy and inspect research settled:
    - positional text input, or
    - one `--path <file>`
  - Batch and directory inspection were explicitly left out of the first version.
- Batch inspect is not just “repeat single inspect many times.”
  - As soon as multiple inputs are allowed, the project must define:
    - output grouping
    - partial failure behavior
    - ordering guarantees
    - path filtering semantics
    - possible progress behavior
    - JSON shape for multiple inspect results
- The existing batch counting model is a useful reference, but inspect should not inherit it automatically.
  - Counting already has merged/per-file concepts, directory traversal, recursion, filters, and jobs.
  - Inspect output is diagnostic and verbose by nature, so a direct reuse of counting aggregation may create noisy or oversized payloads.
- The most likely near-term need is file-list inspection, not merged detector aggregation.
  - Users will often want to inspect several files independently.
  - A merged detector-inspection summary would require a second-layer contract that is much less obvious than per-file output.
- Directory support likely belongs after multi-file file-list support.
  - Repeated `--path <file>` is the smallest step beyond single-input inspect.
  - Directory traversal adds recursion, path-mode, filtering, and file-type policy questions all at once.
- `--section` interaction becomes more significant in batch inspect.
  - Markdown frontmatter/content splits can change the detector diagnosis materially.
  - Batch inspect should not casually inherit section-oriented output without a deliberate contract.

## Implications or Recommendations

- Treat inspect batch mode as a separate follow-up feature, not an incremental CLI flag toggle.
- Prefer a phased design:
  - first: repeated file inputs only
  - later: directory traversal
  - only after that: any merged or aggregate inspection summary
- Keep per-file inspect results as the default batch unit.
  - The first batch-oriented output should likely be a list of independent inspect results keyed by path.
  - Avoid inventing a merged detector summary until a real need is shown.
- Preserve deterministic ordering.
  - If multiple file inputs are allowed, results should follow a stable documented order.
  - A reasonable default is resolved path ascending.
- Partial failures should be explicit and non-silent.
  - Batch inspect should not hide unreadable or invalid files.
  - The follow-up research needs to decide whether failures are:
    - hard-stop
    - per-file reported while continuing
    - configurable
- Keep batch inspect separate from counting-batch flags unless the contract is deliberately aligned.
  - Reusing `--jobs`, `--path-mode`, `--recursive`, `--include-ext`, `--exclude-ext`, or `--regex` should be a conscious follow-up decision, not an accidental inheritance.

## Recommended First Batch Phase

The recommended first batch-oriented inspect phase is:

- repeated explicit file inputs only
- no directory inputs
- no recursive traversal
- no batch progress UI
- no aggregate or merged detector summary
- no new `--section` expansion in the same phase
- JSON output only in this first batch phase
  - `--format standard` stays deferred until a dedicated text rendering contract is designed

Recommended first batch CLI direction:

```bash
word-counter inspect --path a.md --path b.md --format json
```

Recommended first batch JSON container:

```json
{
  "schemaVersion": 1,
  "kind": "detector-inspect-batch",
  "detector": "wasm",
  "view": "pipeline",
  "files": [
    {
      "path": "a.md",
      "result": { "... single inspect result ..." }
    }
  ],
  "failures": [
    {
      "path": "b.md",
      "error": "Failed to read input: EACCES ..."
    }
  ]
}
```

Recommended first batch rules:

- output is object-based, not a bare array
- the first batch phase is file-only by definition
- repeated `--path <file>` is the only batch input form in this phase
- positional text input is not allowed when batch inspect is used
- `--format json` is the only settled first-phase batch output contract
- `--format standard` should stay out of scope for the first batch phase until the per-file text rendering contract is separately designed
- `files` contains successful per-file inspect results
- `failures` contains explicit per-file failures
- continue processing after a per-file failure instead of hard-stopping the whole run
- return a non-zero exit status when any failure is present
- order both `files` and `failures` by resolved path ascending

## Remaining Research Questions

- If directory support is added, should it reuse the counting path-resolution contract exactly?
- Should inspect batch mode support `--section` only after the repeated-file phase is stable, or should it stay out of the first directory phase as well?
- Should batch inspect include any merged or aggregate detector summary, or only per-file results?
- Does batch inspect need progress output, or should it stay silent and result-only?

## Recommended Future Research Scope

The follow-up research should include:

- CLI contract options for repeated `--path`
- directory support tradeoffs
- JSON shape options for multiple inspect results
- error-handling policy comparison
- ordering and determinism rules
- interaction with `--section`
- interaction with existing counting batch flags

The follow-up research should stay out of:

- configurable `contentGate` behavior
- changes to the first single-input inspect contract
- detector engine changes unrelated to batch orchestration

## Recommended Candidate Evolution Path

The cleanest staged path is:

1. single-input inspect only
2. repeated explicit file inputs with per-file continuation and a `files` / `failures` JSON container
3. optional directory traversal and filters
4. only then consider aggregate or summary inspection output

This sequence minimizes contract churn because each phase adds one new dimension of complexity at a time.

## Recommended Timing

- complete and stabilize the current single-input inspect implementation first
- observe whether users mainly want:
  - repeated file inspection
  - or directory inspection
- then draft the implementation plan for inspect batch mode based on the narrower real need

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`

## Related Research

- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
- `docs/researches/research-2026-02-13-batch-file-counting.md`
- `docs/researches/research-2026-02-19-batch-concurrency-jobs.md`
