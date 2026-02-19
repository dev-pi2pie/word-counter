import type { SectionMode, SectionedResult } from "../../../../markdown";
import type { WordCounterOptions, WordCounterResult } from "../../../../wc";
import type { BatchSkip } from "../../../types";

export type WorkerConfig = {
  section: SectionMode;
  wcOptions: WordCounterOptions;
  preserveCollectorSegments: boolean;
};

export type WorkerTaskMessage = {
  type: "task";
  taskId: number;
  index: number;
  path: string;
};

export type WorkerShutdownMessage = {
  type: "shutdown";
};

export type WorkerRequestMessage = WorkerTaskMessage | WorkerShutdownMessage;

export type WorkerFileResultPayload = {
  path: string;
  result: WordCounterResult | SectionedResult;
};

export type WorkerTaskResultMessage = {
  type: "result";
  taskId: number;
  index: number;
  payload:
    | {
        kind: "file";
        file: WorkerFileResultPayload;
      }
    | {
        kind: "skip";
        skip: BatchSkip;
      };
};

export type WorkerTaskFatalMessage = {
  type: "fatal";
  taskId: number;
  index: number;
  path: string;
  code: string | undefined;
  message: string;
};

export type WorkerResponseMessage = WorkerTaskResultMessage | WorkerTaskFatalMessage;
