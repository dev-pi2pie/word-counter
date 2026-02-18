import {
  DEFAULT_LOCALE,
  detectLocaleForChar,
  isLatinLocale,
  resolveLocaleDetectContext,
  type LocaleDetectOptions,
} from "./locale-detect";
import type { LocaleChunk } from "./types";

const HARD_BOUNDARY_REGEX = /[\r\n,.!?;:，、。！？；：．｡､]/u;
const LATIN_PROMOTION_BREAK_REGEX = /[\s,.!?;:，、。！？；：．｡､]/u;

export function segmentTextByLocale(
  text: string,
  options: LocaleDetectOptions = {}
): LocaleChunk[] {
  const context = resolveLocaleDetectContext(options);
  const chunks: LocaleChunk[] = [];
  // Keep currentLocale as a non-null string to simplify type-narrowing.
  let currentLocale: string = DEFAULT_LOCALE;
  let buffer = "";
  let bufferHasScript = false;
  let sawCarryBoundary = false;

  const updateCarryBoundaryState = (detected: string | null, char: string): void => {
    if (detected !== null) {
      sawCarryBoundary = false;
      return;
    }
    if (HARD_BOUNDARY_REGEX.test(char)) {
      sawCarryBoundary = true;
    }
  };

  for (const char of text) {
    const detected = detectLocaleForChar(
      char,
      currentLocale,
      options,
      context,
      !sawCarryBoundary,
      !sawCarryBoundary,
    );
    const targetLocale = detected ?? currentLocale;

    // If buffer is empty, this is the first character for a new chunk.
    if (buffer === "") {
      currentLocale = targetLocale;
      buffer = char;
      bufferHasScript = detected !== null;
      updateCarryBoundaryState(detected, char);
      continue;
    }

    if (detected !== null && !bufferHasScript) {
      currentLocale = targetLocale;
      buffer += char;
      bufferHasScript = true;
      updateCarryBoundaryState(detected, char);
      continue;
    }

    if (targetLocale !== currentLocale && detected !== null) {
      if (currentLocale === DEFAULT_LOCALE && isLatinLocale(targetLocale, context)) {
        const promotionBreakIndex = findLastLatinPromotionBreakIndex(buffer);
        if (promotionBreakIndex === -1) {
          currentLocale = targetLocale;
          buffer += char;
          bufferHasScript = true;
          updateCarryBoundaryState(detected, char);
          continue;
        }

        const prefix = buffer.slice(0, promotionBreakIndex + 1);
        const suffix = buffer.slice(promotionBreakIndex + 1);
        if (prefix.length > 0) {
          chunks.push({ locale: currentLocale, text: prefix });
        }
        currentLocale = targetLocale;
        buffer = `${suffix}${char}`;
        bufferHasScript = true;
        updateCarryBoundaryState(detected, char);
        continue;
      }
      // currentLocale is guaranteed to be a string here.
      chunks.push({ locale: currentLocale, text: buffer });
      currentLocale = targetLocale;
      buffer = char;
      bufferHasScript = true;
      updateCarryBoundaryState(detected, char);
      continue;
    }

    buffer += char;
    if (detected !== null) {
      bufferHasScript = true;
    }
    updateCarryBoundaryState(detected, char);
  }

  if (buffer.length > 0) {
    chunks.push({ locale: currentLocale, text: buffer });
  }

  return mergeAdjacentChunks(chunks);
}

function findLastLatinPromotionBreakIndex(buffer: string): number {
  for (let index = buffer.length - 1; index >= 0; index -= 1) {
    const char = buffer[index];
    if (!char) {
      continue;
    }
    if (LATIN_PROMOTION_BREAK_REGEX.test(char)) {
      return index;
    }
  }
  return -1;
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
