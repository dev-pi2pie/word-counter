const segmenterCache = new Map<string, Intl.Segmenter>();

export function getSegmenter(locale: string): Intl.Segmenter {
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
