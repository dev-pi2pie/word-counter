import type { Command } from "commander";
import type { ConfigProgressMode } from "./types";
import type { CliActionOptions } from "../runtime/types";
import type { CountCliSources } from "./apply";

function isCliOptionSource(program: Command, optionName: string): boolean {
  return program.getOptionValueSource(optionName) === "cli";
}

export function deriveCountCliSources(program: Command): CountCliSources {
  return {
    detector: isCliOptionSource(program, "detector"),
    contentGate: isCliOptionSource(program, "contentGate"),
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

export function deriveInitialCountProgressMode(
  program: Command,
  rawProgressValue: boolean,
): ConfigProgressMode {
  if (!isCliOptionSource(program, "progress")) {
    return "auto";
  }

  return rawProgressValue ? "on" : "off";
}
