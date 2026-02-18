import { wordCounter } from "./wc";

export default wordCounter;
export { countCharsForLocale, countWordsForLocale, segmentTextByLocale } from "./wc";
export { DEFAULT_LATIN_HINT_RULES } from "./wc";
export type {
  LatinHintRule,
  NonWordCollection,
  WordCounterMode,
  WordCounterOptions,
  WordCounterResult,
  WordCounterBreakdown,
} from "./wc";
