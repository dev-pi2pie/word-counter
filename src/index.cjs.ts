import wordCounter, { countWordsForLocale, segmentTextByLocale } from "./wc";
import { showSingularOrPluralWord } from "./utils";

const cjsExports = Object.assign(wordCounter, {
  default: wordCounter,
  wordCounter,
  countWordsForLocale,
  segmentTextByLocale,
  showSingularOrPluralWord,
});

export = cjsExports;
