import type { SectionedResult } from "../markdown";
import type { WordCounterResult } from "../wc";

export type BatchScope = "merged" | "per-file";
export type PathMode = "auto" | "manual";

export type BatchSkip = {
  path: string;
  reason: string;
};

export type BatchFileInput = {
  path: string;
  content: string;
};

export type BatchFileResult = {
  path: string;
  result: WordCounterResult | SectionedResult;
};

export type BatchOptions = {
  scope: BatchScope;
  pathMode: PathMode;
  recursive: boolean;
  quietSkips: boolean;
};

export type BatchSummary = {
  files: BatchFileResult[];
  skipped: BatchSkip[];
  aggregate: WordCounterResult | SectionedResult;
};
