import type { SectionMode, SectionedResult } from "../../markdown";
import type { ProgressOutputStream } from "../progress/reporter";
import type { TotalOfPart } from "../total-of";
import type { PathMode } from "../types";
import type { WordCounterMode, WordCounterOptions, WordCounterResult } from "../../wc";

export type OutputFormat = "standard" | "raw" | "json";

export type CliActionOptions = {
  mode: WordCounterMode;
  format: OutputFormat;
  pretty: boolean;
  section: SectionMode;
  latinLanguage?: string;
  latinTag?: string;
  latinLocale?: string;
  hanLanguage?: string;
  hanTag?: string;
  nonWords?: boolean;
  includeWhitespace?: boolean;
  misc?: boolean;
  totalOf?: TotalOfPart[];
  path?: string[];
  pathMode: PathMode;
  recursive: boolean;
  progress: boolean;
  keepProgress?: boolean;
  quietSkips?: boolean;
  debug?: boolean;
  verbose?: boolean;
  debugReport?: string | boolean;
  debugReportTee?: boolean;
  debugTee?: boolean;
  includeExt?: string[];
  excludeExt?: string[];
};

export type RunCliOptions = {
  stderr?: ProgressOutputStream;
};

export type ResolvedCountRunOptions = {
  useSection: boolean;
  totalOfParts: TotalOfPart[] | undefined;
  requestedNonWords: boolean;
  shouldNormalizeBaseOutput: boolean;
  wcOptions: WordCounterOptions;
};

export type CountResult = WordCounterResult | SectionedResult;
