---
title: "CI pull request only trigger"
created-date: 2026-03-24
status: completed
agent: Codex
---

## Goal

Stop duplicate CI runs for the same branch update by limiting the CI workflow to pull request events only.

## What Changed

- Removed the `push` trigger from `.github/workflows/ci.yml`.
- Kept the existing `pull_request` trigger and validation job unchanged.

## Why

- Branches with an open pull request were causing two workflow runs for the same commit:
  - one from `push`
  - one from `pull_request`
- Restricting CI to pull request events keeps review validation while removing duplicate branch-build executions.

## Validation

- Reviewed `.github/workflows/ci.yml` after the trigger change.

