import { createInspectPreview } from "../../detector/inspect-helpers";
import type { DetectorInspectResult } from "../../detector/inspect-types";
import type { InspectBatchJsonPayload } from "./types";

export function buildInspectStandardLines(
  result: DetectorInspectResult,
  options: { includeTitle?: boolean } = {},
): string[] {
  const includeTitle = options.includeTitle !== false;
  const lines: string[] = [];

  if (includeTitle) {
    lines.push("Detector inspect");
    lines.push(`View: ${result.view}`);
    lines.push(`Detector: ${result.detector}`);
    lines.push("");
  }

  lines.push("Input");
  lines.push(`Source: ${result.input.sourceType}`);
  if (result.input.path) {
    lines.push(`Path: ${result.input.path}`);
  }
  lines.push(`Text length: ${result.input.textLength}`);

  if (result.view === "engine") {
    const samplePreview = createInspectPreview(result.sample.text);
    const normalizedPreview = createInspectPreview(result.sample.normalizedText);

    lines.push("");
    lines.push("Sample");
    lines.push(`Text source: ${result.sample.textSource}`);
    lines.push(`Sample text preview: ${JSON.stringify(samplePreview.textPreview)}`);
    lines.push(`Sample text truncated: ${samplePreview.textPreviewTruncated}`);
    lines.push(`Normalized text preview: ${JSON.stringify(normalizedPreview.textPreview)}`);
    lines.push(`Normalized text truncated: ${normalizedPreview.textPreviewTruncated}`);
    if (result.sample.borrowedContext) {
      lines.push(`Borrowed context: ${JSON.stringify(result.sample.borrowedContext)}`);
    }
    if (result.routeTag) {
      lines.push(`Route tag: ${result.routeTag}`);
    }
    if (result.engine) {
      lines.push("");
      lines.push("Engine");
      lines.push(
        `Raw: ${result.engine.raw.lang}/${result.engine.raw.script} confidence=${result.engine.raw.confidence} reliable=${result.engine.raw.reliable}`,
      );
      if (result.engine.normalized) {
        lines.push(
          `Normalized: ${result.engine.normalized.lang}/${result.engine.normalized.script} confidence=${result.engine.normalized.confidence} reliable=${result.engine.normalized.reliable}`,
        );
      }
      lines.push(
        `Remap: raw=${result.engine.remapped.rawTag ?? "null"} normalized=${result.engine.remapped.normalizedTag ?? "null"}`,
      );
    } else if (result.decision?.kind === "empty") {
      lines.push("");
      lines.push(`Decision: ${result.decision.notes.join(" ")}`);
    }
    return lines;
  }

  lines.push("");
  lines.push("Chunks");
  if (result.chunks.length === 0) {
    lines.push("(none)");
  } else {
    for (const chunk of result.chunks) {
      const source = chunk.source ? ` | ${chunk.source}` : "";
      const reason = chunk.reason ? ` | ${chunk.reason}` : "";
      lines.push(`[${chunk.index}] ${chunk.locale}${source}${reason} | ${JSON.stringify(chunk.textPreview)}`);
    }
  }

  if (result.windows) {
    for (const window of result.windows) {
      lines.push("");
      lines.push(`Window ${window.windowIndex}`);
      lines.push(`Route: ${window.routeTag}`);
      lines.push(`Chunk range: ${window.chunkRange.start}-${window.chunkRange.end}`);
      lines.push(`Focus: ${JSON.stringify(window.focusTextPreview)}`);
      if (window.diagnosticSample.borrowedContext) {
        lines.push(`Borrowed context: ${JSON.stringify(window.diagnosticSample.borrowedContext)}`);
      }
      lines.push(`Sample: ${JSON.stringify(window.diagnosticSample.textPreview)}`);
      lines.push(`Normalized sample: ${JSON.stringify(window.diagnosticSample.normalizedTextPreview)}`);
      lines.push(
        `Eligibility: ${window.eligibility.scriptChars}/${window.eligibility.minScriptChars} passed=${window.eligibility.passed}`,
      );
      lines.push(
        `Content gate: ${window.contentGate.policy} applied=${window.contentGate.applied} passed=${window.contentGate.passed}`,
      );
      lines.push(
        `Engine: ${window.engine.executed ? "executed" : `skipped (${window.engine.reason ?? "unknown"})`}`,
      );
      lines.push(
        `Decision: accepted=${window.decision.accepted} path=${window.decision.path ?? "null"} final=${window.decision.finalTag} fallback=${window.decision.fallbackReason ?? "null"}`,
      );
    }
  }

  if (result.decision && "kind" in result.decision) {
    lines.push("");
    lines.push(`Decision: ${result.decision.kind}`);
    lines.push(result.decision.notes.join(" "));
  }

  lines.push("");
  lines.push("Resolved");
  if (result.resolvedChunks.length === 0) {
    lines.push("(none)");
    return lines;
  }
  for (const chunk of result.resolvedChunks) {
    lines.push(`[${chunk.index}] ${chunk.locale} | ${JSON.stringify(chunk.textPreview)}`);
  }

  return lines;
}

export function buildInspectBatchStandardLines(payload: InspectBatchJsonPayload): string[] {
  const lines: string[] = [
    "Detector inspect batch",
    `View: ${payload.view}`,
    `Detector: ${payload.detector}`,
    `Section: ${payload.section}`,
    `Requested inputs: ${payload.summary.requestedInputs}`,
    `Summary: ${payload.summary.succeeded} succeeded, ${payload.summary.skipped} skipped, ${payload.summary.failed} failed`,
  ];

  for (const file of payload.files) {
    lines.push("");
    lines.push(`File: ${file.path}`);
    lines.push(...buildInspectStandardLines(file.result, { includeTitle: false }));
  }

  if (payload.skipped.length > 0) {
    lines.push("");
    lines.push("Skipped");
    for (const item of payload.skipped) {
      lines.push(`${item.path} | ${item.reason}`);
    }
  }

  if (payload.failures.length > 0) {
    lines.push("");
    lines.push("Failures");
    for (const item of payload.failures) {
      lines.push(`${item.path} | ${item.reason}`);
    }
  }

  return lines;
}

export function printLines(lines: string[]): void {
  for (const line of lines) {
    console.log(line);
  }
}
