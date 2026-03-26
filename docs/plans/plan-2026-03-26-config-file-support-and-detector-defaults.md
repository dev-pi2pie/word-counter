---
title: "config file support and detector default alignment"
created-date: 2026-03-26
modified-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Implement first-version config file support for `word-counter` so user-level defaults, project-level overrides, environment variables, and CLI flags resolve through one explicit precedence model, while also aligning `inspect` detector defaults with the main CLI contract.

## Context

- The linked research now settles the first implementation direction for config files:
  - support `toml`, `json`, and `jsonc`
  - use the canonical filenames:
    - `wc-intl-seg.config.toml`
    - `wc-intl-seg.config.json`
    - `wc-intl-seg.config.jsonc`
  - use platform-native user config directories on Linux, macOS, and Windows
  - resolve same-scope files by fixed priority: `toml > jsonc > json`
  - add `inspect.detector` in v1 with inheritance from the root `detector`
- The current repo has CLI flags and environment-variable surfaces for many of these settings, but no config file loader yet.
- The current schema draft in `docs/schemas/default-config.md` still describes config support as a future `v0.1.0` draft and needs to be brought in line with the settled direction.
- The current `inspect` behavior needs to be aligned so the CLI default returns to `regex`, with config/env/flag overrides layered on top.
- Config examples should ship with the docs work so the first implementation has stable reference files under `examples/wc-config/`.

## Scope

- In scope:
  - add first-version config file discovery and loading for:
    - `wc-intl-seg.config.toml`
    - `wc-intl-seg.config.json`
    - `wc-intl-seg.config.jsonc`
  - add platform-native user config directory resolution for Linux, macOS, and Windows
  - add current-working-directory config discovery
  - implement the settled precedence contract across:
    - built-in defaults
    - user config file
    - current-working-directory config file
    - environment variables
    - CLI flags
  - implement fixed same-scope format priority: `toml > jsonc > json`
  - add the first-version config shape for:
    - `detector`
    - `inspect.detector`
    - `path.*`
    - `progress.mode`
    - `output.totalOf`
    - `reporting.*`
    - `logging.*`
  - add CLI/config wiring for `inspect.detector`
  - add `-d` as an alias of `--detector`
  - reset CLI `inspect` default detector to `regex`
  - document loader behavior, config precedence, same-scope file priority, and ignored-sibling behavior
  - add config examples under `examples/wc-config/`
  - update schema and user-facing docs to match the settled contract
- Out of scope:
  - changing the detector-subpath library default unless implementation reuse makes it unavoidable and explicitly documented
  - adding route-specific config beyond the settled `inspect.detector` override
  - supporting hidden config filenames in this phase
  - supporting additional config formats beyond `toml`, `json`, and `jsonc`
  - introducing public numeric detector thresholds or broader detector-policy customization

## Decisions Settled For This Plan

- The canonical config filenames are:
  - `wc-intl-seg.config.toml`
  - `wc-intl-seg.config.json`
  - `wc-intl-seg.config.jsonc`
- The user-level config lookup must respect the host platform:
  - Linux: `$XDG_CONFIG_HOME` when set, otherwise `$HOME/.config`
  - macOS: `$HOME/Library/Application Support`
  - Windows: `%AppData%`
- The project-level config lookup happens once per invocation from the current working directory.
- Same-scope config files resolve by fixed priority:
  - `toml`
  - `jsonc`
  - `json`
- Lower-priority sibling config files at the same scope are ignored.
- Loader behavior for ignored same-scope siblings must be documented in the guide and covered by tests.
- The precedence contract is:

```text
built-in defaults
< user config dir / wc-intl-seg.config.{toml|jsonc|json}
< cwd / wc-intl-seg.config.{toml|jsonc|json}
< environment variables
< flag options
```

- Merge behavior is key-based:
  - objects/tables merge recursively
  - leaf values replace
  - arrays replace
- `detector` remains the root default detector for normal counting.
- `inspect.detector` is part of v1 and is an optional inspect-only override.
- If `inspect.detector` is absent, `inspect` inherits the root `detector`.
- `word-counter inspect --detector ...` overrides the effective inspect detector for that invocation only; it does not rewrite the root `detector` setting.
- The CLI `inspect` default detector returns to `regex`.
- `-d` becomes a global short alias for `--detector`.

## Phase Task Items

### Phase 1 - Config Contract And Loader Boundary

- [x] Add first-version config types and normalization helpers for the settled schema keys under the CLI/runtime layer.
- [x] Define one config-loading boundary that is separate from markdown frontmatter parsing and does not reuse the existing TOML frontmatter parser error model.
- [x] Define how parsed config values are normalized before merge so `toml`, `json`, and `jsonc` land on one internal shape.
- [x] Add validation rules for unsupported keys, invalid enum values, invalid arrays, and invalid scalar types with clear CLI-facing error messages.
- [x] Update `docs/schemas/default-config.md` so it reflects the settled active contract instead of the stale `v0.1.0` wording.

