#!/usr/bin/env bash
set -euo pipefail

usage() {
  cat <<'EOF'
Quick local verification for stable release notes.

This script resolves stable tag/range inputs, then calls:
  scripts/generate-stable-release-notes.sh

Usage:
  scripts/local-release-verification.sh [options]

Options:
  --mode <commit|pr|hybrid>
                         Render mode (default: commit)
  --current-tag <tag>    Stable tag to verify (default: latest stable tag)
  --previous-tag <tag>   Previous stable tag (default: auto-resolve)
  --range <git-range>    Explicit git range override (e.g. abc..def)
  --repository <repo>    GitHub repo slug (e.g. owner/repo)
  --fallback-login <id>  Fallback contributor login when API resolution fails (e.g. @your-account-name)
  --output <file>        Write release notes to file instead of stdout
  --show-inputs          Print resolved inputs to stderr
  -h, --help             Show this help

Examples:
  scripts/local-release-verification.sh
  scripts/local-release-verification.sh --fallback-login @your-account-name
  scripts/local-release-verification.sh --mode pr --show-inputs
  scripts/local-release-verification.sh --mode hybrid --show-inputs
  scripts/local-release-verification.sh --current-tag v0.1.3 --show-inputs
  scripts/local-release-verification.sh --current-tag v0.1.3 --output /tmp/release-notes.md
  scripts/local-release-verification.sh --range "abc123..def456" --current-tag v0.1.3
EOF
}

MODE="commit"
CURRENT_TAG=""
PREVIOUS_TAG=""
RELEASE_RANGE=""
REPOSITORY=""
FALLBACK_LOGIN=""
OUTPUT_PATH=""
SHOW_INPUTS=false

while [ $# -gt 0 ]; do
  case "$1" in
    --mode)
      MODE="${2:-}"
      shift 2
      ;;
    --current-tag)
      CURRENT_TAG="${2:-}"
      shift 2
      ;;
    --previous-tag)
      PREVIOUS_TAG="${2:-}"
      shift 2
      ;;
    --range)
      RELEASE_RANGE="${2:-}"
      shift 2
      ;;
    --repository)
      REPOSITORY="${2:-}"
      shift 2
      ;;
    --fallback-login)
      FALLBACK_LOGIN="${2:-}"
      shift 2
      ;;
    --output)
      OUTPUT_PATH="${2:-}"
      shift 2
      ;;
    --show-inputs)
      SHOW_INPUTS=true
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage >&2
      exit 1
      ;;
  esac
done

if [ "$MODE" != "commit" ] && [ "$MODE" != "pr" ] && [ "$MODE" != "hybrid" ]; then
  echo "Invalid --mode: $MODE (expected: commit, pr, or hybrid)" >&2
  usage >&2
  exit 1
fi

if [ -z "$CURRENT_TAG" ]; then
  CURRENT_TAG=$(
    git tag --sort=-version:refname \
      | grep -Ev '(-alpha|-beta|-rc|-canary)' \
      | head -n1 || true
  )
fi

if [ -z "$CURRENT_TAG" ]; then
  echo "Unable to resolve a stable current tag. Set --current-tag explicitly." >&2
  exit 1
fi

if [ -z "$RELEASE_RANGE" ]; then
  if [ -z "$PREVIOUS_TAG" ]; then
    PREVIOUS_TAG=$(
      git tag --merged "${CURRENT_TAG}^" --sort=-version:refname \
        | grep -Ev '(-alpha|-beta|-rc|-canary)' \
        | head -n1 || true
    )
  fi

  if [ -n "$PREVIOUS_TAG" ]; then
    RELEASE_RANGE="$(git rev-parse "${PREVIOUS_TAG}^{commit}")..$(git rev-parse "${CURRENT_TAG}^{commit}")"
  else
    RELEASE_RANGE="$(git rev-parse "${CURRENT_TAG}^{commit}")"
  fi
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
GENERATOR="$SCRIPT_DIR/generate-stable-release-notes.sh"

if [ ! -x "$GENERATOR" ]; then
  echo "Missing executable script: $GENERATOR" >&2
  echo "Run: chmod +x scripts/generate-stable-release-notes.sh" >&2
  exit 1
fi

ARGS=(--range "$RELEASE_RANGE" --current-tag "$CURRENT_TAG")
ARGS+=(--mode "$MODE")

if [ -n "$PREVIOUS_TAG" ]; then
  ARGS+=(--previous-tag "$PREVIOUS_TAG")
fi

if [ -n "$REPOSITORY" ]; then
  ARGS+=(--repository "$REPOSITORY")
fi

if [ -n "$FALLBACK_LOGIN" ]; then
  ARGS+=(--fallback-login "$FALLBACK_LOGIN")
fi

if [ "$SHOW_INPUTS" = true ]; then
  {
    echo "[local-release-verification] mode: $MODE"
    echo "[local-release-verification] current-tag: $CURRENT_TAG"
    if [ -n "$PREVIOUS_TAG" ]; then
      echo "[local-release-verification] previous-tag: $PREVIOUS_TAG"
    else
      echo "[local-release-verification] previous-tag: (none)"
    fi
    echo "[local-release-verification] range: $RELEASE_RANGE"
    if [ -n "$REPOSITORY" ]; then
      echo "[local-release-verification] repository: $REPOSITORY"
    else
      echo "[local-release-verification] repository: (auto)"
    fi
    if [ -n "$FALLBACK_LOGIN" ]; then
      echo "[local-release-verification] fallback-login: $FALLBACK_LOGIN"
    fi
    if [ -n "${GH_TOKEN:-${GITHUB_TOKEN:-}}" ]; then
      echo "[local-release-verification] auth-token: present"
    else
      echo "[local-release-verification] auth-token: absent"
    fi
    if command -v curl >/dev/null 2>&1; then
      echo "[local-release-verification] curl: present"
    else
      echo "[local-release-verification] curl: absent"
    fi
    if command -v jq >/dev/null 2>&1; then
      echo "[local-release-verification] jq: present"
    else
      echo "[local-release-verification] jq: absent"
    fi
  } >&2
fi

if [ -n "$OUTPUT_PATH" ]; then
  "$GENERATOR" "${ARGS[@]}" > "$OUTPUT_PATH"
  echo "[local-release-verification] wrote: $OUTPUT_PATH" >&2
else
  "$GENERATOR" "${ARGS[@]}"
fi
