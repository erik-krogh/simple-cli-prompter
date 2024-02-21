import type { StringOrChoice } from "./index.js";
import stripAnsi from "strip-ansi";
import color from "ansi-colors";

export function renderChoice(
  choice: StringOrChoice,
  selected: boolean = false,
  input?: string,
  arrowSelected = true,
): string {
  let text;
  let hintStart = -1;
  if (typeof choice === "string") {
    text = choice;
  } else {
    text = choice.message || choice.name;
    if (choice.hint) {
      hintStart = text.length;
      text += " " + choice.hint;
    }
  }

  if (input) {
    text = highlightSubsequence(text, input);
  }

  // I have to apply the dim after the highlighting, otherwise the formatting gets messed up
  if (hintStart !== -1) {
    text =
      ansiAwareSlice(text, 0, hintStart + 1) +
      color.dim(ansiAwareSlice(text, hintStart + 1, text.length));
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
export function hasSubsequence(
  str: string,
  sequence: string,
  caseNormalize: boolean = true,
): boolean {
  if (caseNormalize) {
    str = str.toLowerCase();
    sequence = sequence.toLowerCase();
  }
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
      return hasSubsequence(
        stripAnsi(
          typeof choice === "string"
            ? choice
            : (choice.message ?? choice.name) + (choice.hint ?? ""),
        ),
        input,
      );
    })
    .map((choice) => [choice, getChoicePriority(choice, input)] as const)
    .sort((a, b) => a[1] - b[1])
    .map(([choice]) => choice);
}

// lower is better
function getChoicePriority(choice: StringOrChoice, input: string): number {
  const text = stripAnsi(renderChoice(choice, false, "", false));
  if (text.indexOf(input) !== -1) {
    // first the exact matches
    // sorted by where the match is (earlier matches are better)
    return 1 + text.indexOf(input) / 1000;
  }

  const indexes = getSubsequenceIndexes(text, input);
  const textWeight = indexes.reduce(
    (acc, [start, end]) => acc + (end - start + 1) ** 2,
    0,
  );
  const numMatches = indexes.length;
  const firstStart = indexes[0][0];
  // then the matches that are a subsequence of the typed string
  // sorted by the number of matches (less is better)
  // then sorted by better grouping of the matches (the weigth) (more is better)
  // tie-breaker: the start index of the first match (earlier is better)
  // second tie-breaker: the length of the text (shorter is better)
  return (
    2 +
    numMatches / 1000 -
    textWeight / 1000000 +
    firstStart / 10000000 +
    text.length / 1000000000
  );
}

/**
 * Gets the indexes of the chars from `message` in the subsequence `typed` in `message`.
 * Does a greedy search for the longest contiguous subsequences.
 * The result are pairs of start/end indexes for the subsequences.
 * `typed` is assumed to be a subsequence of `message`.
 */
function getSubsequenceIndexes(
  message: string,
  typed: string,
): [number, number][] {
  // checking if the typed string is a subsequence of the message when we don't normalize the case
  if (hasSubsequence(message, typed, false)) {
    // there is a subsequence match without normalizing the case, so we don't need to case normalize
  } else {
    // there is not, so we need to case normalize
    message = message.toLowerCase();
    typed = typed.toLowerCase();
  }

  // from how this function is used, we know that `typed` is a subsequence of `message`

  // a greedy algorithm that finds the longest contiguous subsequences
  const result: [number, number][] = [];
  let startOffset = 0;
  while (typed.length > 0) {
    for (let useLength = typed.length; useLength > 0; useLength--) {
      const subseq = typed.slice(0, useLength);
      const index = message.indexOf(subseq, startOffset);
      if (index === -1) {
        continue;
      }
      if (index !== -1) {
        // check that the remainder is still a subsequence
        const remainderTyped = typed.slice(useLength);
        const remainderMsg = message.slice(index + useLength);
        if (hasSubsequence(remainderMsg, remainderTyped, false)) {
          startOffset = index + useLength;
          typed = remainderTyped;
          result.push([index, index + useLength - 1]);
          break;
        }
      }
    }
  }

  return result;
}

