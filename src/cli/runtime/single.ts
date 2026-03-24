import type { SectionedResult } from "../../markdown";
import { buildDebugSection } from "../output/debug-json";
import { countSections } from "../../markdown";
import {
  countSectionsWithDetector,
  wordCounterWithDetector,
} from "../../detector";
import { createDetectorDebugSummary } from "../../detector/debug";
import {
  getTotalLabels,
  isSectionedResult,
  renderStandardResult,
  renderStandardSectionedResult,
} from "../output/render";
import { normalizeResultBase } from "../output/normalize-base";
import { resolveTotalOfOverride } from "../total-of";
import wordCounter, { type WordCounterResult } from "../../wc";
import { resolveInput } from "./input";
import { formatInputReadError } from "./options";
import type { DebugChannel } from "../debug/channel";
import type { CliActionOptions, ResolvedCountRunOptions } from "./types";

type ExecuteSingleCountOptions = {
  textTokens: string[];
  options: CliActionOptions;
  resolved: ResolvedCountRunOptions;
  debug: DebugChannel;
};

export async function executeSingleCount({
  textTokens,
  options,
  resolved,
  debug,
}: ExecuteSingleCountOptions): Promise<void> {
  debug.emit("runtime.single.start", {
    detectorMode: resolved.detectorMode,
    format: options.format,
    section: options.section,
  });

  let input: string;
  try {
    input = await resolveInput(textTokens);
  } catch (error) {
    throw new Error(formatInputReadError(error));
  }

  const trimmed = input.trim();
  if (!trimmed) {
    throw new Error("No input provided. Pass text, pipe stdin, or use --path.");
  }

  const detectorDebugSummary =
    resolved.detectorMode === "wasm" ? createDetectorDebugSummary(resolved.detectorMode) : undefined;
  const detectorDebug =
    detectorDebugSummary && debug.enabled
      ? {
          emit: debug.emit,
          summary: detectorDebugSummary,
        }
      : undefined;

  const result: WordCounterResult | SectionedResult = resolved.useSection
    ? resolved.detectorMode === "regex"
      ? countSections(trimmed, options.section, resolved.wcOptions)
      : await countSectionsWithDetector(trimmed, options.section, {
          ...resolved.wcOptions,
          detector: resolved.detectorMode,
          detectorDebug,
        })
    : resolved.detectorMode === "regex"
      ? wordCounter(trimmed, resolved.wcOptions)
      : await wordCounterWithDetector(trimmed, {
          ...resolved.wcOptions,
          detector: resolved.detectorMode,
          detectorDebug,
        });
  const totalOfOverride = resolveTotalOfOverride(result, resolved.totalOfParts);
  const displayResult = resolved.shouldNormalizeBaseOutput ? normalizeResultBase(result) : result;

  debug.emit("runtime.single.complete", {
    detectorMode: resolved.detectorMode,
    sectioned: resolved.useSection,
    total: displayResult.total,
  });

  if (options.format === "raw") {
    console.log(totalOfOverride?.total ?? displayResult.total);
    return;
  }

  if (options.format === "json") {
    const spacing = options.pretty ? 2 : 0;
    const debugSection =
      options.debug && detectorDebugSummary && detectorDebugSummary.windowsTotal > 0
        ? buildDebugSection({ detector: detectorDebugSummary })
        : undefined;
    if (!totalOfOverride && !debugSection) {
      console.log(JSON.stringify(displayResult, null, spacing));
      return;
    }
    console.log(
      JSON.stringify(
        {
          ...displayResult,
          ...(totalOfOverride
            ? {
                meta: {
                  totalOf: totalOfOverride.parts,
                  totalOfOverride: totalOfOverride.total,
                },
              }
            : {}),
          ...(debugSection ? { debug: debugSection } : {}),
        },
        null,
        spacing,
      ),
    );
    return;
  }

  const labels = getTotalLabels(options.mode, resolved.requestedNonWords);
  if (isSectionedResult(displayResult)) {
    renderStandardSectionedResult(displayResult, labels, totalOfOverride);
    return;
  }

  renderStandardResult(displayResult, labels.overall, totalOfOverride);
}
