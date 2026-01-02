export const DEFAULT_LOCALE = "en-US";

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

export function detectLocaleForChar(
  char: string,
  previousLocale?: string | null
): string | null {
  if (regex.hiragana.test(char) || regex.katakana.test(char)) {
    return "ja-JP";
  }
  if (regex.hangul.test(char)) {
    return "ko-KR";
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
    return "th-TH";
  }

  if (regex.han.test(char)) {
    if (previousLocale && previousLocale.startsWith("ja")) {
      return previousLocale;
    }
    return "zh-Hans";
  }

  if (regex.latin.test(char)) {
    return DEFAULT_LOCALE;
  }

  return null;
}
