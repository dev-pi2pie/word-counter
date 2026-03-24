import { readFile } from "node:fs/promises";
import { parentPort, workerData } from "node:worker_threads";
import { countSections } from "../../../../markdown";
import { countSectionsWithDetector, wordCounterWithDetector } from "../../../../detector";
import { createDetectorDebugSummary } from "../../../../detector/debug";
import wordCounter from "../../../../wc";
import { compactCollectorSegmentsInCountResult } from "../../aggregate";
import { isProbablyBinary } from "../../../path/load";
import type {
  WorkerConfig,
  WorkerRequestMessage,
  WorkerResponseMessage,
} from "./protocol";

const config = workerData as WorkerConfig;

if (!parentPort) {
  throw new Error("Worker protocol init failed: missing parentPort.");
}

parentPort.on("message", async (message: WorkerRequestMessage) => {
  if (message.type === "shutdown") {
    parentPort?.close();
    return;
  }

  const path = message.path;

  let buffer: Buffer;
  try {
    buffer = await readFile(path);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    const messageText = error instanceof Error ? error.message : String(error);

    if (code === "EMFILE" || code === "ENFILE") {
      const response: WorkerResponseMessage = {
        type: "fatal",
        taskId: message.taskId,
        index: message.index,
        path,
        code,
        message: messageText,
      };
      parentPort?.postMessage(response);
      return;
    }

    const response: WorkerResponseMessage = {
      type: "result",
      taskId: message.taskId,
      index: message.index,
      payload: {
        kind: "skip",
        skip: { path, reason: `not readable: ${messageText}` },
      },
    };
    parentPort?.postMessage(response);
    return;
  }

  if (isProbablyBinary(buffer)) {
    const response: WorkerResponseMessage = {
      type: "result",
      taskId: message.taskId,
      index: message.index,
      payload: {
        kind: "skip",
        skip: { path, reason: "binary file" },
      },
    };
    parentPort?.postMessage(response);
    return;
  }

  try {
    const content = buffer.toString("utf8");
    const detectorDebug =
      config.detectorMode === "wasm" && config.debugEnabled
        ? {
            emit: (
              event: string,
              details?: Record<string, unknown>,
              options?: { verbosity?: "compact" | "verbose" },
            ) => {
              const debugEvent: WorkerResponseMessage = {
                type: "debug-event",
                taskId: message.taskId,
                index: message.index,
                event,
                details,
                verbosity: options?.verbosity,
              };
              parentPort?.postMessage(debugEvent);
            },
            summary: createDetectorDebugSummary(config.detectorMode),
            ...(config.detectorEvidence
              ? {
                  evidence: {
                    verbosity: config.debugVerbosity ?? "compact",
                    mode: config.wcOptions.mode ?? "chunk",
                    section: config.section,
                  },
                }
              : {}),
          }
        : undefined;
    const result =
      config.detectorMode === "regex"
        ? config.section === "all"
          ? wordCounter(content, config.wcOptions)
          : countSections(content, config.section, config.wcOptions)
        : config.section === "all"
          ? await wordCounterWithDetector(content, {
              ...config.wcOptions,
              detector: config.detectorMode,
              detectorDebug,
            })
          : await countSectionsWithDetector(content, config.section, {
              ...config.wcOptions,
              detector: config.detectorMode,
              detectorDebug,
            });

    if (!config.preserveCollectorSegments) {
      compactCollectorSegmentsInCountResult(result);
    }

    const response: WorkerResponseMessage = {
      type: "result",
      taskId: message.taskId,
      index: message.index,
      payload: {
        kind: "file",
        file: {
          path,
          result,
          ...(detectorDebug?.summary ? { debug: { detector: detectorDebug.summary } } : {}),
        },
      },
    };
    parentPort?.postMessage(response);
  } catch (error) {
    const code =
      typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined;
    const messageText = error instanceof Error ? error.message : String(error);
    const response: WorkerResponseMessage = {
      type: "fatal",
      taskId: message.taskId,
      index: message.index,
      path,
      code,
      message: messageText,
    };
    parentPort?.postMessage(response);
  }
});
