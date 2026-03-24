import { closeSync, createWriteStream, existsSync, mkdirSync, openSync, statSync } from "node:fs";
import { basename, dirname, extname, join, resolve as resolvePath } from "node:path";

type DebugDetails = Record<string, unknown>;
export type DebugVerbosity = "compact" | "verbose";
const DEBUG_EVENT_SCHEMA_VERSION = 1;

type DebugEventOptions = {
  verbosity?: DebugVerbosity;
};

type DebugReportOptions = {
  path?: string;
  tee: boolean;
  cwd?: string;
};

export type CreateDebugChannelOptions = {
  enabled: boolean;
  verbosity?: DebugVerbosity;
  report?: DebugReportOptions;
  now?: () => Date;
  pid?: number;
};

export type DebugChannel = {
  enabled: boolean;
  verbosity: DebugVerbosity;
  reportPath?: string;
  emit: (event: string, details?: DebugDetails, options?: DebugEventOptions) => void;
  close: () => Promise<void>;
};

type DebugSink = {
  write: (line: string) => void;
  close: () => Promise<void>;
};

const NOOP_CLOSE = async (): Promise<void> => {
  return;
};

function shouldEmitAtVerbosity(
  channelVerbosity: DebugVerbosity,
  eventVerbosity: DebugVerbosity,
): boolean {
  return channelVerbosity === "verbose" || eventVerbosity === "compact";
}

function formatTimestampPart(value: number): string {
  return String(value).padStart(2, "0");
}

function formatDebugReportTimestamp(now: Date): string {
  return [
    `${now.getUTCFullYear()}${formatTimestampPart(now.getUTCMonth() + 1)}${formatTimestampPart(now.getUTCDate())}`,
    `${formatTimestampPart(now.getUTCHours())}${formatTimestampPart(now.getUTCMinutes())}${formatTimestampPart(now.getUTCSeconds())}`,
  ].join("-");
}

function buildRunId(now: Date, pid: number): string {
  return `wc-debug-${now.getTime()}-${pid}`;
}

function inferEventTopic(event: string): string {
  const topic = event.split(".")[0]?.trim();
  return topic && topic.length > 0 ? topic : "runtime";
}

const FILE_SCOPED_EVENT_PATTERNS = [
  /^batch\.skips\.item$/,
  /^path\.resolve\.input$/,
  /^path\.resolve\.skip$/,
  /^path\.resolve\.(filter|regex)\.excluded$/,
  /^path\.resolve\.expand\.include$/,
  /^path\.resolve\.dedupe\.(accept|duplicate)$/,
];

function inferEventScope(event: string): string {
  return FILE_SCOPED_EVENT_PATTERNS.some((pattern) => pattern.test(event)) ? "file" : "run";
}

function withCollisionSuffix(pathValue: string, sequence: number): string {
  if (sequence <= 0) {
    return pathValue;
  }

  const extension = extname(pathValue);
  const baseName = basename(pathValue, extension);
  const parent = dirname(pathValue);
  return join(parent, `${baseName}-${sequence}${extension}`);
}

function resolveReportPath(report: DebugReportOptions, now: Date, pid: number): string {
  const cwd = report.cwd ?? process.cwd();
  const defaultName = `wc-debug-${formatDebugReportTimestamp(now)}-utc-${pid}.jsonl`;
  const explicitPathValue = typeof report.path === "string" ? report.path : undefined;
  const explicitPath = explicitPathValue !== undefined;
  const basePath = resolvePath(cwd, explicitPathValue ?? defaultName);
  mkdirSync(dirname(basePath), { recursive: true });

  if (explicitPath) {
    if (existsSync(basePath) && statSync(basePath).isDirectory()) {
      throw new Error(`debug report path must be a file: ${basePath}`);
    }
    return basePath;
  }

  let candidate = basePath;
  let sequence = 0;
  while (existsSync(candidate)) {
    sequence += 1;
    candidate = withCollisionSuffix(basePath, sequence);
  }

  return candidate;
}

function createTerminalSink(): DebugSink {
  return {
    write(line) {
      console.error(`[debug] ${line}`);
    },
    close: NOOP_CLOSE,
  };
}

function createFileSink(pathValue: string): DebugSink {
  try {
    const fd = openSync(pathValue, "a");
    closeSync(fd);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`debug report path is not writable: ${pathValue} (${message})`);
  }

  const stream = createWriteStream(pathValue, { flags: "a", encoding: "utf8" });
  let streamError: Error | undefined;
  stream.on("error", (error) => {
    streamError = error;
  });

  return {
    write(line) {
      if (streamError || stream.destroyed) {
        return;
      }
      stream.write(`${line}\n`);
    },
    close() {
      if (streamError || stream.destroyed || stream.writableEnded) {
        return Promise.resolve();
      }

      return new Promise<void>((resolve) => {
        stream.end(() => {
          resolve();
        });
      });
    },
  };
}

export function createDebugChannel(options: CreateDebugChannelOptions): DebugChannel {
  if (!options.enabled) {
    return {
      enabled: false,
      verbosity: options.verbosity ?? "compact",
      emit() {
        return;
      },
      close: NOOP_CLOSE,
    };
  }

  const verbosity = options.verbosity ?? "compact";
  const sinks: DebugSink[] = [];
  let reportPath: string | undefined;
  const channelNow = options.now?.() ?? new Date();
  const channelPid = options.pid ?? process.pid;
  const runId = buildRunId(channelNow, channelPid);

  if (options.report) {
    reportPath = resolveReportPath(options.report, channelNow, channelPid);
    sinks.push(createFileSink(reportPath));

    if (options.report.tee) {
      sinks.push(createTerminalSink());
    }
  } else {
    sinks.push(createTerminalSink());
  }

  return {
    enabled: true,
    verbosity,
    reportPath,
    emit(event, details = {}, eventOptions = {}) {
      const eventVerbosity = eventOptions.verbosity ?? "compact";
      if (!shouldEmitAtVerbosity(verbosity, eventVerbosity)) {
        return;
      }

      const timestamp = (options.now?.() ?? new Date()).toISOString();
      const payload = JSON.stringify({
        schemaVersion: DEBUG_EVENT_SCHEMA_VERSION,
        timestamp,
        runId,
        topic: inferEventTopic(event),
        scope: inferEventScope(event),
        event,
        verbosity: eventVerbosity,
        ...details,
      });
      for (const sink of sinks) {
        sink.write(payload);
      }
    },
    async close() {
      for (const sink of sinks) {
        await sink.close();
      }
    },
  };
}