export function highlightSubsequence(message: string, typed: string): string {
  const startStopIndexes = getSubsequenceIndexes(stripAnsi(message), typed); // the chars from `message` that are in the subsequence `typed` in `message` and should be highlighted

  let result = "";
  let last = 0;
  for (const [start, end] of startStopIndexes) {
    const prefix = ansiAwareSlice(message, last, start);
    result += prefix; //message.slice(last, start);
    const highlighted = color.cyan.bold.underline(
      ansiAwareSlice(message, start, end + 1),
    );
    result += highlighted;
    last = end + 1;
  }
  const suffix = ansiAwareSlice(message, last, message.length);
  result += suffix;
  return result;
}

import * as path from "path";
import * as os from "os";
import * as fs from "fs";

export function expandHomeDir(p: string): string {
  if (p[0] === "~") {
    return path.join(os.homedir(), p.slice(1));
  } else {
    return p;
  }
}

// version of fs.existsSync && fs.lstatSync that doesn't crash on "operation not permitted" errors
function isDir(p: string): boolean {
  try {
    return fs.existsSync(p) && fs.lstatSync(p).isDirectory();
  } catch (e) {
    return false;
  }
}

export function makeFileCompletions(
  input: string,
  ext?: string,
  cwd?: string,
): string[] {
  input = expandHomeDir(input);
  const p = path.resolve(cwd ?? process.cwd(), input);
  const parentDir = path.dirname(p);
  try {
    if (!fs.existsSync(parentDir)) {
      return [];
    }

    if (isDir(p)) {
      return fs
        .readdirSync(p)
        .filter((f) => {
          return (
            (typeof ext === "undefined" ||
              f.endsWith(ext) ||
              !f.includes(".")) &&
            !f.startsWith(".")
          );
        })
        .map((f) => {
          if (isDir(path.join(p, f))) {
            return f + "/";
          } else {
            return f;
          }
        });
    }

    const file = path.basename(p);

    return fs
      .readdirSync(parentDir)
      .filter((f) => {
        return (
          f.startsWith(file) &&
          (typeof ext === "undefined" || f.endsWith(ext) || !f.includes("."))
        );
      })
      .map((f) => {
        if (isDir(path.join(parentDir, f))) {
          return f.slice(file.length) + "/";
        } else {
          return f.slice(file.length);
        }
      })
      .filter((f) => !(f === "/" && input.endsWith("/")));
  } catch (ignored) {
    // access denied or similar
    return [];
  }
}

import type { ChildProcess } from "child_process";

/**
 * Waits for the given process to terminate, and returns its stdout.
 * On crash or non-zero exit code, throws an error with the given message.
 */
export function waitForProcess(
  msg: string,
  proc: ChildProcess,
): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let stderr = "";
    let stdout = "";
    proc.stdout?.on("data", (data) => {
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

/**
 * Ansi aware version of `str.slice(start, end)`.
 * Returns a string where the ansi-striped length is between `start` and `end`, while making sure to not cut off any ansi escape sequences and properly ending all ansi codes.
 */
export function ansiAwareSlice(str: string, start: number, end: number) {
  let inEscape = false;
  let escape = "";
  let out = "";
  let visible = 0;
  let escapeSequences = ""; // To store all escape sequences encountered

  for (let i = 0; i < str.length; i++) {
    const char = str[i];
    if (char === "\x1B") {
      inEscape = true;
      escape += char;
    } else if (inEscape) {
      escape += char;
      if (char.match(/[A-Za-z]/)) {
        inEscape = false;
        escapeSequences += escape; // Add the escape sequence to the collection
        out += escape;
        escape = "";
      }
    } else {
      if (visible >= start && visible < end) {
        out += char;
      }
      visible++;
    }
  }

  // Append all escape sequences to ensure formatting is reset or maintained
  out += escapeSequences;

  return out;
}
