import pc from "picocolors";
import type { DoctorOutputFormat, DoctorReport, DoctorStatus } from "./types";

type RenderDoctorReportOptions = {
  format: DoctorOutputFormat;
  pretty: boolean;
};

function colorStatus(status: DoctorStatus): string {
  if (status === "ok") {
    return pc.green(pc.bold(status));
  }
  if (status === "warn") {
    return pc.yellow(pc.bold(status));
  }
  return pc.red(pc.bold(status));
}

function renderSection(title: string, lines: string[]): void {
  console.log(pc.bold(title));
  for (const line of lines) {
    console.log(`- ${line}`);
  }
  console.log("");
}

function colorBoolean(value: boolean, yes = "yes", no = "no"): string {
  return value ? pc.green(yes) : pc.red(no);
}

function colorNumber(value: number): string {
  return pc.yellow(String(value));
}

function colorStatusWord(value: boolean): string {
  return value ? pc.green("ok") : pc.red("fail");
}

function renderStandardDoctorReport(report: DoctorReport): void {
  console.log(`Doctor: ${colorStatus(report.status)}`);
  console.log("");

  renderSection("Runtime", [
    `package: ${report.runtime.packageVersion} (${report.runtime.buildChannel})`,
    `node: ${report.runtime.nodeVersion} (supported: ${colorBoolean(
      report.runtime.meetsProjectRequirement,
    )}; required ${report.runtime.requiredNodeRange})`,
    `platform: ${report.runtime.platform} ${report.runtime.arch}`,
  ]);

  renderSection("Segmenter", [
    `Intl.Segmenter: ${colorBoolean(report.segmenter.available, "available", "missing")}`,
    `word granularity: ${colorStatusWord(report.segmenter.wordGranularity)}`,
    `grapheme granularity: ${colorStatusWord(report.segmenter.graphemeGranularity)}`,
    `sample segmentation: ${colorStatusWord(report.segmenter.sampleWordSegmentation)}`,
  ]);

  renderSection("Batch jobs", [
    `cpuLimit: ${colorNumber(report.jobs.cpuLimit)}`,
    `uvThreadpool: ${colorNumber(report.jobs.uvThreadpool)}`,
    `ioLimit: ${colorNumber(report.jobs.ioLimit)}`,
    `suggestedMaxJobs: ${colorNumber(report.jobs.suggestedMaxJobs)}`,
  ]);

  renderSection("Worker route", [
    `worker threads: ${colorBoolean(report.workerRoute.workerThreadsAvailable, "available", "missing")}`,
    `disabled by env: ${colorBoolean(report.workerRoute.workerRouteDisabledByEnv)}`,
    `disableWorkerJobsEnv: ${report.workerRoute.disableWorkerJobsEnv ?? "null"}`,
    `worker pool module: ${colorBoolean(report.workerRoute.workerPoolModuleLoadable, "loadable", "missing")}`,
    `worker entry: ${colorBoolean(report.workerRoute.workerEntryFound, "found", "missing")}`,
  ]);

  if (report.warnings.length > 0) {
    console.log(pc.bold("Warnings"));
    for (const warning of report.warnings) {
      console.log(pc.yellow(`- ${warning}`));
    }
  }
}

export function renderDoctorReport(
  report: DoctorReport,
  options: RenderDoctorReportOptions,
): void {
  if (options.format === "json") {
    console.log(JSON.stringify(report, null, options.pretty ? 2 : 0));
    return;
  }

  renderStandardDoctorReport(report);
}
