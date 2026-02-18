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

export interface CharCollectorBreakdown {
  locale: string;
  chars: number;
  nonWords?: NonWordCollection;
}

export type WordCounterMode = "chunk" | "segments" | "collector" | "char" | "char-collector";

export interface NonWordCounts {
  emoji: number;
  symbols: number;
  punctuation: number;
  whitespace?: number;
}

export interface WhitespaceCounts {
  spaces: number;
  tabs: number;
  newlines: number;
  other: number;
}

export interface NonWordCollection {
  emoji: string[];
  symbols: string[];
  punctuation: string[];
  whitespace?: WhitespaceCounts;
  counts: NonWordCounts;
}

export interface LatinHintRule {
  tag: string;
  pattern: string | RegExp;
  priority?: number;
}

export interface WordCounterOptions {
  mode?: WordCounterMode;
  latinLanguageHint?: string;
  latinTagHint?: string;
  latinLocaleHint?: string;
  latinHintRules?: LatinHintRule[];
  useDefaultLatinHints?: boolean;
  hanLanguageHint?: string;
  hanTagHint?: string;
  nonWords?: boolean;
  includeWhitespace?: boolean;
}

export interface WordCounterCounts {
  words: number;
  nonWords: number;
  total: number;
}

export type WordCounterBreakdown =
  | { mode: "chunk"; items: ChunkBreakdown[] }
  | { mode: "segments"; items: ChunkWithSegments[] }
  | { mode: "char"; items: CharBreakdown[] }
  | { mode: "char-collector"; items: CharCollectorBreakdown[] }
  | {
      mode: "collector";
      items: CollectorBreakdown[];
      nonWords?: NonWordCollection;
    };

export interface WordCounterResult {
  total: number;
  counts?: WordCounterCounts;
  breakdown: WordCounterBreakdown;
}
