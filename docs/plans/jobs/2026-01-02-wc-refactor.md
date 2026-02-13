---
title: "Refactor wc.ts Into Modules"
created-date: 2026-01-02
status: completed
agent: Codex
---

## Goal
Split `src/wc/wc.ts` into smaller modules while preserving public API and behavior.

## Notes
- Keep Node.js compatibility.
- No behavioral changes to locale detection in this pass.

## Changes
- Split locale detection, segmentation, segmenter cache, and analysis into `src/wc` modules.
- Left `src/wc/wc.ts` as the public orchestrator and export surface.
- Preserved existing public API and test expectations.

## Verification
- `bun test`
