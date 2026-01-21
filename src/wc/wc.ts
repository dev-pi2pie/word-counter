import { analyzeCharChunk, analyzeChunk, aggregateByLocale } from "./analyze";
import { resolveMode } from "./mode";
import { segmentTextByLocale } from "./segment";
import { countCharsForLocale, countWordsForLocale } from "./segmenter";
import { createNonWordCollection, mergeNonWordCollections } from "./non-words";
import type {
  CharBreakdown,
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
  const chunks = segmentTextByLocale(text, { latinLocaleHint: options.latinLocaleHint });

  if (mode === "char") {
    const analyzed = chunks.map((chunk) => analyzeCharChunk(chunk, collectNonWords));
    const total = analyzed.reduce((sum, chunk) => sum + chunk.chars, 0);
    const items: CharBreakdown[] = analyzed.map((chunk) => ({
      locale: chunk.locale,
      text: chunk.text,
      chars: chunk.chars,
      nonWords: chunk.nonWords,
    }));
    return {
      total,
      breakdown: {
        mode,
        items,
      },
    };
  }

  const analyzed = chunks.map((chunk) => analyzeChunk(chunk, collectNonWords));
  const total = analyzed.reduce((sum, chunk) => {
    let chunkTotal = chunk.words;
    if (collectNonWords && chunk.nonWords) {
      chunkTotal +=
        chunk.nonWords.counts.emoji +
        chunk.nonWords.counts.symbols +
        chunk.nonWords.counts.punctuation;
    }
    return sum + chunkTotal;
  }, 0);

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
    breakdown: {
      mode,
      items,
    },
  };
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