Validation for this phase:

- targeted parser/normalization tests for `toml`, `json`, and `jsonc`
- schema/normalization tests for invalid values and unknown-key handling
- doc review against the settled research contract

### Phase 2 - Config Discovery And Same-Scope Priority

- [x] Implement platform-native user config path resolution for Linux, macOS, and Windows.
- [x] Implement current-working-directory config lookup using the canonical filenames.
- [x] Implement fixed same-scope file selection with `toml > jsonc > json`.
- [x] Ignore lower-priority sibling config files at the same scope after selecting the highest-priority file.
- [x] Surface a clear diagnostic note when lower-priority sibling config files are ignored.

Validation for this phase:

- unit coverage for user-level path resolution on Linux, macOS, and Windows path rules
- tests for current-working-directory lookup
- tests proving same-scope selection prefers `toml`, then `jsonc`, then `json`
- tests proving ignored sibling config files are reported consistently

### Phase 3 - Precedence Merge And Option Wiring

- [x] Implement recursive merge across built-in defaults, user config, current-working-directory config, environment variables, and CLI flags.
- [x] Wire config values into existing runtime options for:
  - `path.mode`
  - `path.recursive`
  - `path.includeExtensions`
  - `path.excludeExtensions`
  - `path.detectBinary`
  - `progress.mode`
  - `output.totalOf`
  - `reporting.skippedFiles`
  - `reporting.debugReport.path`
  - `reporting.debugReport.tee`
  - `logging.level`
  - `logging.verbosity`
  - `detector`
  - `inspect.detector`
- [x] Ensure environment variables override config-derived values without changing the existing env contract names.
- [x] Ensure CLI flags override both config and env values without changing existing flag semantics.

Validation for this phase:

- precedence tests covering each layer boundary
- regression tests proving omitted config preserves current behavior
- targeted CLI integration coverage for merged detector, path, progress, and reporting settings

### Phase 4 - Detector Default Alignment And Alias Support

- [x] Reset CLI `inspect` default detector behavior to `regex`.
- [x] Add `inspect.detector` support so inspect inherits the root `detector` unless overridden in config.
- [x] Add `-d` as a global alias of `--detector` for both counting and `inspect`.
- [x] Ensure `inspect --detector` remains invocation-scoped and does not mutate or shadow the root config state outside the current inspect execution.
- [x] Recheck CLI help text and validation messages so detector defaults and alias behavior are explicit.

Validation for this phase:

- CLI tests for default inspect detector behavior
- CLI tests for `-d regex` and `-d wasm` on both counting and `inspect`
- precedence tests proving inspect-specific overrides behave correctly against root `detector`
- regression checks proving non-inspect counting still defaults to `regex`

### Phase 5 - Docs, Guide, Examples, And Closure

- [x] Add a config usage guide documenting:
  - canonical filenames
  - platform-native user config locations
  - current-working-directory config lookup
  - same-scope priority `toml > jsonc > json`
  - ignored-sibling behavior
  - precedence across config, env, and flags
  - `inspect.detector` inheritance and override rules
- [x] Update README sections that describe detector defaults, config-related behavior, and CLI usage examples.
- [x] Add config examples with default config values under `examples/wc-config/` in all supported formats:
  - `examples/wc-config/wc-intl-seg.config.toml`
  - `examples/wc-config/wc-intl-seg.config.json`
  - `examples/wc-config/wc-intl-seg.config.jsonc`
- [x] Ensure the example files reflect the documented default config contract rather than ad hoc overrides.
- [x] Record implementation progress in job records under `docs/plans/jobs/` as phases land.

Validation for this phase:

- doc review against the settled research and plan contract
- example-file review against the final config schema
- targeted CLI smoke checks using the example config files

## Compatibility Gates

- [x] Omitted config files preserve current behavior.
- [x] Existing environment-variable names remain valid and keep their current precedence over config files.
- [x] Existing long-form CLI flags remain valid and keep their current precedence over config and env.
- [x] The CLI `inspect` default detector becomes `regex` without changing normal counting defaults.
- [x] `inspect.detector` only affects inspect behavior and does not silently rewrite root detector behavior for counting.
- [x] Same-scope file resolution is deterministic and documented.
- [x] Ignored lower-priority sibling config files are not silently selected.
- [x] Changed files remain consistent with the documented config contract and examples.

## Validation

- targeted parser and normalization tests for `toml`, `json`, and `jsonc`
- precedence and merge tests across config, env, and CLI layers
- CLI tests for default detector behavior and `-d`
- doc review for schema, guide, README, and examples
- `bun test`
- `bun run type-check`
- `bun run build`

## Related Research

- `docs/researches/research-2026-03-26-config-layer-and-detector-defaults.md`

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`
- `docs/plans/plan-2026-03-25-configurable-content-gate-behavior.md`
