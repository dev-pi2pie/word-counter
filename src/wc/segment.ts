import { DEFAULT_LOCALE, detectLocaleForChar, isLatinLocale } from "./locale-detect";
import type { LocaleChunk } from "./types";

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
      if (currentLocale === DEFAULT_LOCALE && isLatinLocale(targetLocale)) {
        currentLocale = targetLocale;
        buffer += char;
        continue;
      }
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
