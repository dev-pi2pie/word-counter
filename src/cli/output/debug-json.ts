import type { DetectorDebugSummary } from "../../detector/debug";
import type { BatchSkip } from "../types";

type DebugSection = {
  skipped?: BatchSkip[];
  detector?: DetectorDebugSummary;
};

export function buildDebugSection(
  input: DebugSection,
): DebugSection | undefined {
  const output: DebugSection = {};

  if (input.skipped && input.skipped.length > 0) {
    output.skipped = input.skipped;
  }

  if (input.detector) {
    output.detector = input.detector;
  }

  return Object.keys(output).length > 0 ? output : undefined;
}
