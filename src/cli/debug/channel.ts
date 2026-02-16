import { closeSync, createWriteStream, existsSync, mkdirSync, openSync } from "node:fs";
import { basename, dirname, extname, join, resolve as resolvePath } from "node:path";

type DebugDetails = Record<string, unknown>;
export type DebugVerbosity = "compact" | "verbose";

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
    `${now.getFullYear()}${formatTimestampPart(now.getMonth() + 1)}${formatTimestampPart(now.getDate())}`,
    `${formatTimestampPart(now.getHours())}${formatTimestampPart(now.getMinutes())}${formatTimestampPart(now.getSeconds())}`,
  ].join("-");
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
  const defaultName = `wc-debug-${formatDebugReportTimestamp(now)}-${pid}.jsonl`;
  const basePath = report.path ? resolvePath(cwd, report.path) : resolvePath(cwd, defaultName);
  mkdirSync(dirname(basePath), { recursive: true });

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

  if (options.report) {
    const now = options.now?.() ?? new Date();
    const pid = options.pid ?? process.pid;
    reportPath = resolveReportPath(options.report, now, pid);
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

      const payload = JSON.stringify({
        event,
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
