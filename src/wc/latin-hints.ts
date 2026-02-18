import type { LatinHintRule } from "./types";

export const DEFAULT_LATIN_HINT_RULES: LatinHintRule[] = [
  { tag: "de", pattern: /[äöüÄÖÜß]/u },
  { tag: "es", pattern: /[ñÑ¿¡]/u },
  { tag: "pt", pattern: /[ãõÃÕ]/u },
  { tag: "fr", pattern: /[œŒæÆ]/u },
  { tag: "pl", pattern: /[ąćęłńśźżĄĆĘŁŃŚŹŻ]/u },
  { tag: "tr", pattern: /[ıİğĞşŞ]/u },
  { tag: "ro", pattern: /[ăĂâÂîÎșȘțȚ]/u },
  { tag: "hu", pattern: /[őŐűŰ]/u },
  { tag: "is", pattern: /[ðÐþÞ]/u },
];
