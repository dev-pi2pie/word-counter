---
title: "config layer and detector defaults"
created-date: 2026-03-26
status: draft
agent: Codex
---

## Goal

Define the next-step configuration direction for `word-counter`, covering config-source precedence, file-format support, config naming, detector-related CLI consistency, and wording fixes needed in the current config schema draft.

## Milestone Goal

Establish a stable configuration contract that can be implemented without changing the current core counting model, while keeping CLI behavior predictable across normal counting and `inspect`.

## Key Findings

- The current config schema draft is stale in two ways.
  - `docs/schemas/default-config.md` still describes config-file support as a future `v0.1.0` draft.
  - That framing no longer matches the current repository state, which is already beyond the earlier canary planning phase and now includes newer detector-policy work.
- The current precedence contract is underspecified for path overrides.
  - The schema draft only says `CLI flags > env > config file > built-in defaults`.
  - It does not distinguish between a user-global config file and a per-directory project config file.
  - For the requested behavior, the effective order needs one more layer: `$HOME/.config/[configfile] < $DIR/[configfile] < ENV < flag options`.
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
- Supporting `toml`, `json`, and `jsonc` together is reasonable if the file names are explicit and unique.
  - The schema is simple enough to map cleanly across all three formats.
  - TOML and JSONC remain friendlier for hand-edited configs because they allow comments or comment-adjacent usage patterns.
  - Plain JSON remains useful for generated or machine-managed config.
- The naming choice matters more once multiple formats are supported.
  - Non-hidden names make discovery easier and fit the requested direction.
  - A unique basename avoids collisions with generic `config.toml` or tool-agnostic project config files.
  - Too many dots in the basename can read like stacked extensions instead of one intentional config name.
- The existing TOML frontmatter parser should not be reused as the config parser.
  - `src/markdown/toml/parse-frontmatter.ts` is intentionally scoped to markdown frontmatter extraction.
  - Its error model returns `null` for malformed input, which is acceptable for frontmatter fallback but too weak for config validation.
  - Config loading needs explicit validation errors and probably fuller TOML coverage than the frontmatter helper was designed to provide.

## Implications or Recommendations

- Adopt the following precedence contract for the config layer:

```text
built-in defaults
< $HOME/.config/[configfile]
< $DIR/[configfile]
< environment variables
< flag options
```

- Treat the two config files as the same schema loaded at different scopes.
  - The home config establishes personal defaults.
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
- If format precedence is needed among same-directory files, make it explicit and deterministic.
  - Recommended order within one directory scope: `toml`, then `jsonc`, then `json`.
  - A cleaner alternative is to reject multiple same-scope config files and ask the user to keep only one.
  - The implementation plan should choose one of those approaches up front.
- Do not describe the config work as a `v0.1.0` draft anymore.
  - Revise `docs/schemas/default-config.md` so it describes an active config contract draft without the stale milestone framing.
  - If milestone tracking is still needed, it belongs in a plan or job document, not as enduring schema wording.
- Reset the CLI `inspect` default detector to `regex`.
  - That keeps `word-counter inspect ...` aligned with the default counting flow.
  - Config, env, and flags can then override the default for users who prefer WASM inspection.
- Keep the library detector helper separate from the CLI default discussion.
  - If the library API wants an omitted-detector default, that default should be documented explicitly as a library contract.
  - However, the CLI should not silently diverge from the main command's default detector policy.
- Add `-d` as a global alias of `--detector`.
  - It should work in both normal counting and `inspect`.
  - Documentation should continue to present `--detector` as the canonical long form while showing `-d` in help text.

## Proposed Config Options

