---
title: "dev tooling security updates"
created-date: 2026-03-31
modified-date: 2026-03-31
status: completed
agent: Codex
---

## Goal

Review and, if safe, update the current `oxfmt`, `oxlint`, and `tsdown` development tooling versions in response to outdated-package and security-audit results.

## Scope

- Check current release notes and security signals for `oxfmt`, `oxlint`, and `tsdown`
- Verify whether the repo's local configuration is likely to be affected by known behavioral changes
- Update the tooling versions and lockfile if the risk is acceptable
- Re-run dependency audit plus targeted build, lint, and test verification

## Notes

- `bun audit` currently reports a vulnerable `picomatch` transitively via `tsdown`
- This job is focused on dev tooling only, not production runtime dependencies

## Completed Work

- Reviewed current upstream release notes and advisory signals for `oxfmt`, `oxlint`, and `tsdown`
- Updated:
  - `oxfmt` from `^0.42.0` to `^0.43.0`
  - `oxlint` from `^1.57.0` to `^1.58.0`
  - `tsdown` from `^0.21.6` to `^0.21.7`
- Refreshed `bun.lock`
- Added a narrow `package.json` override for `picomatch` `4.0.4` so Bun resolves the non-vulnerable version across the `tsdown` dependency chain

## Verification

- `bun audit` reported no vulnerabilities after the override
- `bun run lint` passed
- `bun run test:ci` passed when rerun outside the sandbox after the local WASM permission restriction

## Risk Notes

- `oxlint` `1.58.0` includes a breaking change for unknown built-in rules, but the repo's `.oxlintrc.json` uses only basic environment and ignore settings, so it did not affect this project
- The security finding was not fixed by the plain tooling update alone because Bun still resolved a nested `picomatch@4.0.3`; the explicit override was needed to make the audit pass
