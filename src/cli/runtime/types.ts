import type { SectionMode, SectionedResult } from "../../markdown";
import type { ProgressOutputStream } from "../progress/reporter";
import type { TotalOfPart } from "../total-of";
import type { PathMode } from "../types";
import type { DoctorRuntimeOverrides } from "../doctor/types";
import type { ConfigProgressMode } from "../config/types";
import type {
  DetectorContentGateMode,
  DetectorMode,
  DetectorWordCounterOptions,
} from "../../detector";
import type { WordCounterMode, WordCounterResult } from "../../wc";

export type OutputFormat = "standard" | "raw" | "json";

export type CliActionOptions = {
  mode: WordCounterMode;
  format: OutputFormat;
  pretty: boolean;
  section: SectionMode;
  detector: DetectorMode;
  contentGate?: DetectorContentGateMode;
  latinLanguage?: string;
  latinTag?: string;
  latinLocale?: string;
  latinHint?: string[];
  latinHintsFile?: string;
  defaultLatinHints: boolean;
  hanLanguage?: string;
  hanTag?: string;
  nonWords?: boolean;
  includeWhitespace?: boolean;
  misc?: boolean;
  totalOf?: TotalOfPart[];
  path?: string[];
  jobs: number;
  printJobsLimit?: boolean;
  pathMode: PathMode;
  pathDetectBinary: boolean;
  recursive: boolean;
  progress: boolean;
  progressMode: ConfigProgressMode;
  keepProgress?: boolean;
  quietWarnings?: boolean;
  quietSkips?: boolean;
  debug?: boolean;
  verbose?: boolean;
  detectorEvidence?: boolean;
  debugReport?: string | boolean;
  debugReportTee?: boolean;
  debugTee?: boolean;
  includeExt?: string[];
  excludeExt?: string[];
  regex?: string;
};

export type RunCliOptions = {
  stderr?: ProgressOutputStream;
  doctor?: DoctorRuntimeOverrides;
  env?: NodeJS.ProcessEnv;
  cwd?: string;
};

export type ResolvedCountRunOptions = {
  useSection: boolean;
  detectorMode: DetectorMode;
  totalOfParts: TotalOfPart[] | undefined;
  requestedNonWords: boolean;
  shouldNormalizeBaseOutput: boolean;
  wcOptions: DetectorWordCounterOptions;
};

export type CountResult = WordCounterResult | SectionedResult;
