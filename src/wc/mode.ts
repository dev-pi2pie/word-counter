import type { WordCounterMode } from "./types";

const MODE_ALIASES: Record<string, WordCounterMode> = {
  chunk: "chunk",
  chunks: "chunk",
  segments: "segments",
  segment: "segments",
  seg: "segments",
  collector: "collector",
  collect: "collector",
  colle: "collector",
  char: "char",
  chars: "char",
  character: "char",
  characters: "char",
  "char-collector": "char-collector",
};

const CHAR_MODE_ALIASES = new Set(["char", "chars", "character", "characters"]);
const COLLECTOR_MODE_ALIASES = new Set(["collector", "collect", "colle", "col"]);

function collapseSeparators(value: string): string {
  return value.replace(/[-_\s]+/g, "");
}

function isComposedCharCollectorFromTokens(value: string): boolean {
  const tokens = value
    .split(/[-_\s]+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 0);
  if (tokens.length < 2) {
    return false;
  }

  let hasCharAlias = false;
  let hasCollectorAlias = false;
  for (const token of tokens) {
    if (CHAR_MODE_ALIASES.has(token)) {
      hasCharAlias = true;
      continue;
    }
    if (COLLECTOR_MODE_ALIASES.has(token)) {
      hasCollectorAlias = true;
      continue;
    }
    return false;
  }

  return hasCharAlias && hasCollectorAlias;
}

function isComposedCharCollectorCompact(value: string): boolean {
  for (const charAlias of CHAR_MODE_ALIASES) {
    for (const collectorAlias of COLLECTOR_MODE_ALIASES) {
      if (value === `${charAlias}${collectorAlias}` || value === `${collectorAlias}${charAlias}`) {
        return true;
      }
    }
  }
  return false;
}

export function normalizeMode(input?: string | null): WordCounterMode | null {
  if (!input) {
    return null;
  }
  const normalized = input.trim().toLowerCase();
  const direct = MODE_ALIASES[normalized];
  if (direct) {
    return direct;
  }

  if (isComposedCharCollectorFromTokens(normalized)) {
    return "char-collector";
  }

  const compact = collapseSeparators(normalized);
  if (isComposedCharCollectorCompact(compact)) {
    return "char-collector";
  }

  return MODE_ALIASES[compact] ?? null;
}

export function resolveMode(
  input?: string | null,
  fallback: WordCounterMode = "chunk",
): WordCounterMode {
  return normalizeMode(input) ?? fallback;
}
