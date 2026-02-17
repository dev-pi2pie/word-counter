---
title: "path mode clarity and regex filtering"
created-date: 2026-02-17
modified-date: 2026-02-17
status: active
agent: Codex
---

## Goal

Resolve the existing docs clarity issue for `--path-mode manual` and the regex-based filename filtering feature request.

## Scope

- Clarify wording for `--path-mode manual` in CLI help and README.
- Add regex-based filename/path filtering for batch directory scanning.
- Preserve current deterministic ordering, dedupe, and direct-file path behavior.
- Use a single `--regex` option (non-repeatable) with clear misuse error on repeated flags.

## Out of Scope

- Deprecating or renaming `--path-mode`.
- Config-file persistence of regex filters.
- Changing single-input (non-`--path`) behavior.
- Regex include/exclude split flags in this phase.

## Issue Mapping

- Issue #35: `docs(cli): clarify --path-mode manual wording`
- Issue #36: `feat(cli): support filename regex matching in batch counting`

## Implementation Checkpoints

- [ ] Resolve Issue #35 by updating CLI help and README wording/examples.
- [ ] Resolve Issue #36 by implementing regex filtering semantics and tests.
- [ ] Enforce one `--regex` value and return a clear error when repeated.
- [ ] Add `docs/regex-usage-guide.md` and update README for regex only after feature behavior is implemented and stabilized.
- [ ] Verify docs, behavior, and tests are aligned before closing both issues.

## Acceptance Criteria

- `--path-mode manual` behavior is unambiguous in help text and README.
- Users can filter directory-expanded files with regex patterns using one unified regex configuration across all directory roots.
- Direct explicit file paths remain literal inputs and are not blocked by scan filters.
- Repeated `--regex` invocations fail with a clear misuse message.
- Existing ordering/dedupe guarantees remain intact.
- Test coverage includes regex precedence and invalid-pattern behavior.

## Risks and Mitigations

- Risk: scope creep from filter semantics discussion.
  - Mitigation: lock contract first, then implement.
- Risk: regressions in path resolution flow.
  - Mitigation: add resolver-level tests before final CLI integration validation.
- Risk: user confusion about filter scope.
  - Mitigation: document "directory scan only" behavior with concrete examples.

## Related Research

- `docs/research-2026-02-17-filename-regex-matching.md`
