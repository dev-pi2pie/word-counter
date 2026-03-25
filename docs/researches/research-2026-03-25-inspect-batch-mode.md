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
- The most likely near-term need is file-list inspection, not merged detector aggregation.
  - Users will often want to inspect several files independently.
  - A merged detector-inspection summary would require a second-layer contract that is much less obvious than per-file output.
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

## Implications or Recommendations

- Treat inspect batch mode as a separate follow-up feature, not an incremental CLI flag toggle.
- Keep the existing inspect alias style.
  - Repeated `-p` should remain the short alias for repeated `--path` in batch inspect.
  - A new `--paths` or `--batch` flag family would add a second path idiom without enough benefit.
- Reuse the main counting CLI path model where practical.
  - Users should not have to learn a different meaning for `-p, --path` just because they switched from counting output to inspect output.
  - Inspect batch should therefore reuse the same repeatable path flag shape and path-resolution rules as counting, while remaining narrower on output and aggregation behavior.
- Reuse counting’s directory path controls for inspect batch.
  - `--path-mode auto|manual` should keep the same meaning as counting.
  - `--no-recursive` should keep the same meaning as counting.
  - `--include-ext`, `--exclude-ext`, and `--regex` should keep the same meaning as counting for directory-expanded files.
  - `--jobs` should remain out of scope because it is a concurrency control, not a path-acquisition rule.
- Keep per-file inspect results as the default batch unit.
  - The first batch-oriented output should likely be a list of independent inspect results keyed by path.
  - Avoid inventing a merged detector summary until a real need is shown.
  - `--merged` / `--per-file` should therefore stay counting-only terms for now.
- Preserve deterministic ordering.
  - If multiple file inputs are allowed, results should follow a stable documented order.
  - A reasonable default is resolved path ascending.
- Duplicate successful file targets should follow the current counting-path dedupe model.
  - If repeated `--path` values resolve to the same regular file, inspect batch should emit one `files` entry for that file.
  - Dedupe should be by resolved absolute path.
  - This keeps inspect batch aligned with the main counting CLI instead of treating repeated identical paths as separate work items.
- Partial failures should be explicit and non-silent.
  - Batch inspect should not hide unreadable or invalid files.
  - The recommended phase-1 policy is per-file reporting with continuation.
  - Hard-stop and configurable failure modes should stay out of scope for the first repeated-file phase.
- Keep inspect batch separate from counting aggregation flags even when path resolution is shared.
  - No scope flag such as `--per-file` or `--merged` is needed in the first inspect batch contract.
  - No new `--quiet-skips`-style suppression flag is needed because explicit requested-file failures should remain visible.

## Recommended Inspect Batch Contract

The recommended inspect batch contract is:

- repeated explicit file and directory inputs via `-p, --path`
- directory traversal in `--path-mode auto` with the same semantics as counting
- literal path handling in `--path-mode manual` with the same semantics as counting
- recursive directory traversal by default, with `--no-recursive` support matching counting
- `--include-ext`, `--exclude-ext`, and `--regex` support matching counting for directory-expanded files
- no batch progress UI
- no aggregate or merged detector summary
- no batch `--section` support in this phase
- JSON output only in this batch phase
  - `--format standard` stays deferred until a dedicated text rendering contract is designed

Recommended batch CLI direction:

