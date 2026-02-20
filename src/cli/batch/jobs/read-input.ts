import { readFile } from "node:fs/promises";
import { isProbablyBinary } from "../../path/load";
import { createResourceLimitError, isResourceLimitError } from "./limits";
import type { BatchJobsLimit } from "./types";

export type ReadBatchInputResult =
  | {
      type: "file";
      path: string;
      content: string;
    }
  | {
      type: "skip";
      path: string;
      reason: string;
    };

type ReadBatchInputOptions = {
  requestedJobs: number;
  limits: BatchJobsLimit;
};

export async function readBatchInput(
  path: string | undefined,
  options: ReadBatchInputOptions,
): Promise<ReadBatchInputResult> {
  if (!path) {
    return {
      type: "skip",
      path: "",
      reason: "not readable: missing path",
    };
  }

  let buffer: Buffer;
  try {
    buffer = await readFile(path);
  } catch (error) {
    if (isResourceLimitError(error)) {
      throw createResourceLimitError(path, error, options.requestedJobs, options.limits);
    }

    const message = error instanceof Error ? error.message : String(error);
    return {
      type: "skip",
      path,
      reason: `not readable: ${message}`,
    };
  }

  if (isProbablyBinary(buffer)) {
    return {
      type: "skip",
      path,
      reason: "binary file",
    };
  }

  return {
    type: "file",
    path,
    content: buffer.toString("utf8"),
  };
}
