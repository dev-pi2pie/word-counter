import { countCharsForLocale, getSegmenter } from "./segmenter";
import {
  addNonWord,
  addWhitespace,
  classifyNonWordSegment,
  createNonWordCollection,
  mergeNonWordCollections,
} from "./non-words";
import { appendAll } from "../utils/append-all";
import type {
  CharCollectorBreakdown,
  ChunkAnalysis,
  CollectorBreakdown,
  LocaleChunk,
  NonWordCollection,
} from "./types";

type CharAnalysis = LocaleChunk & { chars: number; nonWords?: NonWordCollection };
type CharChunkAnalysis = CharAnalysis & { wordChars: number; nonWordChars: number };

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
): CharChunkAnalysis {
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

export function aggregateCharsByLocale(
  chunks: CharChunkAnalysis[],
): Array<CharCollectorBreakdown & { wordChars: number; nonWordChars: number }> {
  const order: string[] = [];
  const map = new Map<
    string,
    CharCollectorBreakdown & { wordChars: number; nonWordChars: number }
  >();

  for (const chunk of chunks) {
    const existing = map.get(chunk.locale);
    if (existing) {
      existing.chars += chunk.chars;
      existing.wordChars += chunk.wordChars;
      existing.nonWordChars += chunk.nonWordChars;
      if (chunk.nonWords) {
        if (!existing.nonWords) {
          existing.nonWords = createNonWordCollection();
        }
        mergeNonWordCollections(existing.nonWords, chunk.nonWords);
      }
      continue;
    }

    order.push(chunk.locale);
    map.set(chunk.locale, {
      locale: chunk.locale,
      chars: chunk.chars,
      wordChars: chunk.wordChars,
      nonWordChars: chunk.nonWordChars,
      nonWords: chunk.nonWords
        ? mergeNonWordCollections(createNonWordCollection(), chunk.nonWords)
        : undefined,
    });
  }

  return order.map((locale) => map.get(locale)!);
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
      appendAll(existing.segments, chunk.segments);
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
