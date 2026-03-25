import {
  DEFAULT_LOCALE,
  detectLocaleForCharTrace,
  isLatinLocale,
  resolveLocaleDetectContext,
  type LocaleDetectContext,
  type LocaleDetectOptions,
  type LocaleDetectTraceSource,
} from "../wc/locale-detect";
import type { LocaleChunk } from "../wc/types";
import { createDetectorEvidencePreview, DETECTOR_EVIDENCE_PREVIEW_LIMIT } from "./debug";
import type {
  DetectorInspectChunk,
  DetectorInspectInput,
  DetectorInspectInputOptions,
} from "./inspect-types";

const HARD_BOUNDARY_REGEX = /[\r\n,.!?;:，、。！？；：．｡､]/u;
const LATIN_PROMOTION_BREAK_REGEX = /[\s,.!?;:，、。！？；：．｡､]/u;

export type TracedLocaleChunk = LocaleChunk & {
  source: "script" | "hint" | "fallback";
  reason?: string;
};

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

function mergeAdjacentTracedChunks(chunks: TracedLocaleChunk[]): TracedLocaleChunk[] {
  if (chunks.length === 0) {
    return chunks;
  }

  const merged: TracedLocaleChunk[] = [];
  let last = chunks[0]!;

  for (let index = 1; index < chunks.length; index += 1) {
    const chunk = chunks[index]!;
    if (chunk.locale === last.locale) {
      last = {
        ...last,
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

export function segmentTextByLocaleWithTrace(
  text: string,
  options: LocaleDetectOptions = {},
): TracedLocaleChunk[] {
  const context: LocaleDetectContext = resolveLocaleDetectContext(options);
  const chunks: TracedLocaleChunk[] = [];
  let currentLocale = DEFAULT_LOCALE;
  let currentSource: LocaleDetectTraceSource = "fallback";
  let currentReason = "latin-fallback";
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

  const pushChunk = (locale: string, textValue: string, source: LocaleDetectTraceSource, reason?: string) => {
    if (textValue.length === 0) {
      return;
    }
    chunks.push({
      locale,
      text: textValue,
      source,
      ...(reason ? { reason } : {}),
    });
  };

  for (const char of text) {
    const trace = detectLocaleForCharTrace(
      char,
      currentLocale,
      options,
      context,
      !sawCarryBoundary,
      !sawCarryBoundary,
    );
    const detected = trace.locale;
    const targetLocale = detected ?? currentLocale;

    if (buffer === "") {
      currentLocale = targetLocale;
      currentSource = trace.source ?? "fallback";
      currentReason = trace.reason ?? currentReason;
      buffer = char;
      bufferHasScript = detected !== null;
      updateCarryBoundaryState(detected, char);
      continue;
    }

    if (detected !== null && !bufferHasScript) {
      currentLocale = targetLocale;
      currentSource = trace.source ?? currentSource;
      currentReason = trace.reason ?? currentReason;
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
          currentSource = trace.source ?? currentSource;
          currentReason = trace.reason ?? currentReason;
          buffer += char;
          bufferHasScript = true;
          updateCarryBoundaryState(detected, char);
          continue;
        }

        const prefix = buffer.slice(0, promotionBreakIndex + 1);
        const suffix = buffer.slice(promotionBreakIndex + 1);
        pushChunk(currentLocale, prefix, currentSource, currentReason);
        currentLocale = targetLocale;
        currentSource = trace.source ?? currentSource;
        currentReason = trace.reason ?? currentReason;
        buffer = `${suffix}${char}`;
        bufferHasScript = true;
        updateCarryBoundaryState(detected, char);
        continue;
      }

      pushChunk(currentLocale, buffer, currentSource, currentReason);
      currentLocale = targetLocale;
      currentSource = trace.source ?? "fallback";
      currentReason = trace.reason ?? currentReason;
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

  pushChunk(currentLocale, buffer, currentSource, currentReason);
  return mergeAdjacentTracedChunks(chunks);
}

export function createInspectInput(
  text: string,
  inputOptions: DetectorInspectInputOptions | undefined,
): DetectorInspectInput {
  const preview = createDetectorEvidencePreview(text);
  return {
    sourceType: inputOptions?.sourceType ?? "inline",
    ...(inputOptions?.path ? { path: inputOptions.path } : {}),
    textLength: text.length,
    textPreview: preview.preview,
    textPreviewTruncated: preview.truncated,
  };
}

export function createInspectChunk(
  index: number,
  chunk: LocaleChunk,
  extras?: Pick<DetectorInspectChunk, "source" | "reason">,
): DetectorInspectChunk {
  const preview = createDetectorEvidencePreview(chunk.text);
  return {
    index,
    locale: chunk.locale,
    textPreview: preview.preview,
    textPreviewTruncated: preview.truncated,
    ...(extras?.source ? { source: extras.source } : {}),
    ...(extras?.reason ? { reason: extras.reason } : {}),
  };
}

export function createInspectPreview(text: string): {
  textPreview: string;
  textPreviewTruncated: boolean;
} {
  const preview = createDetectorEvidencePreview(text);
  return {
    textPreview: preview.preview,
    textPreviewTruncated: preview.truncated,
  };
}

export { DETECTOR_EVIDENCE_PREVIEW_LIMIT as DETECTOR_INSPECT_PREVIEW_LIMIT };
