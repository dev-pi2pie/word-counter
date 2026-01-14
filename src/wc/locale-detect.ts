export const DEFAULT_LOCALE = "und-Latn";

const regex = {
  hiragana: /\p{Script=Hiragana}/u,
  katakana: /\p{Script=Katakana}/u,
  hangul: /\p{Script=Hangul}/u,
  han: /\p{Script=Han}/u,
  latin: /\p{Script=Latin}/u,
  arabic: /\p{Script=Arabic}/u,
  cyrillic: /\p{Script=Cyrillic}/u,
  devanagari: /\p{Script=Devanagari}/u,
  thai: /\p{Script=Thai}/u,
};

const latinLocaleHints: Array<{ locale: string; regex: RegExp }> = [
  { locale: "de", regex: /[äöüÄÖÜß]/ },
  { locale: "es", regex: /[ñÑ¿¡]/ },
  { locale: "pt", regex: /[ãõÃÕ]/ },
  { locale: "fr", regex: /[œŒæÆ]/ },
];

const latinLocales = new Set<string>([
  DEFAULT_LOCALE,
  ...latinLocaleHints.map((hint) => hint.locale),
]);

export function isLatinLocale(locale: string): boolean {
  return latinLocales.has(locale);
}

function detectLatinLocale(char: string): string {
  for (const hint of latinLocaleHints) {
    if (hint.regex.test(char)) {
      return hint.locale;
    }
  }
  return DEFAULT_LOCALE;
}

export function detectLocaleForChar(
  char: string,
  previousLocale?: string | null
): string | null {
  if (regex.hiragana.test(char) || regex.katakana.test(char)) {
    return "ja";
  }
  if (regex.hangul.test(char)) {
    return "ko";
  }
  if (regex.arabic.test(char)) {
    return "ar";
  }
  if (regex.cyrillic.test(char)) {
    return "ru";
  }
  if (regex.devanagari.test(char)) {
    return "hi";
  }
  if (regex.thai.test(char)) {
    return "th";
  }

  if (regex.han.test(char)) {
    if (previousLocale && previousLocale.startsWith("ja")) {
      return previousLocale;
    }
    return "zh-Hans";
  }

  if (regex.latin.test(char)) {
    const hintedLocale = detectLatinLocale(char);
    if (hintedLocale !== DEFAULT_LOCALE) {
      return hintedLocale;
    }
    if (previousLocale && isLatinLocale(previousLocale)) {
      return previousLocale;
    }
    return DEFAULT_LOCALE;
  }

  return null;
}
