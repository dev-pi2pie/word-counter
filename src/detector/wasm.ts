import type {
  DetectorCountSectionsOptions,
  DetectorLocaleOptions,
  DetectorWordCounterOptions,
} from "./types";

export const WASM_DETECTOR_NOT_IMPLEMENTED_MESSAGE =
  "Detector mode `wasm` is not implemented yet.";

function throwWasmNotImplemented(): never {
  throw new Error(WASM_DETECTOR_NOT_IMPLEMENTED_MESSAGE);
}

export async function segmentTextByLocaleWithWasmDetector(
  _text: string,
  _options: DetectorLocaleOptions = {},
) {
  return throwWasmNotImplemented();
}

export async function wordCounterWithWasmDetector(
  _text: string,
  _options: DetectorWordCounterOptions = {},
) {
  return throwWasmNotImplemented();
}

export async function countSectionsWithWasmDetector(
  _input: string,
  _section: string,
  _options: DetectorCountSectionsOptions = {},
) {
  return throwWasmNotImplemented();
}
