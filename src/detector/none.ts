import { countSections } from "../markdown";
import wordCounter, { segmentTextByLocale } from "../wc";
import { createInspectChunk, createInspectInput, segmentTextByLocaleWithTrace } from "./inspect-helpers";
import type { DetectorInspectOptions, DetectorInspectResult } from "./inspect-types";
import type {
  DetectorCountSectionsOptions,
  DetectorLocaleOptions,
  DetectorWordCounterOptions,
} from "./types";

export async function segmentTextByLocaleWithRegexDetector(
  text: string,
  options: DetectorLocaleOptions = {},
) {
  return segmentTextByLocale(text, options);
}

export async function wordCounterWithRegexDetector(
  text: string,
  options: DetectorWordCounterOptions = {},
) {
  return wordCounter(text, options);
}

export async function countSectionsWithRegexDetector(
  input: string,
  section: Parameters<typeof countSections>[1],
  options: DetectorCountSectionsOptions = {},
) {
  return countSections(input, section, options);
}

export async function inspectTextWithRegexDetector(
  text: string,
  options: DetectorInspectOptions = {},
): Promise<DetectorInspectResult> {
  if (text.trim().length === 0) {
    return {
      schemaVersion: 1,
      kind: "detector-inspect",
      view: "pipeline",
      detector: "regex",
      input: createInspectInput(text, options.input),
      chunks: [],
      decision: {
        kind: "empty",
        notes: ["No detector-eligible content was present."],
      },
      resolvedChunks: [],
    };
  }

  const chunks = segmentTextByLocaleWithTrace(text, options);

  return {
    schemaVersion: 1,
    kind: "detector-inspect",
    view: "pipeline",
    detector: "regex",
    input: createInspectInput(text, options.input),
    chunks: chunks.map((chunk, index) =>
      createInspectChunk(index, chunk, {
        source: chunk.source,
        reason: chunk.reason,
      }),
    ),
    decision: {
      kind: "deterministic",
      notes: [
        "Regex inspection does not use detector windows or engine confidence.",
        "Final locales come directly from script detection, hint rules, and fallback rules.",
      ],
    },
    resolvedChunks: chunks.map((chunk, index) => createInspectChunk(index, chunk)),
  };
}
