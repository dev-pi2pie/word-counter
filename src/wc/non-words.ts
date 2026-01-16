import type { NonWordCollection } from "./types";

const emojiRegex = /(?:\p{Extended_Pictographic}|\p{Emoji_Presentation})/u;
const emojiPresentationRegex = /\p{Emoji_Presentation}/u;
const keycapEmojiRegex = /[0-9#*]\uFE0F?\u20E3/u;
const symbolRegex = /\p{S}/u;
const punctuationRegex = /\p{P}/u;

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
  return target;
}
