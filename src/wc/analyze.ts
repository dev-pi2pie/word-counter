import { getSegmenter } from "./segmenter";
import type { ChunkAnalysis, CollectorBreakdown, LocaleChunk } from "./types";

export function analyzeChunk(chunk: LocaleChunk): ChunkAnalysis {
  const segmenter = getSegmenter(chunk.locale);
  const segments: string[] = [];
  for (const part of segmenter.segment(chunk.text)) {
    if (part.isWordLike) {
      segments.push(part.segment);
    }
  }
  return {
    locale: chunk.locale,
    text: chunk.text,
    segments,
    words: segments.length,
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
