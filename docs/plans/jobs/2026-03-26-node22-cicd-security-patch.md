---
title: "node 22 ci cd security patch"
created-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Patch CI/CD workflows to a Node.js 22.x security release without changing the package runtime support contract.

## What Changed

- Updated `.github/workflows/ci.yml` to use Node.js `22.22.2` in the explicit `actions/setup-node` step.
- Updated `.github/workflows/release.yml` to use Node.js `22.22.2` in the `prepare`, `publish_npm`, and `publish_github_packages` jobs.
- Kept `package.json` and runtime-facing docs at `>=22.18.0` so the published support baseline did not change.

## Why

- Node.js published the March 24, 2026 security release for the 22.x line as `v22.22.2`.
- This keeps repository automation on a patched 22.x runtime while avoiding an unnecessary compatibility-policy change for consumers.

## Validation

- Verified workflow pins now reference `22.22.2` in CI and release automation.
