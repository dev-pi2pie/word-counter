import { DEFAULT_HAN_TAG, DEFAULT_LOCALE } from "../wc/locale-detect";
import type { DetectorRouteTag } from "./policy";
import type { DetectorResult } from "./types";

export interface WhatlangWasmResult {
  lang: string;
  script: string;
  confidence: number;
  reliable: boolean;
}

const LATIN_LANGUAGE_TAGS: Record<string, string> = {
  cat: "ca",
  ces: "cs",
  dan: "da",
  deu: "de",
  eng: "en",
  fin: "fi",
  fra: "fr",
  hun: "hu",
  ita: "it",
  lat: "la",
  nld: "nl",
  pol: "pl",
  por: "pt",
  ron: "ro",
  spa: "es",
  swe: "sv",
  tur: "tr",
};

const HANI_LANGUAGE_TAGS: Record<string, string> = {
  cmn: "zh",
  jpn: "ja",
};

function hasSupportedScript(result: WhatlangWasmResult, routeTag: DetectorRouteTag): boolean {
  if (routeTag === DEFAULT_LOCALE) {
    return result.script === "Latin";
  }

  if (result.lang === "cmn") {
    return result.script === "Mandarin";
  }

  if (result.lang === "jpn") {
    return (
      result.script === "Mandarin" || result.script === "Hiragana" || result.script === "Katakana"
    );
  }

  return false;
}

function remapLanguageTag(lang: string, routeTag: DetectorRouteTag): string | undefined {
  if (routeTag === DEFAULT_LOCALE) {
    return LATIN_LANGUAGE_TAGS[lang];
  }

  return HANI_LANGUAGE_TAGS[lang];
}

export function remapWhatlangResult(
  result: WhatlangWasmResult,
  routeTag: DetectorRouteTag,
): DetectorResult | null {
  if (!hasSupportedScript(result, routeTag)) {
    return null;
  }

  const tag = remapLanguageTag(result.lang, routeTag);
  if (!tag) {
    return null;
  }

  return {
    tag,
    confidence: result.confidence,
    reliable: result.reliable,
    source: "wasm",
  };
}

export function getDetectorFallbackTag(routeTag: DetectorRouteTag): string {
  return routeTag === DEFAULT_HAN_TAG ? DEFAULT_HAN_TAG : DEFAULT_LOCALE;
}
