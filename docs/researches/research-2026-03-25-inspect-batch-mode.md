---
title: "inspect batch mode"
created-date: 2026-03-25
modified-date: 2026-03-25
status: draft
agent: codex
---

## Goal

Define the recommended contract for batch and directory-oriented `inspect` behavior after the first single-input inspect contract is implemented.

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
- Inspect still benefits from a lightweight batch summary, but not a merged inspect result.
  - Users need quick visibility into how many files succeeded, skipped, or failed.
  - That summary should be metadata about the batch run, not a synthetic detector-inspection result merged across files.
- Inspect batch should stay aligned with the current CLI alias model.
  - Counting already uses `-p, --path` for repeatable path input.
  - Inspect already uses `-p, --path <file>` for single-file input.
  - Reusing that alias pair for batch inspect is more consistent than introducing a new path flag family.
  - The inspect subcommand should keep `--path` usage as similar as practical to the main counting CLI and only diverge where inspect-specific output or validation constraints require it.
- Inspect should reuse counting’s path-acquisition model, not counting’s aggregation model.
  - Multi-path inspect should accept repeated `-p, --path` for both file and directory inputs.
  - Directory inputs should follow the same resolution conventions as counting so users do not need to learn a second path workflow.
  - What should remain inspect-specific is the output contract, not the meaning of `--path`.
- `--section` interaction becomes more significant in batch inspect.
  - Markdown frontmatter/content splits can change the detector diagnosis materially.
  - Batch inspect should not casually inherit section-oriented output without a deliberate contract.

## Settled Design

The inspect batch contract is settled in this research and should be treated as implementation direction, not as a deferred route.

Core CLI shape:

- use repeated `-p, --path <path>` for batch input
- accept file and directory inputs
- reuse counting path rules for:
  - `--path-mode auto|manual`
  - `--no-recursive`
  - `--include-ext`, `--exclude-ext`, and `--regex`
- default to `--path-mode auto`, matching counting
- keep `--jobs` out of scope for inspect
- keep `--merged` / `--per-file` counting-only

Core inspect-specific rules:

- batch inspect stays per-file only
- add batch-level `summary` metadata, but no merged detector-inspection result
- support `--format standard` and `--format json`
- reject `--format raw`
- support `--section all|frontmatter|content`
- reject `split`, `per-key`, and `split-per-key`
- keep batch execution result-first, with no progress UI

## JSON Contract

Top-level JSON shape:

```json
{
  "schemaVersion": 1,
  "kind": "detector-inspect-batch",
  "detector": "wasm",
  "view": "pipeline",
  "section": "content",
  "summary": {
    "requestedInputs": 2,
    "succeeded": 1,
    "skipped": 1,
    "failed": 1
  },
  "files": [
    {
      "path": "/abs/path/a.md",
      "result": { "... single inspect result ..." }
    }
  ],
  "skipped": [
    {
      "path": "/abs/path/ignored.js",
      "reason": "extension excluded"
    }
  ],
  "failures": [
    {
      "path": "/abs/path/b.md",
      "reason": "not readable: EACCES ..."
    }
  ]
}
```

JSON rules:

- output is object-based, not a bare array
- `summary` is metadata only and must not be treated as a merged inspect result
- `summary.requestedInputs` counts raw `-p, --path` occurrences before expansion or dedupe
- `summary.succeeded` equals `files.length`
- `summary.skipped` equals `skipped.length`
- `summary.failed` equals `failures.length`
- `files` entries use `{ path, result }`
- `skipped` entries use `{ path, reason }`
- `failures` entries use `{ path, reason }`
- paths in all arrays are resolved absolute paths
- order `files`, `skipped`, and `failures` by resolved path ascending

## Path And Section Rules

Path rules:

- repeated `--path` values mean multi-input processing
- default `--path-mode` is `auto`
- explicit `-p <dir>` expands in `--path-mode auto`
- explicit `-p <dir>` is a `failures` entry with `reason: "not a regular file"` in `--path-mode manual`
- dedupe successful targets by resolved absolute path across:
  - repeated file inputs
  - repeated directory inputs
  - file-plus-directory overlap
- `skipped` is reserved for non-fatal outcomes discovered during directory expansion, not for explicit invalid path inputs

Section rules:

- support `--section all`, `--section frontmatter`, and `--section content`
- reject `--section split`, `--section per-key`, and `--section split-per-key`
- when the selected section is missing or empty for a file, return a valid empty inspect result for that file rather than a skip or failure

## Failure And Exit Rules

Reason vocabulary should reuse current batch-count wording where the semantics match:

- `not readable: <message>`
- `not a regular file`
- `directory read failed: <message>`
- `extension excluded`
- `regex excluded`
- `binary file`

Outcome rules:

- explicit-path failures include:
  - unreadable explicit path
  - explicit non-file target
  - explicit binary file
- directory-scan skips include:
  - `extension excluded`
  - `regex excluded`
  - `binary file` for discovered files that pass path resolution but fail the text-like file guard
- continue processing after per-path failures
- return non-zero when any `failures` entry is present
- return non-zero when `files` is empty after path resolution and filtering, even if `failures` is empty
- return `0` when `files` is non-empty and `failures` is empty, even if `skipped` entries are present
- still emit the JSON container when failures or skips are present, including cases where `files` is empty
- a directory run where every candidate is excluded by directory filters should produce:
  - `files: []`
  - one or more `skipped` entries
  - `failures: []`
  - exit status `1`

## Standard Rendering

Standard batch rendering should:

- print one batch header first:
  - `Detector inspect batch`
  - `View: ...`
  - `Detector: ...`
  - `Section: ...`
  - `Requested inputs: ...`
  - `Summary: X succeeded, Y skipped, Z failed`
- then print one file block per `files` entry in path order
- start each file block with `File: <path>`
- reuse the current single-result standard inspect body after the file line
- then print `Skipped` and `Failures` sections, when present, in path order
- render `Skipped` entries as one line each:
  - `<path> | <reason>`
- render `Failures` entries as one line each:
  - `<path> | <reason>`
- do not reuse the full `File: <path>` inspect block style for `Skipped` or `Failures`
- remain deterministic and result-first, with no progress UI
- always print the batch header, even when `files` is empty
- when `files` is empty:
  - omit per-file inspect blocks
  - still print `Skipped` and `Failures` sections when present
  - rely on the header summary plus those sections to explain the non-zero outcome

Representative commands:

```bash
word-counter inspect -p a.md -p ./docs -f json
word-counter inspect -p ./docs --path-mode auto --include-ext .md,.mdx -f json
word-counter inspect -p ./docs --path-mode manual -f json
word-counter inspect -p ./docs --section content --format standard
```

## Implementation Direction

An implementation plan for inspect batch should implement the settled contract in this document.

Minimum implementation areas:

- CLI parsing for repeated `-p, --path`
- shared counting-style path resolution for files and directories
- batch JSON container with `summary`, `files`, `skipped`, and `failures`
- standard batch rendering using per-file blocks
- `--section all|frontmatter|content` validation and input slicing
- exit-status handling for mixed success / skip / failure outcomes
- regression coverage for:
  - dedupe and ordering
  - explicit directory behavior in `auto` vs `manual`
  - directory-filter skips
  - empty selected sections
  - summary-count parity with payload arrays

Out of scope for that plan:

- configurable `contentGate` behavior
- changes to the first single-input inspect contract
- detector engine changes unrelated to batch orchestration
- count-style merged/per-file aggregation flags

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`

## Related Research

- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
- `docs/researches/research-2026-02-13-batch-file-counting.md`
- `docs/researches/research-2026-02-19-batch-concurrency-jobs.md`