| Key | Type / Values | Default | CLI / Env Mapping | Notes |
| --- | --- | --- | --- | --- |
| `detector` | `"regex" \| "wasm"` | `"regex"` | `--detector`, `-d` | Root default for normal counting; `inspect` should inherit this in v1. |
| `path.mode` | `"auto" \| "manual"` | `"auto"` | `--path-mode`, `WORD_COUNTER_PATH_MODE` | Controls file-vs-directory interpretation for `--path`. |
| `path.recursive` | `boolean` | `true` | `--recursive` / `--no-recursive`, `WORD_COUNTER_RECURSIVE` | Applies when scanning directories. |
| `path.includeExtensions` | `string[]` | `[".md", ".markdown", ".mdx", ".mdc", ".txt"]` | `--include-ext`, `WORD_COUNTER_INCLUDE_EXT` | Directory expansion allowlist. |
| `path.excludeExtensions` | `string[]` | `[]` | `--exclude-ext`, `WORD_COUNTER_EXCLUDE_EXT` | Directory expansion denylist. |
| `path.detectBinary` | `boolean` | `true` | future | Keeps extensionless or unknown files from being treated as text automatically. |
| `progress.mode` | `"auto" \| "on" \| "off"` | `"auto"` | `--progress` / `--no-progress`, `WORD_COUNTER_PROGRESS` | Matches current batch/single-input progress policy. |
| `output.totalOf` | `("words" \| "emoji" \| "symbols" \| "punctuation" \| "whitespace")[]` | `[]` | `--total-of`, `WORD_COUNTER_TOTAL_OF` | Optional total override composition. |
| `reporting.skippedFiles` | `boolean` | `false` | `--quiet-skips` inverse, `WORD_COUNTER_REPORT_SKIPS` | Still debug-gated in current behavior. |
| `reporting.debugReport.path` | `string \| null` | `null` | `--debug-report`, `WORD_COUNTER_DEBUG_REPORT` | Explicit file sink when debug report is enabled. |
| `reporting.debugReport.tee` | `boolean` | `false` | `--debug-report-tee` / `--debug-tee`, `WORD_COUNTER_DEBUG_REPORT_TEE` | Mirrors file-routed debug lines to `stderr`. |
| `logging.level` | `"info" \| "debug"` | `"info"` | `--debug`, `WORD_COUNTER_LOG_LEVEL` | Current diagnostics gate. |
| `logging.verbosity` | `"compact" \| "verbose"` | `"compact"` | `--verbose`, `WORD_COUNTER_LOG_VERBOSITY` | `verbose` still depends on debug mode. |

## Config Filenames

Recommended basename:

- `wc-intl-seg.config`

Supported files:

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

[path]
mode = "auto"

[progress]
mode = "auto"
```

Recommended rules:

- `detector` at the root should define the default detector for normal counting flows.
- `inspect` should inherit the root `detector` value in v1.
- If the project wants a separate inspect-only default later, `inspect.detector` is the obvious extension point.
- CLI flags still win over all config-derived detector defaults.

This split keeps the default behavior consistent while still allowing users to prefer:

- wasm for both
- regex for both

without changing command semantics.

## Open Questions

- Should the home-level path follow XDG exactly or support a fallback for non-XDG environments?
  - The requested path uses `$HOME/.config/[configfile]`, which is a reasonable default.
  - The implementation plan should decide whether to support any secondary legacy fallback path.
- When more than one supported config format exists at the same scope, should the loader reject that state or choose a fixed priority order?
  - Rejecting duplicates is simpler and avoids silent ambiguity.
  - A fixed order is more forgiving but needs clear documentation.
- Should the project later add a dedicated `inspect.detector` key for a separate inspect-only default?
  - The root `detector` key is enough for the first version.
  - A separate inspect key remains a reasonable follow-up if CLI and library defaults need to diverge again.

## Related Plans

- `docs/plans/plan-2026-03-25-detector-policy-and-inspect-command.md`

## References

[^1]: `docs/schemas/default-config.md`
[^2]: `docs/researches/research-2026-03-25-detector-policy-and-inspector-surface.md`
[^3]: `docs/plans/jobs/2026-03-26-inspect-default-detector-followup.md`
[^4]: `docs/researches/research-2026-01-02-word-counter-options.md`
