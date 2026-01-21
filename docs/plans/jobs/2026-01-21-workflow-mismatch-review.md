---
title: "Workflow mismatch review and alignment"
date: 2026-01-21
status: completed
agent: codex
---

## Goal
Capture the current workflow alignment status and provide reusable prompts to reproduce the three actions.

## What Changed
- Aligned tag input sanitization and shallow fetch behavior in publish workflows.
- Verified remaining intentional mismatches across `publish-github-packages.yml`, `publish-npm-packages.yml`, and `release.yml`.

## Findings
- Trusted publishing vs token auth (OIDC + `--provenance` vs `GITHUB_TOKEN`).
- Registry configuration and scope differences.
- GitHub Packages workflow rewrites the package name; npm workflow does not.
- npm update step exists only in the npm workflow.
- Release workflow contains git-cliff range logic not present in publish workflows.
