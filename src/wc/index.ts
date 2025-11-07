import { wordCounter } from "./wc";

export default wordCounter;
export { countWordsForLocale, segmentTextByLocale } from "./wc";
export type {
  WordCounterMode,
  WordCounterOptions,
  WordCounterResult,
  WordCounterBreakdown,
} from "./wc";
