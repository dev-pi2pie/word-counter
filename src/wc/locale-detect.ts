import type { LatinHintRule } from "./types";
import { DEFAULT_LATIN_HINT_RULES } from "./latin-hints";

export const DEFAULT_LOCALE = "und-Latn";
export const DEFAULT_HAN_TAG = "und-Hani";

const MAX_LATIN_HINT_PATTERN_LENGTH = 256;

export interface LocaleDetectOptions {
  latinLanguageHint?: string;
  latinTagHint?: string;
  latinLocaleHint?: string;
  latinHintRules?: LatinHintRule[];
  useDefaultLatinHints?: boolean;
  hanLanguageHint?: string;
  hanTagHint?: string;
}

type ResolvedLatinHintRule = {
  tag: string;
  pattern: RegExp;
  priority: number;
  order: number;
};

export type LocaleDetectContext = {
  latinHint?: string;
  hanHint?: string;
  latinHintRules: ResolvedLatinHintRule[];
  latinLocales: Set<string>;
};

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

const defaultLatinLocales = new Set<string>([
  DEFAULT_LOCALE,
  ...DEFAULT_LATIN_HINT_RULES.map((hint) => hint.tag),
]);

export function isLatinLocale(locale: string, context?: LocaleDetectContext): boolean {
  if (context) {
    return context.latinLocales.has(locale);
  }
  return defaultLatinLocales.has(locale);
}

function resolveLatinHint(options: LocaleDetectOptions): string | undefined {
  const latinTagHint = options.latinTagHint?.trim();
  if (latinTagHint) {
    return latinTagHint;
  }

  const latinLanguageHint = options.latinLanguageHint?.trim();
  if (latinLanguageHint) {
    return latinLanguageHint;
  }

  const latinLocaleHint = options.latinLocaleHint?.trim();
  if (latinLocaleHint) {
    return latinLocaleHint;
  }

  return undefined;
}

function resolveHanHint(options: LocaleDetectOptions): string | undefined {
  const hanTagHint = options.hanTagHint?.trim();
  if (hanTagHint) {
    return hanTagHint;
  }

  const hanLanguageHint = options.hanLanguageHint?.trim();
  if (hanLanguageHint) {
    return hanLanguageHint;
  }

  return undefined;
}

function compileLatinHintPattern(
  pattern: string | RegExp,
  label: string,
): RegExp {
  const source = typeof pattern === "string" ? pattern : pattern.source;
  const hasUnicodeMode =
    typeof pattern !== "string" &&
    (pattern.flags.includes("u") || pattern.flags.includes("v"));
  const flags =
    typeof pattern === "string"
      ? "u"
      : hasUnicodeMode
        ? pattern.flags
        : `${pattern.flags}u`;
  if (source.length === 0) {
    throw new Error(`${label}: pattern must not be empty.`);
  }
  if (source.length > MAX_LATIN_HINT_PATTERN_LENGTH) {
    throw new Error(
      `${label}: pattern must be at most ${MAX_LATIN_HINT_PATTERN_LENGTH} characters.`,
    );
  }
  try {
    return new RegExp(source, flags);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`${label}: invalid Unicode regex pattern (${message}).`);
  }
}

function normalizeLatinHintPriority(priority: unknown, label: string): number {
  if (priority === undefined) {
    return 0;
  }
  if (typeof priority !== "number" || !Number.isFinite(priority)) {
    throw new Error(`${label}: priority must be a finite number when provided.`);
  }
  return priority;
}

function compileLatinHintRule(
  rule: Readonly<LatinHintRule>,
  order: number,
  label: string,
): ResolvedLatinHintRule {
  const tag = typeof rule.tag === "string" ? rule.tag.trim() : "";
  if (!tag) {
    throw new Error(`${label}: tag must be a non-empty string.`);
  }
  const pattern = compileLatinHintPattern(rule.pattern, label);
  const priority = normalizeLatinHintPriority(rule.priority, label);
  return {
    tag,
    pattern,
    priority,
    order,
  };
}

function resolveLatinHintRules(options: LocaleDetectOptions): ResolvedLatinHintRule[] {
  const useDefaultLatinHints = options.useDefaultLatinHints !== false;
  const customRules = options.latinHintRules ?? [];
  const combinedRules: Array<{ rule: Readonly<LatinHintRule>; label: string }> = [];

  for (let index = 0; index < customRules.length; index += 1) {
    const rule = customRules[index];
    if (!rule) {
      continue;
    }
    combinedRules.push({
      rule,
      label: `Invalid custom Latin hint rule at index ${index}`,
    });
  }

  if (useDefaultLatinHints) {
    for (let index = 0; index < DEFAULT_LATIN_HINT_RULES.length; index += 1) {
      const rule = DEFAULT_LATIN_HINT_RULES[index];
      if (!rule) {
        continue;
      }
      combinedRules.push({
        rule,
        label: `Invalid default Latin hint rule at index ${index}`,
      });
    }
  }

  const resolvedRules = combinedRules.map((entry, index) =>
    compileLatinHintRule(entry.rule, index, entry.label),
  );

  resolvedRules.sort((left, right) => {
    if (left.priority !== right.priority) {
      return right.priority - left.priority;
    }
    return left.order - right.order;
  });

  return resolvedRules;
}

export function resolveLocaleDetectContext(
  options: LocaleDetectOptions = {},
): LocaleDetectContext {
  const latinHint = resolveLatinHint(options);
  const latinHintRules = resolveLatinHintRules(options);
  const latinLocales = new Set<string>([DEFAULT_LOCALE]);
  for (const rule of latinHintRules) {
    latinLocales.add(rule.tag);
  }
  if (latinHint) {
    latinLocales.add(latinHint);
  }

  return {
    latinHint,
    hanHint: resolveHanHint(options),
    latinHintRules,
    latinLocales,
  };
}

function detectLatinLocale(char: string, context: LocaleDetectContext): string {
  for (const hint of context.latinHintRules) {
    hint.pattern.lastIndex = 0;
    if (hint.pattern.test(char)) {
      return hint.tag;
    }
  }
  return DEFAULT_LOCALE;
}

export function detectLocaleForChar(
  char: string,
  previousLocale?: string | null,
  options: LocaleDetectOptions = {},
  context: LocaleDetectContext = resolveLocaleDetectContext(options),
  allowLatinLocaleCarry = true,
  allowJapaneseHanCarry = true,
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
    if (allowJapaneseHanCarry && previousLocale && previousLocale.startsWith("ja")) {
      return previousLocale;
    }
    return context.hanHint ?? DEFAULT_HAN_TAG;
  }

  if (regex.latin.test(char)) {
    const hintedLocale = detectLatinLocale(char, context);
    if (hintedLocale !== DEFAULT_LOCALE) {
      return hintedLocale;
    }
    if (
      allowLatinLocaleCarry &&
      previousLocale &&
      isLatinLocale(previousLocale, context) &&
      previousLocale !== DEFAULT_LOCALE
    ) {
      return previousLocale;
    }
    if (context.latinHint) {
      return context.latinHint;
    }
    return DEFAULT_LOCALE;
  }

  return null;
}
