import {
  analyzeCharChunk,
  analyzeChunk,
  aggregateByLocale,
  aggregateCharsByLocale,
} from "./analyze";
import { resolveMode } from "./mode";
import { segmentTextByLocale } from "./segment";
import { countCharsForLocale, countWordsForLocale } from "./segmenter";
import { createNonWordCollection, mergeNonWordCollections } from "./non-words";
import type {
  CharBreakdown,
  CharCollectorBreakdown,
  ChunkBreakdown,
  ChunkWithSegments,
  NonWordCollection,
  WordCounterMode,
  WordCounterOptions,
  WordCounterResult,
} from "./types";

export type {
  NonWordCollection,
  WordCounterMode,
  WordCounterOptions,
  WordCounterResult,
  WordCounterBreakdown,
} from "./types";

export { countCharsForLocale, countWordsForLocale, segmentTextByLocale };

export function wordCounter(
  text: string,
  options: WordCounterOptions = {}
): WordCounterResult {
  const mode: WordCounterMode = resolveMode(options.mode, "chunk");
  const collectNonWords = Boolean(options.nonWords);
  const includeWhitespace = Boolean(options.includeWhitespace);
  const chunks = segmentTextByLocale(text, {
    latinLanguageHint: options.latinLanguageHint,
    latinTagHint: options.latinTagHint,
    latinLocaleHint: options.latinLocaleHint,
    hanLanguageHint: options.hanLanguageHint,
    hanTagHint: options.hanTagHint,
  });

  if (mode === "char" || mode === "char-collector") {
    const analyzed = chunks.map((chunk) =>
      analyzeCharChunk(chunk, collectNonWords, includeWhitespace),
    );
    const total = analyzed.reduce((sum, chunk) => sum + chunk.chars, 0);
    const counts = collectNonWords
      ? {
          words: analyzed.reduce((sum, chunk) => sum + chunk.wordChars, 0),
          nonWords: analyzed.reduce((sum, chunk) => sum + chunk.nonWordChars, 0),
          total,
        }
      : undefined;

    if (mode === "char") {
      const items: CharBreakdown[] = analyzed.map((chunk) => ({
        locale: chunk.locale,
        text: chunk.text,
        chars: chunk.chars,
        nonWords: chunk.nonWords,
      }));
      return {
        total,
        counts,
        breakdown: {
          mode,
          items,
        },
      };
    }

    const aggregated = aggregateCharsByLocale(analyzed);
    const items: CharCollectorBreakdown[] = aggregated.map((chunk) => ({
      locale: chunk.locale,
      chars: chunk.chars,
      nonWords: chunk.nonWords,
    }));
    return {
      total,
      counts,
      breakdown: {
        mode,
        items,
      },
    };
  }

  const analyzed = chunks.map((chunk) =>
    analyzeChunk(chunk, collectNonWords, includeWhitespace),
  );
  const wordsTotal = analyzed.reduce((sum, chunk) => sum + chunk.words, 0);
  const nonWordsTotal = collectNonWords
    ? analyzed.reduce((sum, chunk) => {
        if (!chunk.nonWords) {
          return sum;
        }
        return sum + getNonWordTotal(chunk.nonWords);
      }, 0)
    : 0;
  const total = analyzed.reduce((sum, chunk) => {
    let chunkTotal = chunk.words;
    if (collectNonWords && chunk.nonWords) {
      chunkTotal += getNonWordTotal(chunk.nonWords);
    }
    return sum + chunkTotal;
  }, 0);

  const counts = collectNonWords ? { words: wordsTotal, nonWords: nonWordsTotal, total } : undefined;

  if (mode === "segments") {
    const items: ChunkWithSegments[] = analyzed.map((chunk) => ({
      locale: chunk.locale,
      text: chunk.text,
      words: chunk.words,
      segments: chunk.segments,
      nonWords: chunk.nonWords,
    }));
    return {
      total,
      counts,
      breakdown: {
        mode,
        items,
      },
    };
  }

  if (mode === "collector") {
    const items = aggregateByLocale(analyzed);
    const nonWords = collectNonWordsAggregate(analyzed, collectNonWords);
    return {
      total,
      counts,
      breakdown: {
        mode,
        items,
        nonWords,
      },
    };
  }

  const items: ChunkBreakdown[] = analyzed.map((chunk) => ({
    locale: chunk.locale,
    text: chunk.text,
    words: chunk.words,
    nonWords: chunk.nonWords,
  }));

  return {
    total,
    counts,
    breakdown: {
      mode,
      items,
    },
  };
}

function getNonWordTotal(nonWords: NonWordCollection): number {
  return (
    nonWords.counts.emoji +
    nonWords.counts.symbols +
    nonWords.counts.punctuation +
    (nonWords.counts.whitespace ?? 0)
  );
}


function collectNonWordsAggregate(
  analyzed: Array<{ nonWords?: NonWordCollection }>,
  enabled: boolean,
): NonWordCollection | undefined {
  if (!enabled) {
    return undefined;
  }
  const collection = createNonWordCollection();
  for (const chunk of analyzed) {
    if (!chunk.nonWords) {
      continue;
    }
    mergeNonWordCollections(collection, chunk.nonWords);
  }
  return collection;
}
