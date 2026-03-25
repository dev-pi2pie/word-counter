import { inspectTextWithDetector } from "../../detector";
import { buildInspectStandardLines, printLines } from "./render";
import type { InspectSingleInput, ParsedInspectInvocation } from "./types";

export async function runSingleInspect(
  validated: ParsedInspectInvocation,
  input: InspectSingleInput,
): Promise<void> {
  const result = await inspectTextWithDetector(input.text, {
    detector: validated.detector,
    view: validated.view,
    input: {
      sourceType: input.sourceType,
      ...(input.path ? { path: input.path } : {}),
    },
  });

  if (validated.format === "json") {
    console.log(JSON.stringify(result, null, validated.pretty ? 2 : 0));
    process.exitCode = 0;
    return;
  }

  printLines(buildInspectStandardLines(result));
  process.exitCode = 0;
}
