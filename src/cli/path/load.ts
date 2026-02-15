import { readFile } from "node:fs/promises";
import type { BatchFileInput, BatchSkip } from "../types";

export function isProbablyBinary(buffer: Buffer): boolean {
  if (buffer.length === 0) {
    return false;
  }

  const sampleSize = Math.min(buffer.length, 1024);
  let suspicious = 0;

  for (let index = 0; index < sampleSize; index += 1) {
    const byte = buffer[index] ?? 0;

    if (byte === 0) {
      return true;
    }

    if (byte === 9 || byte === 10 || byte === 13) {
      continue;
    }

    if (byte >= 32 && byte <= 126) {
      continue;
    }

    if (byte >= 128) {
      continue;
    }

    suspicious += 1;
  }

  return suspicious / sampleSize > 0.3;
}

export async function loadBatchInputs(
  filePaths: string[],
): Promise<{ files: BatchFileInput[]; skipped: BatchSkip[] }> {
  const files: BatchFileInput[] = [];
  const skipped: BatchSkip[] = [];

  for (const filePath of filePaths) {
    let buffer: Buffer;
    try {
      buffer = await readFile(filePath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      skipped.push({ path: filePath, reason: `not readable: ${message}` });
      continue;
    }

    if (isProbablyBinary(buffer)) {
      skipped.push({ path: filePath, reason: "binary file" });
      continue;
    }

    files.push({
      path: filePath,
      content: buffer.toString("utf8"),
    });
  }

  return { files, skipped };
}
