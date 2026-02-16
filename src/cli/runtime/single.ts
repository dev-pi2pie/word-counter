import type { SectionedResult } from "../../markdown";
import { countSections } from "../../markdown";
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
import type { CliActionOptions, ResolvedCountRunOptions } from "./types";

type ExecuteSingleCountOptions = {
  textTokens: string[];
  options: CliActionOptions;
  resolved: ResolvedCountRunOptions;
};

export async function executeSingleCount({
  textTokens,
  options,
  resolved,
}: ExecuteSingleCountOptions): Promise<void> {
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

  const result: WordCounterResult | SectionedResult = resolved.useSection
    ? countSections(trimmed, options.section, resolved.wcOptions)
    : wordCounter(trimmed, resolved.wcOptions);
  const totalOfOverride = resolveTotalOfOverride(result, resolved.totalOfParts);
  const displayResult = resolved.shouldNormalizeBaseOutput ? normalizeResultBase(result) : result;

  if (options.format === "raw") {
    console.log(totalOfOverride?.total ?? displayResult.total);
    return;
  }

  if (options.format === "json") {
    const spacing = options.pretty ? 2 : 0;
    if (!totalOfOverride) {
      console.log(JSON.stringify(displayResult, null, spacing));
      return;
    }
    console.log(
      JSON.stringify(
        {
          ...displayResult,
          meta: {
            totalOf: totalOfOverride.parts,
            totalOfOverride: totalOfOverride.total,
          },
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
