import type { SectionedResult, SectionMode } from "../markdown";
import type { LocaleDetectOptions } from "../wc/locale-detect";
import type { WordCounterOptions, WordCounterResult } from "../wc/types";
import type { DetectorDebugContext } from "./debug";

export type DetectorMode = "regex" | "wasm";

export type DetectorSource = "script" | "hint" | "wasm";

export interface DetectorResult {
  tag: string;
  confidence?: number;
  reliable?: boolean;
  source: DetectorSource;
}

export interface DetectorRuntimeOptions {
  detector?: DetectorMode;
  detectorDebug?: DetectorDebugContext;
}

export interface DetectorLocaleOptions extends LocaleDetectOptions, DetectorRuntimeOptions {}

export interface DetectorWordCounterOptions extends WordCounterOptions, DetectorRuntimeOptions {}

export type DetectorCountSectionsOptions = DetectorWordCounterOptions;

export type DetectorCountResult = WordCounterResult | SectionedResult;

export type DetectorCountSections = (
  input: string,
  section: SectionMode,
  options?: DetectorCountSectionsOptions,
) => Promise<SectionedResult>;
