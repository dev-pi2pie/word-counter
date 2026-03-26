---
title: "Config Usage Guide"
created-date: 2026-03-26
modified-date: 2026-03-26
status: completed
agent: Codex
---

# Config Usage Guide

## Goal

Explain how `word-counter` discovers config files, resolves precedence across config, environment variables, and CLI flags, and how to use the supported config formats in practice.

## Canonical Filenames

`word-counter` supports these config filenames:

- `wc-intl-seg.config.toml`
- `wc-intl-seg.config.json`
- `wc-intl-seg.config.jsonc`

These names are used both for:

- the user-level config directory
- the current working directory

## Config Search Locations

### User-Level Config

The user-level config directory follows the host platform:

- Linux: `$XDG_CONFIG_HOME` when set, otherwise `$HOME/.config`
- macOS: `$HOME/Library/Application Support`
- Windows: `%AppData%`

The loader looks for `wc-intl-seg.config.toml`, `wc-intl-seg.config.jsonc`, and `wc-intl-seg.config.json` in that directory.

### Project-Level Config

The project-level config lookup happens once per invocation from the current working directory.

The loader does not search upward through parent directories in this first version.

## Precedence

Highest to lowest precedence:

1. CLI flags
2. Environment variables
3. Current-working-directory config file
4. User-level config file
5. Built-in defaults

That means:

- CLI flags always win for the current invocation
- environment variables override both user and project config files
- project config overrides user config
- omitted keys fall through to the next lower layer

## Same-Scope File Priority

If more than one supported config file exists at the same scope, the loader selects:

1. `toml`
2. `jsonc`
3. `json`

Lower-priority sibling config files at the same scope are ignored.

The CLI emits a warning when this happens so the selected file is explicit.

## Merge Rules

Config merge behavior is key-based:

- objects and tables merge recursively
- leaf values replace
- arrays replace

Examples:

- if the user config sets `detector = "wasm"` and the project config sets `path.mode = "manual"`, both values remain active
- if the user config sets `path.includeExtensions = [".md"]` and the project config sets `path.includeExtensions = [".txt"]`, the project array replaces the user array

## Supported Keys

| Key | Meaning |
| --- | --- |
| `detector` | Root detector default for normal counting |
| `inspect.detector` | Optional inspect-only override |
| `contentGate.mode` | Root detector-policy mode for counting and inspect fallback |
| `inspect.contentGate.mode` | Optional inspect-only content-gate override |
| `path.mode` | `auto` or `manual` path interpretation |
| `path.recursive` | Recursive directory traversal toggle |
| `path.includeExtensions` | Directory scan allowlist |
| `path.excludeExtensions` | Directory scan denylist |
| `path.detectBinary` | Binary-file detection toggle |
| `progress.mode` | `auto`, `on`, or `off` |
| `output.totalOf` | Total override composition |
| `reporting.skippedFiles` | Skip-reporting preference |
| `reporting.debugReport.path` | Explicit debug report file path |
| `reporting.debugReport.tee` | Mirror debug report output to `stderr` |
| `logging.level` | `info` or `debug` |
| `logging.verbosity` | `compact` or `verbose` |

For the schema contract and per-key semantics, see `docs/schemas/default-config.md`.

## Detector Defaults

Detector resolution follows these rules:

- `detector` sets the root default detector for normal counting
- `inspect.detector` is optional
- if `inspect.detector` is absent, `inspect` inherits the root `detector`
- `word-counter inspect --detector ...` overrides the effective inspect detector only for that invocation

Current CLI defaults:

- counting defaults to `regex`
- `inspect` also defaults to `regex`

## Content Gate Defaults

Content-gate resolution follows the same layered model:

- `contentGate.mode` sets the root detector-policy default for counting
- `inspect.contentGate.mode` is optional
- if `inspect.contentGate.mode` is absent, `inspect` inherits the root `contentGate.mode`
- `WORD_COUNTER_CONTENT_GATE` overrides both user-level and project config defaults, including inspect-only file defaults
- `word-counter inspect --content-gate ...` overrides the effective inspect content-gate mode only for that invocation
- `--content-gate ...` remains the highest-precedence content-gate override on the counting CLI

## Environment Variables

The current config-aware environment variables are:

- `WORD_COUNTER_CONTENT_GATE`
- `WORD_COUNTER_PATH_MODE`
- `WORD_COUNTER_RECURSIVE`
- `WORD_COUNTER_INCLUDE_EXT`
- `WORD_COUNTER_EXCLUDE_EXT`
- `WORD_COUNTER_PROGRESS`
- `WORD_COUNTER_TOTAL_OF`
- `WORD_COUNTER_REPORT_SKIPS`
- `WORD_COUNTER_DEBUG_REPORT`
- `WORD_COUNTER_DEBUG_REPORT_TEE`
- `WORD_COUNTER_LOG_LEVEL`
- `WORD_COUNTER_LOG_VERBOSITY`

These variables override both user-level and current-working-directory config files.

## CLI Overrides

CLI flags keep the highest precedence.

Examples:

```bash
word-counter --detector wasm "Hello world"
word-counter --content-gate strict "Internationalization documentation remains understandable."
word-counter -d regex --format json "Hello world"
word-counter inspect --content-gate off "mode: debug\ntee: true\npath: logs\nUse this for testing."
word-counter inspect --detector wasm --view engine "こんにちは、世界！"
word-counter inspect -d regex -f json "こんにちは、世界！これはテストです。"
```

## Example Files

Default-reference config examples live under:

- `examples/wc-config/wc-intl-seg.config.toml`
- `examples/wc-config/wc-intl-seg.config.json`
- `examples/wc-config/wc-intl-seg.config.jsonc`

These examples are meant to show the documented default contract rather than project-specific overrides.
