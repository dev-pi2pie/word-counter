import type { LocaleChunk } from "../wc/types";
import { isAmbiguousDetectorRoute, type DetectorWindow } from "./policy";

export function buildDetectorWindows(chunks: LocaleChunk[]): DetectorWindow[] {
  const windows: DetectorWindow[] = [];

  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    if (!chunk || !isAmbiguousDetectorRoute(chunk.locale)) {
      continue;
    }

    const previousWindow = windows[windows.length - 1];
    if (
      previousWindow &&
      previousWindow.routeTag === chunk.locale &&
      previousWindow.endIndex === index - 1
    ) {
      previousWindow.endIndex = index;
      previousWindow.text += chunk.text;
      continue;
    }

    windows.push({
      routeTag: chunk.locale,
      startIndex: index,
      endIndex: index,
      text: chunk.text,
    });
  }

  return windows;
}
