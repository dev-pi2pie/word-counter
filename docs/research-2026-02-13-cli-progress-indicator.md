---
title: "CLI progress indicator for long-running batch counts"
created-date: 2026-02-13
modified-date: 2026-02-16
status: completed
agent: Codex
milestone: v0.1.0
---

## Goal

Define a progress indicator for long-running counting operations so users can see active progress during batch processing.

## Milestone Goal

Deliver a `v0.1.0` canary-safe progress UX that improves user confidence during long runs without breaking machine-readable workflows.

## Key Findings

- Batch processing introduces noticeable runtime where users may otherwise see no terminal feedback.
- Progress output can conflict with automation if emitted in `raw` or `json` modes.
- The safest compatibility approach is mode-aware behavior:
  - auto-enable progress for batch operations in human-readable (`standard`) output
  - suppress progress in `raw` and `json` output
- Progress should reflect true work units (resolved file count), not bytes or estimated time, to stay simple and reliable.

## Proposed Direction

- Add TUI progress bar behavior for batch processing:
  - auto-enabled by default in `standard` mode
  - disabled with `--no-progress`
  - transient while running, then cleared/hidden before final output
- Add debug mode as a separate channel:
  - `--debug` (and optional env mapping later)
  - debug/progress details go to `stderr`
  - final results stay clean on `stdout`

## Implications or Recommendations

- Keep progress implementation lightweight:
  - single-line updates (carriage return) where possible
  - fallback to periodic line logs in non-TTY environments
- Tie progress strictly to batch operations; single-input runs skip progress.
- Add tests for:
  - progress auto-enabled for batch in standard mode
  - `--no-progress` disables progress output
  - no progress noise in `raw`/`json`
  - debug logs stay on `stderr` and do not contaminate `stdout`

## Decisions

- Progress defaults:
  - batch mode auto-enables TUI progress
  - `--no-progress` explicitly turns progress off
  - single-input mode does not show progress by default
- Output cleanliness:
  - progress is visible only while running
  - final result output is clean and does not include progress artifacts
  - `raw` and `json` outputs remain parseable and do not include progress lines
- Warning behavior:
  - no warning noise by default for progress suppression in `raw`/`json`
- Debug mode:
  - introduce `--debug` as new design for verbose runtime information
  - debug details are emitted to `stderr` only
  - this is a planned feature and not yet implemented
- Quiet mode:
  - retain as future enhancement; not required for the first progress implementation

## Mock Output (Illustrative Only)

These examples are design mocks for discussion and are not a finalized output contract.

### Standard Batch (default)

Running phase (transient progress bar):

```text
Counting files [██████░░░░░░░░░░░░] 31%  37/120  elapsed 00:01
Counting files [███████████░░░░░░░] 58%  70/120  elapsed 00:02
Counting files [██████████████████] 100% 120/120 elapsed 00:04
```

Final phase (clean result only):

```text
Total words: 48,213
Processed files: 120
Skipped files: 3
```

### Standard Batch with `--no-progress`

```text
Total words: 48,213
Processed files: 120
Skipped files: 3
```

### JSON with Debug

Command:

```text
word-counter --path ./docs --format json --debug
```

Behavior:
- `stdout`: only JSON result
- `stderr`: debug/progress diagnostics

## Related Plans

None.

## References

- `src/command.ts`
- `README.md`
- `docs/research-2026-02-13-batch-file-counting.md`
