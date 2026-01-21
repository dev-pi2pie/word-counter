import wordCounter, {
  countCharsForLocale,
  countWordsForLocale,
  segmentTextByLocale,
} from "./wc";
import { parseMarkdown, countSections } from "./markdown";
import { showSingularOrPluralWord } from "./utils";

const cjsExports = Object.assign(wordCounter, {
  default: wordCounter,
  wordCounter,
  countCharsForLocale,
  countWordsForLocale,
  segmentTextByLocale,
  parseMarkdown,
  countSections,
  showSingularOrPluralWord,
});

export = cjsExports;
