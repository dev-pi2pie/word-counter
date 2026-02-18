import type { LatinHintRule } from "./types";

const DEFAULT_LATIN_HINT_RULES_SOURCE = [
  { tag: "de", pattern: "[äöüÄÖÜß]" },
  { tag: "es", pattern: "[ñÑ¿¡]" },
  { tag: "pt", pattern: "[ãõÃÕ]" },
  { tag: "fr", pattern: "[œŒæÆ]" },
  { tag: "pl", pattern: "[ąćęłńśźżĄĆĘŁŃŚŹŻ]" },
  { tag: "tr", pattern: "[ıİğĞşŞ]" },
  { tag: "ro", pattern: "[ăĂâÂîÎșȘțȚ]" },
  { tag: "hu", pattern: "[őŐűŰ]" },
  { tag: "is", pattern: "[ðÐþÞ]" },
] satisfies LatinHintRule[];

export const DEFAULT_LATIN_HINT_RULES: ReadonlyArray<Readonly<LatinHintRule>> = Object.freeze(
  DEFAULT_LATIN_HINT_RULES_SOURCE.map((rule) => Object.freeze({ ...rule })),
);
