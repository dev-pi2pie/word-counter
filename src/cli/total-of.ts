import type { SectionedResult } from "../markdown";
import type { NonWordCollection, WordCounterResult } from "../wc";

export const TOTAL_OF_PARTS = Object.freeze([
  "words",
  "emoji",
  "symbols",
  "punctuation",
  "whitespace",
] as const);

export type TotalOfPart = (typeof TOTAL_OF_PARTS)[number];

export type TotalOfOverride = {
  parts: TotalOfPart[];
  total: number;
};

type TotalOfCounts = Record<TotalOfPart, number>;

const TOTAL_OF_PART_ALIASES: Record<string, TotalOfPart> = {
  word: "words",
  words: "words",
  emoji: "emoji",
  emojis: "emoji",
  symbol: "symbols",
  symbols: "symbols",
  punction: "punctuation",
  punctuation: "punctuation",
  whitespace: "whitespace",
};

function createTotalOfCounts(): TotalOfCounts {
  return {
    words: 0,
    emoji: 0,
    symbols: 0,
    punctuation: 0,
    whitespace: 0,
  };
}

function collectNonWordCounts(target: TotalOfCounts, nonWords: NonWordCollection | undefined): void {
  if (!nonWords) {
    return;
  }

  target.emoji += nonWords.counts.emoji;
  target.symbols += nonWords.counts.symbols;
  target.punctuation += nonWords.counts.punctuation;
  target.whitespace += nonWords.counts.whitespace ?? 0;
}

function collectFromWordCounterResult(result: WordCounterResult): TotalOfCounts {
  const counts = createTotalOfCounts();
  counts.words += result.counts?.words ?? result.total;

  if (result.breakdown.mode === "collector") {
    collectNonWordCounts(counts, result.breakdown.nonWords);
    return counts;
  }

  for (const item of result.breakdown.items) {
    collectNonWordCounts(counts, item.nonWords);
  }

  return counts;
}

function collectTotalOfCounts(result: WordCounterResult | SectionedResult): TotalOfCounts {
  if (!("section" in result)) {
    return collectFromWordCounterResult(result);
  }

  const counts = createTotalOfCounts();
  for (const item of result.items) {
    const itemCounts = collectFromWordCounterResult(item.result);
    for (const part of TOTAL_OF_PARTS) {
      counts[part] += itemCounts[part];
    }
  }
  return counts;
}

function parseTotalOfToken(token: string): TotalOfPart {
  const normalized = token.trim().toLowerCase();
  const canonical = TOTAL_OF_PART_ALIASES[normalized];
  if (canonical) {
    return canonical;
  }
  throw new Error(
    `Invalid --total-of part: ${token}. Allowed: ${TOTAL_OF_PARTS.join(", ")}.`,
  );
}

export function parseTotalOfOption(value: string): TotalOfPart[] {
  const rawTokens = value
    .split(",")
    .map((token) => token.trim())
    .filter((token) => token.length > 0);

  if (rawTokens.length === 0) {
    throw new Error(
      `Invalid --total-of value: "${value}". Use comma-separated parts from: ${TOTAL_OF_PARTS.join(", ")}.`,
    );
  }

  const parts: TotalOfPart[] = [];
  const seen = new Set<TotalOfPart>();
  for (const token of rawTokens) {
    const parsed = parseTotalOfToken(token);
    if (seen.has(parsed)) {
      continue;
    }
    seen.add(parsed);
    parts.push(parsed);
  }

  return parts;
}

export function requiresNonWordCollection(parts: readonly TotalOfPart[] | undefined): boolean {
  if (!parts || parts.length === 0) {
    return false;
  }
  return parts.some((part) => part !== "words");
}

export function requiresWhitespaceCollection(parts: readonly TotalOfPart[] | undefined): boolean {
  if (!parts || parts.length === 0) {
    return false;
  }
  return parts.includes("whitespace");
}

export function resolveTotalOfOverride(
  result: WordCounterResult | SectionedResult,
  parts: readonly TotalOfPart[] | undefined,
): TotalOfOverride | undefined {
  if (!parts || parts.length === 0) {
    return undefined;
  }

  const counts = collectTotalOfCounts(result);
  let total = 0;
  for (const part of parts) {
    total += counts[part];
  }

  return {
    parts: [...parts],
    total,
  };
}

export function formatTotalOfParts(parts: readonly TotalOfPart[]): string {
  return parts.join(", ");
}
