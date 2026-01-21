const segmenterCache = new Map<string, Intl.Segmenter>();
const graphemeSegmenterCache = new Map<string, Intl.Segmenter>();

export function getSegmenter(locale: string): Intl.Segmenter {
  const cached = segmenterCache.get(locale);
  if (cached) {
    return cached;
  }
  const segmenter = new Intl.Segmenter(locale, { granularity: "word" });
  segmenterCache.set(locale, segmenter);
  return segmenter;
}

export function getGraphemeSegmenter(locale: string): Intl.Segmenter {
  const cached = graphemeSegmenterCache.get(locale);
  if (cached) {
    return cached;
  }
  const segmenter = new Intl.Segmenter(locale, { granularity: "grapheme" });
  graphemeSegmenterCache.set(locale, segmenter);
  return segmenter;
}

function supportsSegmenter(): boolean {
  return typeof Intl !== "undefined" && typeof Intl.Segmenter === "function";
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

export function countCharsForLocale(text: string, locale: string): number {
  if (!supportsSegmenter()) {
    return Array.from(text).length;
  }
  const segmenter = getGraphemeSegmenter(locale);
  let count = 0;
  for (const _segment of segmenter.segment(text)) {
    count++;
  }
  return count;
}
