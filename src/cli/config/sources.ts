import type { Command } from "commander";
import type { CliActionOptions } from "../runtime/types";
import type { CountCliSources } from "./apply";

function isCliOptionSource(program: Command, optionName: string): boolean {
  return program.getOptionValueSource(optionName) === "cli";
}

export function deriveCountCliSources(
  program: Command,
  rawOptions: CliActionOptions,
): CountCliSources {
  void rawOptions;
  return {
    detector: isCliOptionSource(program, "detector"),
    pathMode: isCliOptionSource(program, "pathMode"),
    recursive: isCliOptionSource(program, "recursive"),
    includeExt: isCliOptionSource(program, "includeExt"),
    excludeExt: isCliOptionSource(program, "excludeExt"),
    totalOf: isCliOptionSource(program, "totalOf"),
    debug: isCliOptionSource(program, "debug"),
    verbose: isCliOptionSource(program, "verbose"),
    debugReport: isCliOptionSource(program, "debugReport"),
    debugReportTee:
      isCliOptionSource(program, "debugReportTee") || isCliOptionSource(program, "debugTee"),
    progress: isCliOptionSource(program, "progress"),
    quietSkips: isCliOptionSource(program, "quietSkips"),
  };
}
