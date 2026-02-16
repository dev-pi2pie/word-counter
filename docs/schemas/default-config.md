---
title: "Default Config Schema (Draft)"
created-date: 2026-02-13
modified-date: 2026-02-16
status: draft
agent: Codex
milestone: v0.1.0
---

# Default Config Schema (Draft)

This document defines a draft configuration schema for upcoming CLI features.
It focuses on batch path resolution, progress behavior, and runtime reporting.

## Scope

- Config file support is planned for a future phase.
- Current milestone (`v0.1.0`) primarily uses CLI flags and environment variables.
- This schema is a contract draft so flag/env behavior can align with future config.

## Resolution Order

Highest to lowest precedence:

1. CLI flags
2. Environment variables
3. Config file values
4. Built-in defaults

## Proposed Keys

```yaml
path:
  mode: auto # auto | manual
  recursive: true
  includeExtensions: [".md", ".markdown", ".mdx", ".mdc", ".txt"]
  excludeExtensions: []
  detectBinary: true
reporting:
  skippedFiles: false
  debugReport:
    enabled: false
    path: null # optional explicit file path
    tee: false # mirror to terminal when report is enabled
output:
  totalOf: [] # optional list of parts: words|emoji|symbols|punctuation|whitespace
progress:
  mode: auto # auto | on | off
logging:
  level: info # info | debug
  verbosity: compact # compact | verbose (applies when level=debug)
```

## Key Semantics

- `path.mode`
  - `auto`: determine file vs directory from filesystem metadata.
  - `manual`: do not auto-expand directories; treat input paths literally.
- `path.recursive`
  - controls directory traversal depth when a directory path is provided.
- repeated path inputs are allowed as mixed file + directory roots.
- resolved files are deduplicated by absolute path and processed in deterministic absolute-path ascending order.
- `path.includeExtensions`
  - allowlist applied to directory scans before content reading.
- `path.excludeExtensions`
  - denylist applied after include filtering.
- include/exclude extension filters apply only to files discovered by directory expansion, not direct file-path inputs.
- `path.detectBinary`
  - when true, extensionless/unknown files are inspected and skipped if binary-like.
- `reporting.skippedFiles`
  - when true, emit skipped-file diagnostics.
  - in current CLI behavior, diagnostics are emitted only when debug mode is enabled.
- `reporting.debugReport`
  - `enabled`: route debug diagnostics to a file sink.
  - `path`: optional explicit report file path; when omitted, CLI uses default cwd naming.
  - `tee`: when true, mirror debug diagnostics to both report file and terminal `stderr`.
- `output.totalOf`
  - optional list of parts to override how total is composed.
  - supported parts: `words`, `emoji`, `symbols`, `punctuation`, `whitespace`.
  - when set, standard output may show `Total-of (override: ...)` if override differs from base total.
  - when set, raw output prints the override total.
- `progress.mode`
  - `auto`: enable progress for batch runs and suppress for single-input runs.
  - `on`: always attempt to show progress where format permits.
  - `off`: disable progress output.
- `logging.level`
  - `info`: default operational logging.
  - `debug`: verbose runtime diagnostics, including path-resolution decisions (root expansion, filter exclusion, dedupe).
- `logging.verbosity`
  - `compact`: lifecycle + summary diagnostics (default in debug mode).
  - `verbose`: include per-file/per-path debug events.

## CLI and Env Mapping (Draft)

- `--path-mode <auto|manual>` -> `path.mode`
- `--recursive` / `--no-recursive` -> `path.recursive`
- `--include-ext <list>` -> `path.includeExtensions`
- `--exclude-ext <list>` -> `path.excludeExtensions`
- `--debug` -> `logging.level = debug`
- `--verbose` -> `logging.verbosity = verbose` (requires `--debug`)
- `--debug-report [path]` -> `reporting.debugReport.enabled = true`, optional `reporting.debugReport.path`
- `--debug-report-tee` / `--debug-tee` -> `reporting.debugReport.tee = true` (requires `--debug-report`)
- `--quiet-skips` -> `reporting.skippedFiles = false` (override; suppress skip diagnostics even in debug mode)
- `--total-of <parts>` -> `output.totalOf`
- `--progress` / `--no-progress` -> `progress.mode` (`on` / `off`; default `auto`)

- `WORD_COUNTER_PATH_MODE` -> `path.mode`
- `WORD_COUNTER_RECURSIVE` -> `path.recursive`
- `WORD_COUNTER_INCLUDE_EXT` -> `path.includeExtensions` (comma-separated)
- `WORD_COUNTER_EXCLUDE_EXT` -> `path.excludeExtensions` (comma-separated)
- `WORD_COUNTER_REPORT_SKIPS` -> `reporting.skippedFiles`
- `WORD_COUNTER_TOTAL_OF` -> `output.totalOf` (comma-separated)
- `WORD_COUNTER_PROGRESS` -> `progress.mode` (`auto|on|off`)
- `WORD_COUNTER_LOG_LEVEL` -> `logging.level` (`info|debug`)
- `WORD_COUNTER_LOG_VERBOSITY` -> `logging.verbosity` (`compact|verbose`)
- `WORD_COUNTER_DEBUG_REPORT` -> `reporting.debugReport.path` (planned)
- `WORD_COUNTER_DEBUG_REPORT_TEE` -> `reporting.debugReport.tee` (planned)

## Notes

- Skip diagnostics are debug-gated in current CLI behavior (`--debug`); `--quiet-skips` suppresses them explicitly.
- Path-resolution diagnostics are debug-gated; compact mode emits summary events and verbose mode emits per-file/per-path events.
- With debug report enabled, diagnostics are routed file-first and can be mirrored to terminal with tee mode.
- `--total-of` is currently available via CLI; config/env persistence is a draft contract target for future config-file phases.
- `--progress` is optional in `auto` mode because batch runs enable progress by default.
- Future config-file implementation should reuse these keys directly to avoid migration churn.
