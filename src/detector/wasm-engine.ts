import type {
  DetectorDiagnosticSample,
  DetectorRouteTag,
} from "./policy";
import { remapWhatlangResult } from "./whatlang-map";
import { detectWithWhatlangWasm } from "./whatlang-wasm";
import type { DetectorResult } from "./types";

export type ExecutedEngineSample = {
  rawResult: Awaited<ReturnType<typeof detectWithWhatlangWasm>> | null;
  rawRemapped: DetectorResult | null;
  normalizedResult: Awaited<ReturnType<typeof detectWithWhatlangWasm>> | null;
  normalizedRemapped: DetectorResult | null;
};

export function buildEvidenceSample(
  result: Awaited<ReturnType<typeof detectWithWhatlangWasm>> | null,
  remappedTag: string | null,
) {
  return {
    lang: result?.lang ?? null,
    script: result?.script ?? null,
    confidence: result?.confidence ?? null,
    reliable: result?.reliable ?? null,
    remappedTag,
  };
}

export async function executeEngineSample(
  sample: DetectorDiagnosticSample,
  routeTag: DetectorRouteTag,
): Promise<ExecutedEngineSample> {
  const rawResult = await detectWithWhatlangWasm(sample.text, routeTag);
  const rawRemapped = rawResult ? remapWhatlangResult(rawResult, routeTag) : null;
  const normalizedResult =
    sample.normalizedApplied && sample.normalizedText.length > 0
      ? await detectWithWhatlangWasm(sample.normalizedText, routeTag)
      : null;
  const normalizedRemapped = normalizedResult
    ? remapWhatlangResult(normalizedResult, routeTag)
    : null;

  return {
    rawResult,
    rawRemapped,
    normalizedResult,
    normalizedRemapped,
  };
}
