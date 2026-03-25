import { segmentTextByLocale } from "../wc";
import { DEFAULT_LOCALE } from "../wc/locale-detect";
import type { LocaleChunk } from "../wc/types";
import { getDetectorFallbackTag } from "./whatlang-map";
import type { DetectorLocaleOptions } from "./types";
import type { DetectorWindow } from "./policy";

export function createDeferredLatinPreSegmentOptions(
  options: DetectorLocaleOptions,
): DetectorLocaleOptions {
  return {
    ...options,
    latinLanguageHint: undefined,
    latinTagHint: undefined,
    latinLocaleHint: undefined,
    latinHintRules: undefined,
    useDefaultLatinHints: false,
  };
}

function createRuleOnlyLatinOptions(options: DetectorLocaleOptions): DetectorLocaleOptions {
  return {
    ...options,
    latinLanguageHint: undefined,
    latinTagHint: undefined,
    latinLocaleHint: undefined,
  };
}

function mergeAdjacentChunks(chunks: LocaleChunk[]): LocaleChunk[] {
  if (chunks.length === 0) {
    return chunks;
  }

  const merged: LocaleChunk[] = [];
  let last = chunks[0]!;

  for (let index = 1; index < chunks.length; index += 1) {
    const chunk = chunks[index]!;
    if (chunk.locale === last.locale) {
      last = {
        locale: last.locale,
        text: last.text + chunk.text,
      };
      continue;
    }
    merged.push(last);
    last = chunk;
  }

  merged.push(last);
  return merged;
}

export function reapplyDeferredLatinFallback(
  chunks: LocaleChunk[],
  options: DetectorLocaleOptions,
): LocaleChunk[] {
  const relabeled: LocaleChunk[] = [];

  for (const chunk of chunks) {
    if (chunk.locale !== DEFAULT_LOCALE) {
      relabeled.push(chunk);
      continue;
    }

    relabeled.push(...segmentTextByLocale(chunk.text, options));
  }

  return mergeAdjacentChunks(relabeled);
}

export function reapplyResolvedLatinHintRules(
  resolvedChunks: LocaleChunk[],
  originalChunks: LocaleChunk[],
  options: DetectorLocaleOptions,
): LocaleChunk[] {
  const relabeled: LocaleChunk[] = [];
  const ruleOnlyOptions = createRuleOnlyLatinOptions(options);

  for (let index = 0; index < resolvedChunks.length; index += 1) {
    const chunk = resolvedChunks[index];
    const originalChunk = originalChunks[index];
    if (!chunk || !originalChunk) {
      continue;
    }

    if (originalChunk.locale !== DEFAULT_LOCALE || chunk.locale === DEFAULT_LOCALE) {
      relabeled.push(chunk);
      continue;
    }

    const hintedChunks = segmentTextByLocale(chunk.text, ruleOnlyOptions).map((hintedChunk) => ({
      locale: hintedChunk.locale === DEFAULT_LOCALE ? chunk.locale : hintedChunk.locale,
      text: hintedChunk.text,
    }));
    relabeled.push(...hintedChunks);
  }

  return mergeAdjacentChunks(relabeled);
}

export function resolveFallbackDebugOutcome(
  window: DetectorWindow,
  options: DetectorLocaleOptions,
): {
  finalTag: string;
  finalLocales?: string[];
} {
  const fallbackTag = getDetectorFallbackTag(window.routeTag);
  if (window.routeTag !== DEFAULT_LOCALE) {
    return { finalTag: fallbackTag };
  }

  const relabeled = reapplyDeferredLatinFallback(
    [
      {
        locale: fallbackTag,
        text: window.text,
      },
    ],
    options,
  );
  const finalLocales = relabeled.map((chunk) => chunk.locale);
  if (finalLocales.length === 1) {
    return {
      finalTag: finalLocales[0]!,
    };
  }

  return finalLocales.length > 1
    ? {
        finalTag: fallbackTag,
        finalLocales,
      }
    : {
        finalTag: fallbackTag,
      };
}