```bash
word-counter inspect -p a.md -p ./docs -f json
word-counter inspect -p ./docs --path-mode auto --include-ext .md,.mdx -f json
word-counter inspect -p ./docs --path-mode manual -f json
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

Recommended batch rules:

- output is object-based, not a bare array
- repeated `-p, --path <path>` is the batch input form in this contract
- `-p` remains the short alias for `--path` in inspect batch mode, matching both the current inspect command and the main counting CLI
- inspect should mirror the main counting CLI path UX as closely as possible in this contract:
  - same repeatable `-p, --path` flag shape
  - same expectation that multiple `--path` values mean multi-input processing
  - same directory acceptance in `--path-mode auto`, where an explicit `-p <dir>` is expanded
  - same literal-file behavior in `--path-mode manual`, where an explicit `-p <dir>` is treated as `not a regular file`
  - same directory filter semantics for `--include-ext`, `--exclude-ext`, and `--regex`
  - narrower behavior only where inspect intentionally differs from counting, such as JSON-only batch output and no merged/per-file aggregation layer
- positional text input is not allowed when batch inspect is used
- multiple `--path` values require `--format json`
- the CLI should fail clearly instead of silently changing the output format when batch inspect is requested without `--format json`
- directory-expanded inputs should resolve with the same stable absolute-path ordering as counting
- overlap dedupe should reuse counting behavior:
  - dedupe by resolved absolute path across repeated file inputs, repeated directory inputs, and file-plus-directory overlap
- `--format standard` should stay out of scope for this batch contract until the per-file text rendering contract is separately designed
- `files` contains successful per-file inspect results
- `files` entries should use `{ path, result }`, where `result` is the full single inspect result object
- `skipped` contains non-fatal directory-scan outcomes that did not produce inspect results
- `skipped` entries should use `{ path, reason }`
- `failures` contains explicit per-file failures
- `failures` entries should use `{ path, reason }` to stay closer to existing batch per-path outcome wording in the repo
- duplicate successful inputs that resolve to the same file should collapse to one `files` entry by resolved absolute path
- failed inputs should remain explicit per-path outcomes rather than being merged into one synthetic aggregate error
- directory-filter and directory-scan skips should not be promoted into `failures`
- explicit directory inputs in `--path-mode auto` should be expanded, not treated as failures
- explicit directory inputs in `--path-mode manual` should be reported under `failures` with `reason: "not a regular file"`
- continue processing after a per-file failure instead of hard-stopping the whole run
- return a non-zero exit status when any `failures` entry is present
- return a non-zero exit status when `files` is empty after path resolution and filtering, even if `failures` is empty
- return exit status `0` when `files` is non-empty and `failures` is empty, even if `skipped` entries are present
- still emit the JSON payload when failures or skips are present, including cases where `files` is empty
- order `files`, `skipped`, and `failures` by resolved path ascending
- paths in all three arrays should be resolved absolute paths for consistency with existing batch count JSON
- failure and skip reasons should reuse current batch-count wording where the semantics match:
  - unreadable path: `not readable: <message>`
  - non-file target, including directories: `not a regular file`
  - directory read failure: `directory read failed: <message>`
  - extension filter exclusion: `extension excluded`
  - regex filter exclusion: `regex excluded`
- explicit-path failures should include:
  - unreadable explicit path
  - explicit non-file target
  - explicit binary file
- directory-scan skips should include:
  - `extension excluded`
  - `regex excluded`
  - `binary file` for discovered files that pass path resolution but fail the text-like file guard
- `skipped` is reserved for non-fatal outcomes discovered during directory expansion, not for explicit invalid path inputs
- a directory run where every candidate is excluded by directory filters should produce:
  - `files: []`
  - one or more `skipped` entries
  - `failures: []`
  - exit status `1`, because no inspectable files remained after applying the requested path contract

## Recommended Resolution of Remaining Questions

- Inspect should reuse the counting path-resolution contract now, but not counting’s aggregation layer.
  - Reuse the main counting CLI path model for:
    - repeatable `-p, --path`
    - directory acceptance in `--path-mode auto`
    - literal-file behavior in `--path-mode manual`
    - recursive-by-default traversal with `--no-recursive`
    - `--include-ext`, `--exclude-ext`, and `--regex`
    - stable absolute-path ordering
    - overlap dedupe by resolved absolute path
  - Do not automatically inherit counting’s output-scope flags just because path resolution is shared.
- Inspect batch should keep `--section` out of this batch contract.
  - `--section` materially changes detector input semantics for markdown files.
  - Mixing it into the initial directory-capable inspect batch contract would make the result contract harder to reason about.
  - Revisit `--section` only after the base batch path contract is implemented and stable.
- Batch inspect should stay per-file only until a real need for aggregation is demonstrated.
  - No merged detector summary should be part of this batch contract.
  - If aggregate output is ever added later, it should be designed as a separate summary contract rather than implied by reusing counting’s `--merged` / `--per-file` model.
- Batch inspect should reuse the existing batch-count failure vocabulary where possible.
  - This keeps per-path failure output familiar and reduces contract drift between counting and inspect.
  - This batch contract should standardize on:
    - `not readable: <message>`
    - `not a regular file`
    - `directory read failed: <message>`
    - `extension excluded`
    - `regex excluded`
    - `binary file`
  - This batch contract should inherit the current text-like file guard rather than trying to decode arbitrary binary inputs as inspectable text.
  - `binary file` should be treated as a failure for explicit file inputs and as a skip for directory-discovered files.
- Batch inspect should stay silent and result-only in the near term.
  - No progress UI is needed in this directory-capable batch contract.
  - Progress becomes more relevant only if inspect later grows standard text batch rendering or large recursive directory workflows.
- Batch inspect should treat “no inspectable files remained” as a non-zero outcome.
  - This keeps inspect aligned with the existing counting-path contract when path resolution/filtering yields no usable text-like inputs.
  - In batch inspect, that outcome should still emit the JSON container so callers can see whether the empty result was caused by skips, failures, or both.
- Single-path inspect should keep `--format standard` and `--format json`, while multi-path inspect should require `--format json` until a dedicated text renderer exists.
  - This preserves the current single-input UX.
  - It also avoids inventing an under-specified multi-result text contract too early.
  - If a batch text renderer is added later, it should be introduced deliberately as a separate follow-up contract.

## Recommended Future Research Scope

The core inspect batch contract is already settled in this research for:

- shared counting-style path acquisition
- the batch JSON container shape (`files`, `skipped`, `failures`)
- failure and skip vocabulary
- exit behavior
- ordering and dedupe rules

The remaining follow-up research should include only:

- any future aggregate inspect summary contract
- any future batch text rendering contract
- any future `--section` support for batch inspect
- any future concurrency needs beyond current path resolution

The follow-up research should stay out of:

- configurable `contentGate` behavior
- changes to the first single-input inspect contract
- detector engine changes unrelated to batch orchestration

## Recommended Candidate Evolution Path

The cleanest staged path is:

1. single-input inspect only
2. batch inspect with shared counting-style path resolution (`-p <file>`, `-p <dir>`, path-mode, recursion, and directory filters) plus per-file continuation and a `files` / `failures` JSON container
3. only then consider aggregate or summary inspection output
4. only after that consider `--section` and any dedicated batch text renderer

This sequence minimizes contract churn because each phase adds one new dimension of complexity at a time.

## Recommended Timing

- complete and stabilize the current single-input inspect implementation first
- then draft the implementation plan for inspect batch mode using the shared counting-style path contract settled in this research

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`

## Related Research

- `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
- `docs/researches/research-2026-02-13-batch-file-counting.md`
- `docs/researches/research-2026-02-19-batch-concurrency-jobs.md`
