---
title: "Default Config Schema"
created-date: 2026-02-13
modified-date: 2026-03-26
status: completed
agent: Codex
---

# Default Config Schema

This document defines the active draft schema for first-version `word-counter` config files.

## Scope

- This schema covers the first-version config contract for:
  - config filenames
  - config discovery order
  - same-scope format priority
  - supported keys and value shapes
- This schema is intended to stay aligned with:
  - `docs/researches/research-2026-03-26-config-layer-and-detector-defaults.md`
  - `docs/plans/plan-2026-03-26-config-file-support-and-detector-defaults.md`

## Canonical Filenames

- `wc-intl-seg.config.toml`
- `wc-intl-seg.config.json`
- `wc-intl-seg.config.jsonc`

## User Config Location

The user-level config directory should follow the host platform:

- Linux: `$XDG_CONFIG_HOME` when set, otherwise `$HOME/.config`
- macOS: `$HOME/Library/Application Support`
- Windows: `%AppData%`

## Resolution Order

Highest to lowest precedence:

1. CLI flags
2. Environment variables
3. Current-working-directory config file
4. User-level config file
5. Built-in defaults

## Same-Scope Format Priority

When more than one supported config file exists at the same scope, the loader selects:

1. `toml`
2. `jsonc`
3. `json`

Lower-priority sibling config files at the same scope are ignored.

## Proposed Shape

```toml
detector = "regex"

[contentGate]
mode = "default"

[inspect]
detector = "regex"

[path]
mode = "auto"
recursive = true
includeExtensions = [".md", ".markdown", ".mdx", ".mdc", ".txt"]
excludeExtensions = []
detectBinary = true

[progress]
mode = "auto"

[output]
totalOf = []

[reporting]
skippedFiles = false

[reporting.debugReport]
tee = false

[logging]
level = "info"
verbosity = "compact"
```

## Key Semantics

- `detector`
  - root detector default for normal counting flows
  - allowed values: `regex`, `wasm`
- `inspect.detector`
  - optional inspect-only detector override
  - when omitted, `inspect` inherits the root `detector`
- `contentGate.mode`
  - root detector-policy default for normal counting flows
  - allowed values: `default`, `strict`, `loose`, `off`
- `inspect.contentGate.mode`
  - optional inspect-only detector-policy override
  - when omitted, `inspect` inherits the root `contentGate.mode`
  - `WORD_COUNTER_CONTENT_GATE` still overrides inspect-only config defaults because env precedence is higher than file-based config
- `path.mode`
  - `auto`: determine file vs directory from filesystem metadata
  - `manual`: treat `--path` inputs as literal files
- `path.recursive`
  - controls directory traversal when `path.mode = "auto"`
- `path.includeExtensions`
  - allowlist applied to directory scans before content reading
- `path.excludeExtensions`
  - denylist applied after include filtering
- `path.detectBinary`
  - when true, extensionless or unknown files can be skipped as binary-like
- `progress.mode`
  - `auto`: enable progress for batch runs and suppress it for single-input runs
  - `on`: always attempt to show progress where output format permits
  - `off`: disable progress output
- `output.totalOf`
  - optional list of parts to override how total is composed
  - supported parts: `words`, `emoji`, `symbols`, `punctuation`, `whitespace`
- `reporting.skippedFiles`
  - when true, enable skipped-file reporting
  - current CLI behavior still gates skip diagnostics behind debug-oriented flows
- `reporting.debugReport.path`
  - optional explicit debug-report file path
- `reporting.debugReport.tee`
  - when true, mirror debug-report output to both file and `stderr`
- `logging.level`
  - `info`: default operational logging
  - `debug`: verbose runtime diagnostics
- `logging.verbosity`
  - `compact`: lifecycle and summary diagnostics
  - `verbose`: per-file and per-path debug diagnostics

## CLI And Env Mapping

- `-d, --detector <regex|wasm>` -> `detector`
- `inspect -d, --detector <regex|wasm>` -> `inspect.detector` for that invocation only
- `--content-gate <default|strict|loose|off>` -> `contentGate.mode`
- `inspect --content-gate <default|strict|loose|off>` -> `inspect.contentGate.mode` for that invocation only
- `--path-mode <auto|manual>` -> `path.mode`
- `--recursive` / `--no-recursive` -> `path.recursive`
- `--include-ext <list>` -> `path.includeExtensions`
- `--exclude-ext <list>` -> `path.excludeExtensions`
- `--progress` / `--no-progress` -> `progress.mode`
- `--total-of <parts>` -> `output.totalOf`
- `--quiet-skips` -> inverse override of `reporting.skippedFiles`
- `--debug-report [path]` -> `reporting.debugReport.path`
- `--debug-report-tee` / `--debug-tee` -> `reporting.debugReport.tee`
- `--debug` -> `logging.level = debug`
- `--verbose` -> `logging.verbosity = verbose`

- `WORD_COUNTER_CONTENT_GATE` -> `contentGate.mode`
- `WORD_COUNTER_PATH_MODE` -> `path.mode`
- `WORD_COUNTER_RECURSIVE` -> `path.recursive`
- `WORD_COUNTER_INCLUDE_EXT` -> `path.includeExtensions`
- `WORD_COUNTER_EXCLUDE_EXT` -> `path.excludeExtensions`
- `WORD_COUNTER_PROGRESS` -> `progress.mode`
- `WORD_COUNTER_TOTAL_OF` -> `output.totalOf`
- `WORD_COUNTER_REPORT_SKIPS` -> `reporting.skippedFiles`
- `WORD_COUNTER_DEBUG_REPORT` -> `reporting.debugReport.path`
- `WORD_COUNTER_DEBUG_REPORT_TEE` -> `reporting.debugReport.tee`
- `WORD_COUNTER_LOG_LEVEL` -> `logging.level`
- `WORD_COUNTER_LOG_VERBOSITY` -> `logging.verbosity`

## Notes

- Config merge behavior is key-based:
  - objects/tables merge recursively
  - leaf values replace
  - arrays replace
- The current-working-directory config lookup happens once per invocation from the process working directory.
- Ignored lower-priority sibling config files should be documented in the user guide and surfaced through loader diagnostics.
