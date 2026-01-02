import { analyzeChunk, aggregateByLocale } from "./analyze";
import { segmentTextByLocale } from "./segment";
import { countWordsForLocale } from "./segmenter";
import type {
  ChunkBreakdown,
  ChunkWithSegments,
  WordCounterMode,
  WordCounterOptions,
  WordCounterResult,
} from "./types";

export type {
  WordCounterMode,
  WordCounterOptions,
  WordCounterResult,
  WordCounterBreakdown,
} from "./types";

export { countWordsForLocale, segmentTextByLocale };

export function wordCounter(
  text: string,
  options: WordCounterOptions = {}
): WordCounterResult {
  const mode: WordCounterMode = options.mode ?? "chunk";
  const chunks = segmentTextByLocale(text);
  const analyzed = chunks.map(analyzeChunk);
  const total = analyzed.reduce((sum, chunk) => sum + chunk.words, 0);

  if (mode === "segments") {
    const items: ChunkWithSegments[] = analyzed.map((chunk) => ({
      locale: chunk.locale,
      text: chunk.text,
      words: chunk.words,
      segments: chunk.segments,
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
    return {
      total,
      breakdown: {
        mode,
        items,
      },
    };
  }

  const items: ChunkBreakdown[] = analyzed.map((chunk) => ({
    locale: chunk.locale,
    text: chunk.text,
    words: chunk.words,
  }));

  return {
    total,
    breakdown: {
      mode,
      items,
    },
  };
}
