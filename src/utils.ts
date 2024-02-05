import type { StringOrChoice } from ".";
import stripAnsi from "strip-ansi";
import color from "ansi-colors";

export function renderChoice(
  choice: StringOrChoice,
  selected: boolean = false,
  input?: string,
): string {
  let text;
  if (typeof choice === "string") {
    text = choice;
  } else {
    text = choice.message || choice.name;
    if (choice.hint) {
      text += " " + color.dim(choice.hint);
    }
  }

  if (input) {
    text = highlightSubsequence(text, input);
  }

  if (!selected) {
    return "  " + text;
  } else {
    return color.greenBright("\u276f ") + color.bold.white(text);
  }
}
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

export function filterAndSortChoices(choices: StringOrChoice[], input: string) {
  return choices
    .filter((choice) => {
      const text = stripAnsi(renderChoice(choice, false));
      return hasSubsequence(text, input);
    })
    .map((choice) => [choice, getChoicePriority(choice, input)] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([choice]) => choice);
}

function getChoicePriority(choice: StringOrChoice, input: string): number {
  const message =
    typeof choice === "string" ? choice : choice.message || choice.name || "";
  const hint =
    typeof choice === "string" ? "" : choice?.hint?.toLowerCase() || "";
  if (message.indexOf(input) !== -1) {
    // first the exact matches
    // sorted by where the match is (earlier matches are better)
    return 1 + message.indexOf(input) / 1000;
  } else if (getSubSequenceWeight(message, input)) {
    // then the matches that are a subsequence of the typed string
    // sorted by the length of the longest contiguous subsequence of the typed string in the message
    return 2 + (message.length - getSubSequenceWeight(message, input)) / 1000;
  } else if (hint && getSubSequenceWeight(hint, input)) {
    // same, but for hints
    return 3 + (hint.length - getSubSequenceWeight(hint, input)) / 1000;
  } else {
    return 4;
  }
}

/**
 * returns 0 if `str` does not contain the subsequence `substr`.
 * Otherwise returns `sum(len(subseq)^2)`, where `subsub` is each contiguous subsequence of `substr` in `str`.
 * For example, if `str` is "abcdefg" and `substr` is "bcdfg", then the result is `(3^2 + 2^2) = 13`.
 * The search for longest contiguous subsequence is greedy.
 */
function getSubSequenceWeight(str: string, sequence: string): number {
  const indexes = getSubsequenceIndexes(str, sequence);
  if (indexes.length === 0) {
    return 0;
  }
  let sum = 0;
  let index = -2;
  let currentLength = 0;
  for (const i of indexes) {
    if (i == index + 1) {
      currentLength++;
    } else {
      sum += currentLength * currentLength;
      currentLength = 1;
    }
    index = i;
  }

  return sum + currentLength * currentLength;
}

/**
 * Gets the indexes of the chars from `str` in the subsequence `substr` in `str`.
 * Does a greedy search for the longest contiguous subsequences.
 */
function getSubsequenceIndexes(message: string, typed: string): number[] {
  message = message.toLowerCase();
  typed = typed.toLowerCase();

  const result: number[] = [];
  let index = -1;
  outer: while (typed.length > 0) {
    for (let l = typed.length - 1; l >= 0; l--) {
      const i = message.indexOf(typed.slice(0, l + 1), index + 1);
      if (i !== -1) {
        index = i;
        typed = typed.slice(l + 1);
        for (let res = index; res <= index + l; res++) {
          result.push(res);
        }
        continue outer;
      }
    }
    break;
  }
  return result;
}

export function highlightSubsequence(message: string, typed: string): string {
  const styleStr = color.cyan.underline("X");
  const startStyle = styleStr.slice(0, styleStr.indexOf("X"));
  const endStyle = styleStr.slice(styleStr.indexOf("X") + 1);

  const indexes = getSubsequenceIndexes(message, typed);
  let result = "";
  let index = 0;
  let wasUnderlined = false;
  for (const i of indexes) {
    result += message.slice(index, i);
    if (!wasUnderlined) {
      result += startStyle; // start cyan underline
    }
    result += message[i];
    wasUnderlined = true;
    index = i + 1;
    if (i + 1 >= message.length || !indexes.includes(i + 1)) {
      result += endStyle; // end cyan underline
      wasUnderlined = false;
    }
  }
  result += message.slice(index);
  return result;
}
