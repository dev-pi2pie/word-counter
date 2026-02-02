import { countCharsForLocale, getSegmenter } from "./segmenter";
import {
  addNonWord,
  addWhitespace,
  classifyNonWordSegment,
  createNonWordCollection,
} from "./non-words";
import type {
  ChunkAnalysis,
  CollectorBreakdown,
  LocaleChunk,
  NonWordCollection,
} from "./types";

type CharAnalysis = LocaleChunk & { chars: number; nonWords?: NonWordCollection };

export function analyzeChunk(
  chunk: LocaleChunk,
  collectNonWords?: boolean,
  includeWhitespace?: boolean,
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
      if (includeWhitespace) {
        addWhitespace(nonWords, part.segment);
      }
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

export function analyzeCharChunk(
  chunk: LocaleChunk,
  collectNonWords?: boolean,
  includeWhitespace?: boolean,
): CharAnalysis & { wordChars: number; nonWordChars: number } {
  const segmenter = getSegmenter(chunk.locale);
  const nonWords: NonWordCollection | null = collectNonWords
    ? createNonWordCollection()
    : null;
  let chars = 0;
  let wordChars = 0;
  let nonWordChars = 0;

  for (const part of segmenter.segment(chunk.text)) {
    if (part.isWordLike) {
      const count = countCharsForLocale(part.segment, chunk.locale);
      chars += count;
      wordChars += count;
      continue;
    }

    if (collectNonWords && nonWords) {
      let whitespaceCount = 0;
      if (includeWhitespace) {
        whitespaceCount = addWhitespace(nonWords, part.segment);
      }
      const category = classifyNonWordSegment(part.segment);
      if (category) {
        addNonWord(nonWords, category, part.segment);
      }
      if (category || whitespaceCount > 0) {
        const count = countCharsForLocale(part.segment, chunk.locale);
        chars += count;
        nonWordChars += count;
      }
    }
  }

  return {
    locale: chunk.locale,
    text: chunk.text,
    chars,
    wordChars,
    nonWordChars,
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
