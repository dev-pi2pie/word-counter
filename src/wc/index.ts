import { wordCounter } from "./wc";

export default wordCounter;
export { countCharsForLocale, countWordsForLocale, segmentTextByLocale } from "./wc";
export type {
  NonWordCollection,
  WordCounterMode,
  WordCounterOptions,
  WordCounterResult,
  WordCounterBreakdown,
} from "./wc";
