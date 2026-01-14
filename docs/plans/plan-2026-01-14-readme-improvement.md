---
title: "README Improvement: Installation and Usage Clarity"
date: 2026-01-14
status: completed
agent: GitHub Copilot
---

## Goal

Improve the README to provide clearer installation and usage instructions that align with the current distribution strategy (GitHub Packages) and developer workflow.

## Current Issues

1. The "Usage" section jumps directly into CLI examples assuming the package is already built and available
2. No guidance on initial setup (cloning, installing dependencies, building)
3. No instructions for local installation via `npm link` for development/testing
4. Writing style is inconsistent—assumes user already has the CLI ready to use

## Proposed Changes

### 1. Restructure Installation Section

Add a new "Installation" section before "Usage" that covers:

- **For Users**: Instructions for installing from GitHub Packages (when available)
- **For Development**:
  - Clone the repository: `git clone https://github.com/dev-pi2pie/word-counter.git`
  - Install dependencies: `bun install`
  - Build the project: `bun run build`
  - Link locally: `npm link`
  - Use the CLI globally: `word-counter "Hello world"`
  - Uninstall: `npm unlink --global word-counter` (to remove the global link)

### 2. Update Usage Section

Keep existing CLI examples but clarify that they assume:

- The package is already installed (via npm link or GitHub Packages)
- OR the user is running from the built distribution

Reorganize as:

- **Direct Node execution** (current method with `node dist/esm/bin.mjs`)
- **Global CLI usage** (after `npm link`: `word-counter <text>`)

### 3. Add Library Usage Note

Clarify that the library exports can be used after:

- Installing the package from GitHub Packages, or
- Running `npm link` for local development

## Rationale

- Better onboarding for new contributors and users
- Clear separation between development workflow and package consumption
- Aligns with the fact that the package is not yet on public NPM
- Sets expectations for GitHub Packages distribution

## Implementation Notes

- Keep the existing "Library Usage" section structure (ESM/CJS examples)
- Maintain all current CLI examples and options documentation
- Add a note about GitHub Packages when publishing is ready
- Keep "How It Works" section unchanged

## Out of Scope

- Setting up GitHub Packages publishing (already handled by GitHub Actions)
- Detailed GitHub Packages authentication instructions (can be added later if needed)
- npm public registry publishing (future work)
