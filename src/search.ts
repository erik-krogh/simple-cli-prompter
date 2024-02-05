import type { StringOrChoice } from "./index.js";
import * as utils from "./utils.js";
import stripAnsi from "strip-ansi";

/**
 * Holds if `substr` is a subsequence of `str`.
 */
export function hasSubsequence(str: string, sequence: string): boolean {
  str = str.toLowerCase();
  sequence = sequence.toLowerCase();
  let i = 0;
  let j = 0;
  while (i < str.length && j < sequence.length) {
    if (str[i] === sequence[j]) {
      i++;
      j++;
    } else {
      i++;
    }
  }
  return j === sequence.length;
}

export function filterChoices(choices: StringOrChoice[], input: string) {
  return choices.filter((choice) => {
    const text = stripAnsi(utils.renderChoice(choice, false));
    return hasSubsequence(text, input);
  });
}
