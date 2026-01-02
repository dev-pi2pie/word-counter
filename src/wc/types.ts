export interface LocaleChunk {
  locale: string;
  text: string;
}

export interface ChunkAnalysis extends LocaleChunk {
  segments: string[];
  words: number;
}

export interface ChunkBreakdown extends LocaleChunk {
  words: number;
}

export interface ChunkWithSegments extends ChunkBreakdown {
  segments: string[];
}

export interface CollectorBreakdown {
  locale: string;
  words: number;
  segments: string[];
}

export type WordCounterMode = "chunk" | "segments" | "collector";

export interface WordCounterOptions {
  mode?: WordCounterMode;
}

export type WordCounterBreakdown =
  | { mode: "chunk"; items: ChunkBreakdown[] }
  | { mode: "segments"; items: ChunkWithSegments[] }
  | { mode: "collector"; items: CollectorBreakdown[] };

export interface WordCounterResult {
  total: number;
  breakdown: WordCounterBreakdown;
}
