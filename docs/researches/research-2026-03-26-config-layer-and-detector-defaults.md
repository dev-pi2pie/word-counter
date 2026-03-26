---
title: "config layer and detector defaults"
created-date: 2026-03-26
modified-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Define the next-step configuration direction for `word-counter`, covering config-source precedence, file-format support, config naming, detector-related CLI consistency, `contentGate` configurability, and wording fixes needed in the current config schema draft.

## Milestone Goal

Establish a stable configuration contract that can be implemented without changing the current core counting model, while keeping CLI behavior predictable across normal counting and `inspect`.

## Key Findings

- The current config schema draft is stale in two ways.
  - `docs/schemas/default-config.md` still describes config-file support as a future `v0.1.0` draft.
  - That framing no longer matches the current repository state, which is already beyond the earlier canary planning phase and now includes newer detector-policy work.
- The current precedence contract is underspecified for path overrides.
  - The schema draft only says `CLI flags > env > config file > built-in defaults`.
  - It does not distinguish between a user-global config file and a per-directory project config file.
  - For the requested behavior, the effective order needs one more layer for user-global and per-directory config files before env and flags.
  - The user-global path should follow platform-native config directories on Linux, macOS, and Windows rather than hardcoding one home-directory convention.
  - For implementation clarity, `$DIR` should mean a once-per-invocation lookup from the process working directory.
- A two-file config search model fits the CLI better than a single config source.
  - A user-global file gives stable personal defaults such as detector mode, content-gate mode, or preferred output settings.
  - A directory-local file gives repository-scoped overrides without forcing shell aliases or exported environment variables.
  - This matches the need for "overwritten path" behavior more cleanly than putting all persistence into env vars.
- `inspect` defaulting to WASM is now inconsistent with the main CLI default.
  - The main CLI and README both describe `--detector regex` as the default behavior.
  - The detector subpath helper `inspectTextWithDetector()` currently defaults to `wasm` when `detector` is omitted.
  - That default was added as a follow-up for the inspect surface, but it now creates a mismatch between `word-counter ...` and `word-counter inspect ...`.
- The requested reset to `inspect --detector regex` is a consistency decision, not a detector-quality decision.
  - Using regex by default keeps `inspect` aligned with the normal count path.
  - Users who want WASM-first inspection can still opt in explicitly, and a config file can persist that preference.
- Adding `-d` as an alias for `--detector` is low-risk and aligns with recent CLI alias work.
  - The repo already introduced short aliases for inspect-specific options such as `-p` and `-f`.
  - A short detector alias improves repeated inspection and debugging flows where `--detector wasm` is common.
- `contentGate` should also be part of the config layer.
  - The earlier recommendation already described the user-global config as the right place for stable defaults such as detector mode and content-gate mode.
  - Leaving `contentGate` out of the config contract would force users to keep mixing config files with env variables or shell aliases for one of the most visible detector-policy knobs.
  - The config surface should therefore cover both detector selection and detector policy mode.
- Supporting `toml`, `json`, and `jsonc` together is reasonable if the file names are explicit and unique.
  - The schema is simple enough to map cleanly across all three formats.
  - TOML and JSONC remain friendlier for hand-edited configs because they allow comments or comment-adjacent usage patterns.
  - Plain JSON remains useful for generated or machine-managed config.
- The naming choice matters more once multiple formats are supported.
  - Non-hidden names make discovery easier and fit the requested direction.
  - A unique basename avoids collisions with generic `config.toml` or tool-agnostic project config files.
  - Too many dots in the basename can read like stacked extensions instead of one intentional config name.
- A dedicated `inspect.detector` key is worth including in the first config version.
  - The root `detector` key should still define the default detector policy for normal counting.
  - An inspect-only override makes the config layer flexible without forcing CLI semantics to diverge by default.
  - Inheritance remains simple: if `inspect.detector` is absent, `inspect` inherits the root `detector`.
- The existing TOML frontmatter parser should not be reused as the config parser.
  - `src/markdown/toml/parse-frontmatter.ts` is intentionally scoped to markdown frontmatter extraction.
  - Its error model returns `null` for malformed input, which is acceptable for frontmatter fallback but too weak for config validation.
  - Config loading needs explicit validation errors and probably fuller TOML coverage than the frontmatter helper was designed to provide.

## Implications or Recommendations

- Adopt the following precedence contract for the config layer:

```text
built-in defaults
< user config dir / wc-intl-seg.config.{toml|jsonc|json}
< cwd / wc-intl-seg.config.{toml|jsonc|json}
< environment variables
< flag options
```

