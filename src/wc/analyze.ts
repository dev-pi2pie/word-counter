import { getSegmenter } from "./segmenter";
import {
  addNonWord,
  classifyNonWordSegment,
  createNonWordCollection,
} from "./non-words";
import type {
  ChunkAnalysis,
  CollectorBreakdown,
  LocaleChunk,
  NonWordCollection,
} from "./types";

export function analyzeChunk(
  chunk: LocaleChunk,
  collectNonWords?: boolean,
): ChunkAnalysis {
  const segmenter = getSegmenter(chunk.locale);
  const segments: string[] = [];
  const nonWords: NonWordCollection | null = collectNonWords
    ? createNonWordCollection()
    : null;
  for (const part of segmenter.segment(chunk.text)) {
    if (part.isWordLike) {
      segments.push(part.segment);
    } else if (collectNonWords && nonWords) {
      const category = classifyNonWordSegment(part.segment);
      if (category) {
        addNonWord(nonWords, category, part.segment);
      }
    }
  }
  return {
    locale: chunk.locale,
    text: chunk.text,
    segments,
    words: segments.length,
    nonWords: nonWords ?? undefined,
  };
}

export function aggregateByLocale(
  chunks: ChunkAnalysis[]
): CollectorBreakdown[] {
  const order: string[] = [];
  const map = new Map<string, CollectorBreakdown>();

  for (const chunk of chunks) {
    const existing = map.get(chunk.locale);
    if (existing) {
      existing.words += chunk.words;
      existing.segments.push(...chunk.segments);
      continue;
    }

    order.push(chunk.locale);
    map.set(chunk.locale, {
      locale: chunk.locale,
      words: chunk.words,
      segments: [...chunk.segments],
    });
  }

  return order.map((locale) => map.get(locale)!);
}
