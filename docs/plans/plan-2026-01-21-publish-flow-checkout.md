---
title: "Publish flow checkout and tag validation"
created-date: 2026-01-21
status: completed
agent: Codex
---

## Goal
Clarify and streamline checkout/tag fetching behavior for publish workflows, and align README wording with current GitHub Packages access policy.

## Scope
- Review the publish workflows checkout + tag/branch validation steps.
- Decide on a single source of truth for fetch depth vs. tag fetching.
- Update README to remove GitHub Packages sync/scoping language.

## Proposed Actions
- Add an optional `shallow_since` input for manual publish runs; when empty, fall back to full history for the branch check fetches.
- Keep `actions/checkout` focused on the tag ref; avoid relying on `fetch-tags` for ancestry checks.
- Reduce checkout cost with shallow fetch and unshallow during branch validation when needed.
- Document the recommended approach for tag-driven and manual publish runs.
- Adjust README installation/usage copy to remove GitHub Packages sync/scoping guidance.

## Success Criteria
- Manual runs can optionally provide a `shallow_since` date; empty uses full history for correctness.
- Clear guidance on when to use `fetch-depth` and `fetch-tags` in publish workflows.
- README reflects maintainer-only GitHub Packages access.

## Related Research
None.
