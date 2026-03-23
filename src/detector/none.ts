import { countSections } from "../markdown";
import wordCounter, { segmentTextByLocale } from "../wc";
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
