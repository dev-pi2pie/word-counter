import { inspectTextWithRegexDetector } from "./none";
import type { DetectorInspectOptions, DetectorInspectResult } from "./inspect-types";
import type { DetectorMode } from "./types";
import { inspectTextWithWasmDetector } from "./wasm";

function resolveInspectDetectorMode(
  mode: DetectorMode | undefined,
  view: DetectorInspectOptions["view"],
): DetectorMode {
  if (mode) {
    return mode;
  }

  return view === "engine" ? "wasm" : "regex";
}

export async function inspectTextWithDetector(
  text: string,
  options: DetectorInspectOptions = {},
): Promise<DetectorInspectResult> {
  const view = options.view ?? "pipeline";
  const detector = resolveInspectDetectorMode(options.detector, view);

  if (detector === "regex" && view === "engine") {
    throw new Error("`view: \"engine\"` requires `detector: \"wasm\"`.");
  }

  if (detector === "regex") {
    return inspectTextWithRegexDetector(text, {
      ...options,
      detector,
      view: "pipeline",
    });
  }

  return inspectTextWithWasmDetector(text, {
    ...options,
    detector,
    view,
  });
}
