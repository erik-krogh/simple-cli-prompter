import type { StringOrChoice } from ".";
import stripAnsi from "strip-ansi";
import color from "ansi-colors";

export function renderChoice(
  choice: StringOrChoice,
  selected: boolean = false,
  input?: string,
  arrowSelected = true,
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

  let prefix = "";
  if (arrowSelected) {
    prefix = selected ? color.greenBright("\u276f ") : "  ";
  }

  if (!selected) {
    return prefix + text;
  } else {
    return prefix + color.cyan.underline(text);
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
      const text = stripAnsi(renderChoice(choice, false, "", false));
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
  const indexes = getSubsequenceIndexes(message, typed); // the chars from `message` that are in the subsequence `typed` in `message` and should be highlighted

  // pairs of start+stop indicating the start and stop of the contiguous subsequences
  const startStopIndexes = indexes.reduce<[number, number][]>((acc, i) => {
    if (acc.length === 0) {
      return [[i, i]];
    }
    if (acc[acc.length - 1][1] === i - 1) {
      acc[acc.length - 1][1] = i;
      return acc;
    }
    return [...acc, [i, i]];
  }, []);

  let result = "";
  let last = 0;
  for (const [start, end] of startStopIndexes) {
    result += message.slice(last, start);
    result += color.cyan.bold.underline(message.slice(start, end + 1));
    last = end + 1;
  }
  result += message.slice(last);
  return result;
}

import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export function makeFileCompletions(
  input: string,
  ext?: string,
  cwd?: string,
): string[] {
  if (input[0] === "~") {
    // add the home dir
    input = path.join(os.homedir(), input.slice(1));
  }
  const p = path.resolve(cwd ?? process.cwd(), input);
  const parentDir = path.dirname(p);
  if (!fs.existsSync(parentDir)) {
    return [];
  }

  if (fs.existsSync(p) && fs.lstatSync(p).isDirectory()) {
    return fs
      .readdirSync(p)
      .filter((f) => {
        return (
          (typeof ext === "undefined" || f.endsWith(ext) || !f.includes(".")) &&
          !f.startsWith(".")
        );
      })
      .map((f) => {
        if (fs.lstatSync(path.join(p, f)).isDirectory()) {
          return f + "/";
        } else {
          return f;
        }
      });
  }

  const file = path.basename(p);
  let completions: string[];
  try {
    completions = fs
      .readdirSync(parentDir)
      .filter((f) => {
        return (
          f.startsWith(file) &&
          (typeof ext === "undefined" || f.endsWith(ext) || !f.includes("."))
        );
      })
      .map((f) => {
        if (fs.lstatSync(path.join(parentDir, f)).isDirectory()) {
          return f.slice(file.length) + "/";
        } else {
          return f.slice(file.length);
        }
      })
      .filter((f) => !(f === "/" && input.endsWith("/")));
  } catch (ignored) {
    // access denied or similar
    completions = [];
  }
  return completions;
}

import * as cp from "child_process";

/**
 * Waits for the given process to terminate, and returns its stdout.
 * On crash or non-zero exit code, throws an error with the given message.
 */
export function waitForProcess(
  msg: string,
  proc: cp.ChildProcess,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    proc.stdout?.on("data", (data) => {
      console.log("Data:" + data.toString());
      stdout += data;
    });
    proc.stderr?.on("data", (data) => {
      stderr += data;
    });
    proc.on("close", (code) => {
      if (code === 0) {
        resolve(stdout);
      } else {
        reject(new Error(msg + " failed with code " + code + "\n" + stderr));
      }
    });
  });
}
