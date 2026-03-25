---
title: "content gate verification guidance"
created-date: 2026-03-25
status: completed
agent: Codex
---

## Goal

Update the detector-facing docs so `contentGate` verification guidance matches the observed behavior on large technical documents such as `README.md`.

## What Changed

- Added a practical verification section to `docs/language-detection-support-guide.md`.
- Documented that:
  - `off` is easy to confirm on large technical files
  - `default`, `strict`, and `loose` often look identical on strongly technical or strongly prose-heavy files
  - `inspect` and detector-evidence output are the preferred verification tools for borderline samples
- Added suggested verification commands for:
  - `default`
  - `strict`
  - `loose`
  - `off`
- Added a short verification note to `README.md` so the high-level CLI guide points users toward the right validation workflow.

## Validation

- Reviewed the updated wording against the observed `README.md` collector-mode results for:
  - `default`
  - `strict`
  - `loose`
  - `off`
- Confirmed the guidance matches the implemented detector-policy behavior and current diagnostic surfaces.
