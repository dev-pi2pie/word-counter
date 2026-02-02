import type { NonWordCollection, WhitespaceCounts } from "./types";

const emojiRegex = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;
const emojiPresentationRegex = /\p{Emoji_Presentation}/u;
const keycapEmojiRegex = /[0-9#*]\uFE0F?\u20E3/u;
const symbolRegex = /\p{S}/u;
const punctuationRegex = /\p{P}/u;
const whitespaceRegex = /\s/u;
const newlineChars = new Set(["\n", "\r", "\u2028", "\u2029"]);

export function createNonWordCollection(): NonWordCollection {
  return {
    emoji: [],
    symbols: [],
    punctuation: [],
    counts: {
      emoji: 0,
      symbols: 0,
      punctuation: 0,
    },
  };
}

export function addNonWord(
  collection: NonWordCollection,
  category: "emoji" | "symbol" | "punctuation",
  segment: string,
): void {
  if (category === "emoji") {
    collection.emoji.push(segment);
    collection.counts.emoji += 1;
    return;
  }
  if (category === "symbol") {
    collection.symbols.push(segment);
    collection.counts.symbols += 1;
    return;
  }
  collection.punctuation.push(segment);
  collection.counts.punctuation += 1;
}

export function addWhitespace(
  collection: NonWordCollection,
  segment: string,
): number {
  let whitespace = collection.whitespace;
  let count = 0;
  for (const char of segment) {
    if (char === " ") {
      whitespace = whitespace ?? createWhitespaceCounts();
      whitespace.spaces += 1;
      count += 1;
      continue;
    }
    if (char === "\t") {
      whitespace = whitespace ?? createWhitespaceCounts();
      whitespace.tabs += 1;
      count += 1;
      continue;
    }
    if (newlineChars.has(char)) {
      whitespace = whitespace ?? createWhitespaceCounts();
      whitespace.newlines += 1;
      count += 1;
      continue;
    }
    if (whitespaceRegex.test(char)) {
      whitespace = whitespace ?? createWhitespaceCounts();
      whitespace.other += 1;
      count += 1;
    }
  }

  if (count > 0) {
    collection.whitespace = whitespace ?? createWhitespaceCounts();
    collection.counts.whitespace = (collection.counts.whitespace ?? 0) + count;
  }

  return count;
}

export function classifyNonWordSegment(
  segment: string,
): "emoji" | "symbol" | "punctuation" | null {
  const hasEmojiVariationSelector = segment.includes("\uFE0F");
  if (
    keycapEmojiRegex.test(segment) ||
    emojiPresentationRegex.test(segment) ||
    (hasEmojiVariationSelector && emojiRegex.test(segment))
  ) {
    return "emoji";
  }
  if (symbolRegex.test(segment)) {
    return "symbol";
  }
  if (punctuationRegex.test(segment)) {
    return "punctuation";
  }
  return null;
}

export function mergeNonWordCollections(
  target: NonWordCollection,
  source: NonWordCollection,
): NonWordCollection {
  if (source.counts.emoji > 0) {
    target.emoji.push(...source.emoji);
    target.counts.emoji += source.counts.emoji;
  }
  if (source.counts.symbols > 0) {
    target.symbols.push(...source.symbols);
    target.counts.symbols += source.counts.symbols;
  }
  if (source.counts.punctuation > 0) {
    target.punctuation.push(...source.punctuation);
    target.counts.punctuation += source.counts.punctuation;
  }
  if (source.counts.whitespace && source.counts.whitespace > 0 && source.whitespace) {
    const whitespace = target.whitespace ?? createWhitespaceCounts();
    whitespace.spaces += source.whitespace.spaces;
    whitespace.tabs += source.whitespace.tabs;
    whitespace.newlines += source.whitespace.newlines;
    whitespace.other += source.whitespace.other;
    target.whitespace = whitespace;
    target.counts.whitespace = (target.counts.whitespace ?? 0) + source.counts.whitespace;
  }
  return target;
}

function createWhitespaceCounts(): WhitespaceCounts {
  return { spaces: 0, tabs: 0, newlines: 0, other: 0 };
}
