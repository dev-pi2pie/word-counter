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

function boolWord(value: boolean, yes = "yes", no = "no"): string {
  return value ? yes : no;
}

function statusWord(value: boolean): string {
  return value ? "ok" : "fail";
}

function renderStandardDoctorReport(report: DoctorReport): void {
  console.log(`Doctor: ${colorStatus(report.status)}`);
  console.log("");

  renderSection("Runtime", [
    `package: ${report.runtime.packageVersion} (${report.runtime.buildChannel})`,
    `node: ${report.runtime.nodeVersion} (supported: ${boolWord(
      report.runtime.meetsProjectRequirement,
    )}; required ${report.runtime.requiredNodeRange})`,
    `platform: ${report.runtime.platform} ${report.runtime.arch}`,
  ]);

  renderSection("Segmenter", [
    `Intl.Segmenter: ${boolWord(report.segmenter.available, "available", "missing")}`,
    `word granularity: ${statusWord(report.segmenter.wordGranularity)}`,
    `grapheme granularity: ${statusWord(report.segmenter.graphemeGranularity)}`,
    `sample segmentation: ${statusWord(report.segmenter.sampleWordSegmentation)}`,
  ]);

  renderSection("Batch jobs", [
    `cpuLimit: ${report.jobs.cpuLimit}`,
    `uvThreadpool: ${report.jobs.uvThreadpool}`,
    `ioLimit: ${report.jobs.ioLimit}`,
    `suggestedMaxJobs: ${report.jobs.suggestedMaxJobs}`,
  ]);

  renderSection("Worker route", [
    `worker threads: ${boolWord(report.workerRoute.workerThreadsAvailable, "available", "missing")}`,
    `disabled by env: ${boolWord(report.workerRoute.workerRouteDisabledByEnv)}`,
    `disableWorkerJobsEnv: ${report.workerRoute.disableWorkerJobsEnv ?? "null"}`,
    `disableExperimentalWorkersEnv: ${report.workerRoute.disableExperimentalWorkersEnv ?? "null"}`,
    `worker pool module: ${boolWord(report.workerRoute.workerPoolModuleLoadable, "loadable", "missing")}`,
    `worker entry: ${boolWord(report.workerRoute.workerEntryFound, "found", "missing")}`,
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

