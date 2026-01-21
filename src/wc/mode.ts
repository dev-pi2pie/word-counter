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
};

export function normalizeMode(input?: string | null): WordCounterMode | null {
  if (!input) {
    return null;
  }
  const normalized = input.trim().toLowerCase();
  return MODE_ALIASES[normalized] ?? null;
}

export function resolveMode(
  input?: string | null,
  fallback: WordCounterMode = "chunk",
): WordCounterMode {
  return normalizeMode(input) ?? fallback;
}
