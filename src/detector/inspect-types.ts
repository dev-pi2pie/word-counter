import type { DetectorResult, DetectorMode } from "./types";
import type {
  DetectorBorrowedContext,
  DetectorContentGateResult,
  DetectorDiagnosticTextSource,
} from "./policy";

export type DetectorInspectSchemaVersion = 1;
export type DetectorInspectKind = "detector-inspect";
export type DetectorInspectView = "engine" | "pipeline";
export type DetectorInspectInputSourceType = "inline" | "path";

export type DetectorInspectInput = {
  sourceType: DetectorInspectInputSourceType;
  path?: string;
  textLength: number;
  textPreview: string;
  textPreviewTruncated: boolean;
};

export type DetectorInspectSample = {
  text: string;
  textLength: number;
  normalizedText: string;
  normalizedApplied: boolean;
  textSource: DetectorDiagnosticTextSource;
  borrowedContext?: DetectorBorrowedContext;
};

export type DetectorInspectEngineRaw = {
  lang: string;
  script: string;
  confidence: number;
  reliable: boolean;
};

export type DetectorInspectEngineRemapped = {
  rawTag: string | null;
  normalizedTag: string | null;
};

export type DetectorInspectEngine = {
  name: "whatlang-wasm";
  raw: DetectorInspectEngineRaw;
  normalized?: DetectorInspectEngineRaw;
  remapped: DetectorInspectEngineRemapped;
};

export type DetectorInspectDecision =
  | {
      kind: "empty";
      notes: string[];
    }
  | {
      kind: "deterministic";
      notes: string[];
    }
  | {
      accepted: boolean;
      path: "reliable" | "corroborated" | null;
      finalTag: string;
      finalLocales?: string[];
      fallbackReason: string | null;
    };

export type DetectorInspectChunk = {
  index: number;
  locale: string;
  textPreview: string;
  textPreviewTruncated: boolean;
  source?: "script" | "hint" | "fallback" | DetectorResult["source"];
  reason?: string;
};

export type DetectorInspectWindow = {
  windowIndex: number;
  routeTag: string;
  chunkRange: {
    start: number;
    end: number;
  };
  focusTextPreview: string;
  focusTextPreviewTruncated: boolean;
  diagnosticSample: {
    textPreview: string;
    textPreviewTruncated: boolean;
    normalizedTextPreview: string;
    normalizedTextPreviewTruncated: boolean;
    normalizedApplied: boolean;
    borrowedContext?: DetectorBorrowedContext;
  };
  eligibility: {
    scriptChars: number;
    minScriptChars: number;
    passed: boolean;
  };
  contentGate: DetectorContentGateResult;
  engine: {
    executed: boolean;
    reason?: string;
  };
  decision: Exclude<DetectorInspectDecision, { kind: "empty" } | { kind: "deterministic" }>;
};

export type DetectorInspectBaseResult = {
  schemaVersion: DetectorInspectSchemaVersion;
  kind: DetectorInspectKind;
  view: DetectorInspectView;
  detector: DetectorMode;
  input: DetectorInspectInput;
};

export type DetectorInspectEngineResult = DetectorInspectBaseResult & {
  view: "engine";
  detector: "wasm";
  routeTag?: string;
  sample: DetectorInspectSample;
  engine?: DetectorInspectEngine;
  decision?: Extract<DetectorInspectDecision, { kind: "empty" }>;
};

export type DetectorInspectPipelineResult = DetectorInspectBaseResult & {
  view: "pipeline";
  chunks: DetectorInspectChunk[];
  resolvedChunks: DetectorInspectChunk[];
  windows?: DetectorInspectWindow[];
  decision?: DetectorInspectDecision;
};

export type DetectorInspectResult =
  | DetectorInspectEngineResult
  | DetectorInspectPipelineResult;
