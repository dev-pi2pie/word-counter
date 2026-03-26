import type { SectionMode } from "../../markdown";
import type { DetectorInspectResult } from "../../detector";
import type { DetectorContentGateMode } from "../../detector";
import type { DetectorInspectView } from "../../detector/inspect-types";
import type { BatchResolvedFile, BatchSkip, PathMode } from "../types";

export type InspectOutputFormat = "standard" | "json";
export type InspectDetectorMode = "wasm" | "regex";
export type InspectSectionMode = Extract<SectionMode, "all" | "frontmatter" | "content">;

export type ExecuteInspectCommandOptions = {
  argv: string[];
  runtime?: {
    env?: NodeJS.ProcessEnv;
    cwd?: string;
  };
};

export type ParsedInspectInvocation = {
  ok: true;
  help?: false;
  detector: InspectDetectorMode;
  contentGateMode: DetectorContentGateMode;
  view: DetectorInspectView;
  format: InspectOutputFormat;
  pretty: boolean;
  section: InspectSectionMode;
  pathMode: PathMode;
  pathDetectBinary: boolean;
  recursive: boolean;
  includeExt: string[];
  excludeExt: string[];
  regex?: string;
  paths: string[];
  textTokens: string[];
  sources: {
    detector: boolean;
    contentGate: boolean;
    pathMode: boolean;
    recursive: boolean;
    includeExt: boolean;
    excludeExt: boolean;
  };
};

export type InspectHelpInvocation = {
  ok: true;
  help: true;
};

export type InspectErrorInvocation = {
  ok: false;
  message: string;
};

export type ValidInspectInvocation =
  | ParsedInspectInvocation
  | InspectHelpInvocation
  | InspectErrorInvocation;

export type InspectLoadedPathInput = {
  path: string;
  source: BatchResolvedFile["source"];
  text: string;
};

export type InspectSingleInput = {
  text: string;
  sourceType: "inline" | "path";
  path?: string;
};

export type InspectBatchJsonPayload = {
  schemaVersion: 1;
  kind: "detector-inspect-batch";
  detector: InspectDetectorMode;
  view: DetectorInspectView;
  section: InspectSectionMode;
  summary: {
    requestedInputs: number;
    succeeded: number;
    skipped: number;
    failed: number;
  };
  files: Array<{
    path: string;
    result: DetectorInspectResult;
  }>;
  skipped: BatchSkip[];
  failures: BatchSkip[];
};
