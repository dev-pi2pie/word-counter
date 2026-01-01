const DEFAULT_LOCALE = "en-US";

interface LocaleChunk {
  locale: string;
  text: string;
}

const regex = {
  hiragana: /\p{Script=Hiragana}/u,
  katakana: /\p{Script=Katakana}/u,
  hangul: /\p{Script=Hangul}/u,
  han: /\p{Script=Han}/u,
  latin: /\p{Script=Latin}/u,
  arabic: /\p{Script=Arabic}/u,
  cyrillic: /\p{Script=Cyrillic}/u,
  devanagari: /\p{Script=Devanagari}/u,
  thai: /\p{Script=Thai}/u,
};

function detectLocaleForChar(
  char: string,
  previousLocale?: string | null
): string | null {
  if (regex.hiragana.test(char) || regex.katakana.test(char)) {
    return "ja-JP";
  }
  if (regex.hangul.test(char)) {
    return "ko-KR";
  }
  if (regex.arabic.test(char)) {
    return "ar";
  }
  if (regex.cyrillic.test(char)) {
    return "ru";
  }
  if (regex.devanagari.test(char)) {
    return "hi";
  }
  if (regex.thai.test(char)) {
    return "th-TH";
  }

  if (regex.han.test(char)) {
    if (previousLocale && previousLocale.startsWith("ja")) {
      return previousLocale;
    }
    return "zh-Hans";
  }

  if (regex.latin.test(char)) {
    return DEFAULT_LOCALE;
  }

  return null;
}

export function segmentTextByLocale(text: string): LocaleChunk[] {
  const chunks: LocaleChunk[] = [];
  // Keep currentLocale as a non-null string to simplify type-narrowing.
  let currentLocale: string = DEFAULT_LOCALE;
  let buffer = "";

  for (const char of text) {
    const detected = detectLocaleForChar(char, currentLocale);
    const targetLocale = detected ?? currentLocale;

    // If buffer is empty, this is the first character for a new chunk.
    if (buffer === "") {
      currentLocale = targetLocale;
      buffer = char;
      continue;
    }

    if (targetLocale !== currentLocale && detected !== null) {
      // currentLocale is guaranteed to be a string here.
      chunks.push({ locale: currentLocale, text: buffer });
      currentLocale = targetLocale;
      buffer = char;
      continue;
    }

    buffer += char;
  }

  if (buffer.length > 0) {
    chunks.push({ locale: currentLocale, text: buffer });
  }

  return mergeAdjacentChunks(chunks);
}

function mergeAdjacentChunks(chunks: LocaleChunk[]): LocaleChunk[] {
  if (chunks.length === 0) {
    return chunks;
  }

  const merged: LocaleChunk[] = [];
  // We already returned for empty arrays above, so the first element is present.
  let last = chunks[0]!;

  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]!;
    if (chunk.locale === last.locale) {
      last = { locale: last.locale, text: last.text + chunk.text };
    } else {
      merged.push(last);
      last = chunk;
    }
  }

  merged.push(last);
  return merged;
}

const segmenterCache = new Map<string, Intl.Segmenter>();

function getSegmenter(locale: string): Intl.Segmenter {
  const cached = segmenterCache.get(locale);
  if (cached) {
    return cached;
  }
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  segmenterCache.set(locale, segmenter);
  return segmenter;
}

export function countWordsForLocale(text: string, locale: string): number {
  const segmenter = getSegmenter(locale);
  let count = 0;
  for (const segment of segmenter.segment(text)) {
    if (segment.isWordLike) {
      count++;
    }
  }
  return count;
}

interface ChunkAnalysis extends LocaleChunk {
  segments: string[];
  words: number;
}

interface ChunkBreakdown extends LocaleChunk {
  words: number;
}

interface ChunkWithSegments extends ChunkBreakdown {
  segments: string[];
}

interface CollectorBreakdown {
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

function analyzeChunk(chunk: LocaleChunk): ChunkAnalysis {
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

function aggregateByLocale(chunks: ChunkAnalysis[]): CollectorBreakdown[] {
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

export function autoDetectedLocale(text: string): string {
  const chunks = segmentTextByLocale(text);
  return chunks.length > 0 ? chunks[0]!.locale : DEFAULT_LOCALE;
}

export function autoDetectedLocales(text: string): string[] {
  const seen = new Set<string>();
  for (const chunk of segmentTextByLocale(text)) {
    seen.add(chunk.locale);
  }
  return Array.from(seen);
}
