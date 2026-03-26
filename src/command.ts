import { Command } from "commander";
import {
  applyConfigToCountOptions,
  deriveCountCliSources,
  deriveInitialCountProgressMode,
  resolveWordCounterConfig,
} from "./cli/config";
import { createDebugChannel } from "./cli/debug/channel";
import { executeDoctorCommand, isExplicitDoctorInvocation } from "./cli/doctor/run";
import { executeInspectCommand, isExplicitInspectInvocation } from "./cli/inspect/run";
import { configureProgramOptions } from "./cli/program/options";
import { getFormattedVersionLabel } from "./cli/program/version";
import { resolveBatchJobsLimit } from "./cli/batch/jobs/limits";
import { executeBatchCount } from "./cli/runtime/batch";
import { WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE } from "./detector";
import {
  hasPathInput,
  resolveCountRunOptions,
  resolveDebugReportPathOption,
  validateStandalonePrintJobsLimitUsage,
  validateSingleRegexOptionUsage,
} from "./cli/runtime/options";
import { executeSingleCount } from "./cli/runtime/single";
import type { CliActionOptions, RunCliOptions } from "./cli/runtime/types";
import type { WordCounterMode } from "./wc";
import { normalizeMode } from "./wc/mode";
import pc from "picocolors";

function emitConfigNotes(notes: string[]): void {
  for (const note of notes) {
    const warningLine = note.startsWith("Warning:") ? note : `Warning: ${note}`;
    console.error(pc.yellow(warningLine));
  }
}

export async function runCli(
  argv: string[] = process.argv,
  runtime: RunCliOptions = {},
): Promise<void> {
  if (isExplicitDoctorInvocation(argv)) {
    await executeDoctorCommand({
      argv,
      runtime: runtime.doctor,
    });
    return;
  }

  if (isExplicitInspectInvocation(argv)) {
    await executeInspectCommand({ argv, runtime });
    return;
  }

  const program = new Command();
  const parseMode = (value: string): WordCounterMode => {
    const normalized = normalizeMode(value);
    if (!normalized) {
      throw new Error(`Invalid mode: ${value}`);
    }
    return normalized;
  };

  program
    .name("word-counter")
    .description("Locale-aware word counting powered by Intl.Segmenter.")
    .version(getFormattedVersionLabel(), "-v, --version", "output the version number")
    .addHelpText(
      "after",
      "\nCommands:\n  inspect [options] [text...]  inspect detector behavior without count output\n  doctor [options]             report runtime diagnostics for this host",
    );

  configureProgramOptions(program, parseMode);

  program.action(
    async (textTokens: string[], rawOptions: CliActionOptions & { progress: boolean }) => {
      if (rawOptions.printJobsLimit) {
        try {
          validateStandalonePrintJobsLimitUsage(argv);
        } catch (error) {
          const message = error instanceof Error ? error.message : String(error);
          program.error(pc.red(message));
          return;
        }

        console.log(JSON.stringify(resolveBatchJobsLimit()));
        return;
      }

      let options: CliActionOptions = {
        ...rawOptions,
        pathDetectBinary: rawOptions.pathDetectBinary ?? true,
        progressMode: deriveInitialCountProgressMode(program, rawOptions.progress),
      };

      try {
        const resolvedConfig = await resolveWordCounterConfig({
          env: runtime.env,
          cwd: runtime.cwd,
        });
        options = applyConfigToCountOptions(
          options,
          resolvedConfig.config,
          deriveCountCliSources(program),
        );
        if (!options.quietWarnings) {
          emitConfigNotes(resolvedConfig.notes);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        program.error(pc.red(message));
        return;
      }

      const debugEnabled = Boolean(options.debug);
      const debugReportPath = resolveDebugReportPathOption(options.debugReport);
      const debugReportEnabled = options.debugReport !== undefined && options.debugReport !== false;

      if (options.verbose && !debugEnabled) {
        program.error(pc.red("`--verbose` requires `--debug`."));
        return;
      }

      if (options.detectorEvidence && !debugEnabled) {
        program.error(pc.red("`--detector-evidence` requires `--debug`."));
        return;
      }

      if (options.detectorEvidence && options.detector !== "wasm") {
        program.error(pc.red("`--detector-evidence` requires `--detector wasm`."));
        return;
      }

      if (debugReportEnabled && !debugEnabled) {
        program.error(pc.red("`--debug-report` requires `--debug`."));
        return;
      }

      const teeEnabled = Boolean(options.debugReportTee || options.debugTee);

      if (teeEnabled && !debugReportEnabled) {
        program.error(
          pc.red("`--debug-report-tee` (alias: `--debug-tee`) requires `--debug-report`."),
        );
        return;
      }

      try {
        validateSingleRegexOptionUsage(argv);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        program.error(pc.red(message));
        return;
      }

      let debug;
      try {
        debug = createDebugChannel({
          enabled: debugEnabled,
          verbosity: options.verbose ? "verbose" : "compact",
          report: debugReportEnabled
            ? {
                path: debugReportPath,
                tee: teeEnabled,
                autogeneratedNamePrefix: options.detectorEvidence
                  ? "wc-detector-evidence"
                  : "wc-debug",
              }
            : undefined,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        program.error(pc.red(`Failed to initialize debug diagnostics: ${message}`));
        return;
      }

      try {
        const resolved = resolveCountRunOptions(options);
        if (hasPathInput(options.path)) {
          await executeBatchCount({
            argv,
            options,
            runtime,
            resolved,
            debug,
            teeEnabled,
          });
          return;
        }

        await executeSingleCount({
          textTokens,
          options,
          resolved,
          debug,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (message === "No input provided. Pass text, pipe stdin, or use --path.") {
          program.error(pc.red(message));
          return;
        }
        if (message === "No readable text-like inputs were found from --path.") {
          program.error(pc.red(message));
          return;
        }
        if (message === WASM_DETECTOR_RUNTIME_UNAVAILABLE_MESSAGE) {
          console.error(pc.red(message));
          process.exitCode = 1;
          return;
        }
        program.error(message);
      } finally {
        await debug.close();
      }
    },
  );

  await program.parseAsync(argv);
  if (process.exitCode === undefined) {
    process.exitCode = 0;
  }
}

export { buildBatchSummary } from "./cli/batch/aggregate";
export { loadBatchInputs } from "./cli/path/load";
export { resolveBatchFilePaths } from "./cli/path/resolve";
