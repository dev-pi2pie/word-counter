export interface LocaleChunk {
  locale: string;
  text: string;
}

export interface ChunkAnalysis extends LocaleChunk {
  segments: string[];
  words: number;
  nonWords?: NonWordCollection;
}

export interface ChunkBreakdown extends LocaleChunk {
  words: number;
  nonWords?: NonWordCollection;
}

export interface ChunkWithSegments extends ChunkBreakdown {
  segments: string[];
}

export interface CollectorBreakdown {
  locale: string;
  words: number;
  segments: string[];
}

export interface CharBreakdown extends LocaleChunk {
  chars: number;
  nonWords?: NonWordCollection;
}

export type WordCounterMode = "chunk" | "segments" | "collector" | "char";

export interface NonWordCounts {
  emoji: number;
  symbols: number;
  punctuation: number;
}

export interface NonWordCollection {
  emoji: string[];
  symbols: string[];
  punctuation: string[];
  counts: NonWordCounts;
}

export interface WordCounterOptions {
  mode?: WordCounterMode;
  latinLocaleHint?: string;
  nonWords?: boolean;
}

export type WordCounterBreakdown =
  | { mode: "chunk"; items: ChunkBreakdown[] }
  | { mode: "segments"; items: ChunkWithSegments[] }
  | { mode: "char"; items: CharBreakdown[] }
  | {
      mode: "collector";
      items: CollectorBreakdown[];
      nonWords?: NonWordCollection;
    };

export interface WordCounterResult {
  total: number;
  breakdown: WordCounterBreakdown;
}
