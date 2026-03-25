import { inspectTextWithDetector } from "../../detector";
import type { BatchSkip } from "../types";
import { selectInspectText } from "./input";
import { buildInspectBatchStandardLines, printLines } from "./render";
import type {
  InspectBatchJsonPayload,
  InspectLoadedPathInput,
  ParsedInspectInvocation,
} from "./types";

export function buildInspectBatchJsonPayload(
  validated: ParsedInspectInvocation,
  files: Array<{ path: string; result: Awaited<ReturnType<typeof inspectTextWithDetector>> }>,
  skipped: BatchSkip[],
  failures: BatchSkip[],
): InspectBatchJsonPayload {
  return {
    schemaVersion: 1,
    kind: "detector-inspect-batch",
    detector: validated.detector,
    view: validated.view,
    section: validated.section,
    summary: {
      requestedInputs: validated.paths.length,
      succeeded: files.length,
      skipped: skipped.length,
      failed: failures.length,
    },
    files,
    skipped,
    failures,
  };
}

export async function runInspectBatch(
  validated: ParsedInspectInvocation,
  loaded: {
    files: InspectLoadedPathInput[];
    skipped: BatchSkip[];
    failures: BatchSkip[];
  },
): Promise<void> {
  const batchFiles: Array<{
    path: string;
    result: Awaited<ReturnType<typeof inspectTextWithDetector>>;
  }> = [];
  for (const file of loaded.files) {
    const result = await inspectTextWithDetector(selectInspectText(file.text, validated.section), {
      detector: validated.detector,
      view: validated.view,
      input: {
        sourceType: "path",
        path: file.path,
      },
    });
    batchFiles.push({
      path: file.path,
      result,
    });
  }

  const payload = buildInspectBatchJsonPayload(
    validated,
    batchFiles,
    loaded.skipped,
    loaded.failures,
  );
  if (validated.format === "json") {
    console.log(JSON.stringify(payload, null, validated.pretty ? 2 : 0));
  } else {
    printLines(buildInspectBatchStandardLines(payload));
  }

  process.exitCode = payload.failures.length > 0 || payload.files.length === 0 ? 1 : 0;
}