- Treat the two config files as the same schema loaded at different scopes.
  - The user-level config establishes personal defaults.
  - The user-level config path should respect the current platform:
    - Linux: `$XDG_CONFIG_HOME` when set, otherwise `$HOME/.config`
    - macOS: `$HOME/Library/Application Support`
    - Windows: `%AppData%`
  - The directory config overrides only the keys it defines.
  - The directory-level lookup should happen once per invocation from the process working directory, not separately for each input file or batch path.
  - Missing keys should fall through rather than replacing whole sections.
- Keep override semantics key-based, not file-replacement based.
  - If the local config sets `detector = "wasm"`, it should not wipe unrelated global settings such as `output` or `progress`.
  - The merge model should therefore be recursive for objects/tables and replace-on-write for leaf values and arrays.
- Support three explicit config formats:
  - `wc-intl-seg.config.toml`
  - `wc-intl-seg.config.json`
  - `wc-intl-seg.config.jsonc`
- Prefer a hyphenated basename over an all-dot basename.
  - Recommended: `wc-intl-seg.config.toml`
  - Less preferred: `wc.intl.seg.config.toml`
  - Hyphens make the basename easier to scan and avoid the "multiple extensions" look.
  - The `intl-seg` segment still preserves the intended connection to `Intl.Segmenter`.
- Resolve same-scope config files by fixed priority.
  - The order is `toml`, then `jsonc`, then `json`.
  - Lower-priority sibling config files at the same scope should be ignored.
  - The guide doc should document that order explicitly.
  - The implementation plan should include a task item for the loader behavior and guide update together.
  - The loader should emit a clear note when lower-priority sibling config files are ignored.
- Do not describe the config work as a `v0.1.0` draft anymore.
  - Revise `docs/schemas/default-config.md` so it describes an active config contract draft without the stale milestone framing.
  - If milestone tracking is still needed, it belongs in a plan or job document, not as enduring schema wording.
- Reset the CLI `inspect` default detector to `regex`.
  - That keeps `word-counter inspect ...` aligned with the default counting flow.
  - Config, env, and flags can then override the default for users who prefer WASM inspection.
- Add `inspect.detector` in the first config version.
  - `detector` remains the root default.
  - `inspect.detector` is an optional subcommand-specific override.
  - If `inspect.detector` is omitted, inspect falls back to the root `detector`.
  - `word-counter inspect --detector ...` overrides the effective inspect detector for that invocation only; it does not rewrite the root `detector` setting.
- Add `contentGate.mode` in the first config version.
  - `contentGate.mode` should be the root detector-policy default for normal counting and the fallback default for inspect.
  - `inspect.contentGate.mode` should be available as an optional inspect-only override for symmetry with `inspect.detector`.
  - If `inspect.contentGate.mode` is omitted, inspect falls back to the root `contentGate.mode`.
  - `word-counter inspect --content-gate ...` overrides the effective inspect content-gate mode for that invocation only.
- Add `-d` as a global alias of `--detector`.
  - It should work in both normal counting and `inspect`.
  - Documentation should continue to present `--detector` as the canonical long form while showing `-d` in help text.

## Proposed Config Options

| Key | Type / Values | Default | CLI / Env Mapping |
| --- | --- | --- | --- |
| `detector` | `"regex" \| "wasm"` | `"regex"` | `--detector`, `-d` |
| `inspect.detector` | `"regex" \| "wasm"` | inherits `detector` | `inspect --detector`, `inspect -d` |
| `contentGate.mode` | `"default" \| "strict" \| "loose" \| "off"` | `"default"` | `--content-gate`, `WORD_COUNTER_CONTENT_GATE` |
| `inspect.contentGate.mode` | `"default" \| "strict" \| "loose" \| "off"` | inherits `contentGate.mode` | `inspect --content-gate` |
| `path.mode` | `"auto" \| "manual"` | `"auto"` | `--path-mode`, `WORD_COUNTER_PATH_MODE` |
| `path.recursive` | `boolean` | `true` | `--recursive` / `--no-recursive`, `WORD_COUNTER_RECURSIVE` |
| `path.includeExtensions` | `string[]` | `[".md", ".markdown", ".mdx", ".mdc", ".txt"]` | `--include-ext`, `WORD_COUNTER_INCLUDE_EXT` |
| `path.excludeExtensions` | `string[]` | `[]` | `--exclude-ext`, `WORD_COUNTER_EXCLUDE_EXT` |
| `path.detectBinary` | `boolean` | `true` | future |
| `progress.mode` | `"auto" \| "on" \| "off"` | `"auto"` | `--progress` / `--no-progress`, `WORD_COUNTER_PROGRESS` |
| `output.totalOf` | `("words" \| "emoji" \| "symbols" \| "punctuation" \| "whitespace")[]` | `[]` | `--total-of`, `WORD_COUNTER_TOTAL_OF` |
| `reporting.skippedFiles` | `boolean` | `false` | `--quiet-skips` inverse, `WORD_COUNTER_REPORT_SKIPS` |
| `reporting.debugReport.path` | `string \| null` | `null` | `--debug-report`, `WORD_COUNTER_DEBUG_REPORT` |
| `reporting.debugReport.tee` | `boolean` | `false` | `--debug-report-tee` / `--debug-tee`, `WORD_COUNTER_DEBUG_REPORT_TEE` |
| `logging.level` | `"info" \| "debug"` | `"info"` | `--debug`, `WORD_COUNTER_LOG_LEVEL` |
| `logging.verbosity` | `"compact" \| "verbose"` | `"compact"` | `--verbose`, `WORD_COUNTER_LOG_VERBOSITY` |

