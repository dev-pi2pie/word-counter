---
title: "Filename regex matching for batch counting"
created-date: 2026-02-17
modified-date: 2026-02-17
status: completed
agent: Codex
---

## Goal

Define a practical design for regex-based filename/path filtering in batch counting.

## Working Goal

Prepare a low-risk implementation direction that can be scheduled with the current docs clarification issue and implementation plan.

## Key Findings

- Current path resolution already has a clear filtering stage for directory-expanded files (`shouldIncludeFromDirectory`), which is the safest insertion point for regex matching.
- Regex filtering should be activated only for directory-expanded files from `--path <dir>` inputs.
- Existing contract separates direct file inputs from directory-scan filtering. Keep that rule for regex to avoid breaking current explicit-path behavior.
- For multi-directory input, use one unified regex configuration across all directory roots, evaluate per root-relative path, then merge matches and dedupe by absolute path.
- Deterministic ordering and dedupe are post-filter guarantees and can remain unchanged if regex filtering occurs before adding files to the resolved set.
- Regex should be compiled once up front from CLI options and reused during scan filtering to avoid per-file compilation overhead.
- Invalid regex patterns should fail fast with a user-facing parse error rather than silently skipping patterns.
- Matching target should collocate with `--path <dir>` usage by applying regex to scan-root-relative paths under each provided directory root.

## Implications or Recommendations

- Add `--regex <pattern>` as a directory-scan filter.
- Support exactly one `--regex` value.
- If `--regex` is provided multiple times, fail fast with a clear CLI error.
- Apply regex only when at least one `--path <dir>` target is present.
- Apply the same regex filter set across all provided directory roots, then resolve the final file list from merged matched files.
- Preserve direct explicit file semantics:
  - explicit `--path /some/file.ext` remains countable even if regex filters would not match.
- If `--regex` is omitted or provided with an empty effective value, treat it as no restriction.
- Do not add separate include/exclude regex flags in this iteration.
- Emit debug diagnostics for regex exclusion similar to extension exclusion so filtering decisions remain observable.
- Add `docs/regex-usage-guide.md` as a follow-up docs task after feature implementation, then sync README with the finalized behavior.
- Add tests for:
  - regex with directory roots only
  - one regex across multiple directory roots with merged+deduped results
  - regex ignored for explicit file paths
  - empty regex fallback to unrestricted directory scanning
  - repeated `--regex` misuse returns a clear error
  - invalid regex
  - mixed direct-file + directory behavior

## Decisions

- Regex is include-only in this phase via a single `--regex <pattern>` option.
- Repeated `--regex` is treated as misuse and must fail fast.
- Separate include/exclude regex options are deferred.

## Related Plans

- `docs/plans/plan-2026-02-17-path-mode-clarity-and-regex-filtering.md`

## References

- [^1]: Issue #36, "feat(cli): support filename regex matching in batch counting"
- [^2]: `src/cli/path/resolve.ts`
- [^3]: `src/cli/path/filter.ts`
- [^4]: `README.md` (Stable Path Resolution Contract)
