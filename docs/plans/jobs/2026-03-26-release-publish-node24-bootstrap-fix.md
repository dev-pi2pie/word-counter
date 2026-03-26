---
title: "release publish node24 bootstrap fix"
created-date: 2026-03-26
status: completed
agent: Codex
---

## Goal

Patch the release workflow so npm publishing no longer depends on a broken self-update path from the Node 22 bundled npm on GitHub-hosted runners.

## What Changed

- Updated `.github/workflows/release.yml` so `publish_npm` uses Node.js `24` instead of `22.22.2`.
- Removed the `Update npm for trusted publishing` step (`npm install -g npm@latest`) from `publish_npm`.
- Updated `.github/workflows/release.yml` so `publish_github_packages` also uses Node.js `24` instead of `22.22.2`.
- Kept the `prepare` job on Node.js `22.22.2` so the release build still runs on the repository's current 22.x baseline.

## Why

- The npm publish failure occurred before `npm publish`, inside the npm CLI bundled with the Node.js `22.22.2` runner toolcache installation.
- npm trusted publishing requires a modern npm CLI, and Node.js `24` already provides a compatible npm line without needing a self-update bootstrap step.
- Moving both publish jobs to Node.js `24` avoids the broken npm bootstrap path in both registries' publish flows while keeping the build baseline unchanged.

## Validation

- Parsed `.github/workflows/release.yml` successfully as YAML after the change.
- Rechecked that `publish_npm` still retains `id-token: write` and `NODE_AUTH_TOKEN: ""` for OIDC trusted publishing.