### Config Option Notes

- `detector`: root default for normal counting and the fallback default for `inspect`.
- `inspect.detector`: optional inspect-only override; when omitted, `inspect` inherits `detector`. The `inspect --detector` flag overrides it for that inspect invocation only.
- `contentGate.mode`: root detector-policy default for counting and the fallback default for `inspect`.
- `inspect.contentGate.mode`: optional inspect-only override; when omitted, `inspect` inherits `contentGate.mode`. The `inspect --content-gate` flag overrides it for that inspect invocation only.
- `path.mode`: controls file-vs-directory interpretation for `--path`.
- `path.recursive`: applies when scanning directories.
- `path.includeExtensions`: directory expansion allowlist.
- `path.excludeExtensions`: directory expansion denylist.
- `path.detectBinary`: keeps extensionless or unknown files from being treated as text automatically.
- `progress.mode`: matches current batch/single-input progress policy.
- `output.totalOf`: optional total override composition.
- `reporting.skippedFiles`: still debug-gated in current behavior.
- `reporting.debugReport.path`: explicit file sink when debug report is enabled.
- `reporting.debugReport.tee`: mirrors file-routed debug lines to `stderr`.
- `logging.level`: current diagnostics gate.
- `logging.verbosity`: `verbose` still depends on debug mode.

## Config Filenames

Canonical filenames:

- `wc-intl-seg.config.toml`
- `wc-intl-seg.config.json`
- `wc-intl-seg.config.jsonc`

Naming recommendation:

- Use `-` inside the basename and reserve `.` for the fixed `.config` segment plus the file extension.
- `wc-intl-seg.config.*` is easier to read than `wc.intl.seg.config.*`.
- `wc.intl.seg.config.*` is technically valid, but visually it looks closer to chained extensions than a single deliberate name.

Rationale for `intl-seg`:

- It is specific enough to avoid generic config collisions.
- It still points at `Intl.Segmenter`, which is the underlying segmentation basis of the project.
- It keeps the basename short enough to stay practical in docs and shell examples.

## Suggested Config Shape Direction

Recommended first-version file shape:

```toml
detector = "regex"

[contentGate]
mode = "default"

[inspect]
detector = "wasm"

[path]
mode = "auto"

[progress]
mode = "auto"
```

Recommended rules:

- `detector` at the root should define the default detector for normal counting flows.
- `contentGate.mode` at the root should define the default detector-policy mode for normal counting flows.
- `inspect.detector` should be available in v1 as an optional inspect-only override.
- `inspect.contentGate.mode` should be available in v1 as an optional inspect-only override.
- If `inspect.detector` is absent, `inspect` should inherit the root `detector`.
- If `inspect.contentGate.mode` is absent, `inspect` should inherit the root `contentGate.mode`.
- CLI flags still win over all config-derived detector defaults.

This split keeps the default behavior consistent while still allowing users to prefer:

- regex for both
- wasm for both
- regex for counting, wasm for inspect
- wasm for counting, regex for inspect
- different detector-policy defaults for counting and inspect when needed

without changing command semantics.

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`
- `docs/plans/plan-2026-03-26-config-content-gate-support.md`

## References

[^1]: `docs/schemas/default-config.md`
[^2]: `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
[^3]: `docs/plans/jobs/2026-03-26-inspect-default-detector-followup.md`
[^4]: `docs/researches/research-2026-01-02-word-counter-options.md`
