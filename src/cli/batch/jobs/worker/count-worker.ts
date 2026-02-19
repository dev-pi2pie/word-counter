import { readFile } from "node:fs/promises";
import { parentPort, workerData } from "node:worker_threads";
import { countSections } from "../../../../markdown";
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

  try {
    const buffer = await readFile(path);
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

    const content = buffer.toString("utf8");
    const result =
      config.section === "all"
        ? wordCounter(content, config.wcOptions)
        : countSections(content, config.section, config.wcOptions);

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
  }
});
