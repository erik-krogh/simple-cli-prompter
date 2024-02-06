import * as display from "./display.js";
import * as color from "ansi-colors";
import * as utils from "./utils.js";

const NUM_OF_SHOWN_CHOICES = 10;

export type Choice = { message?: string; name: string; hint?: string };

export type StringOrChoice = string | Choice;

export async function ask(
  text: string,
  choices?: StringOrChoice[],
): Promise<string> {
  text = color.cyan("? ") + color.bold.white(text.trim()) + color.dim(" … ");
  if (choices && choices.length === 0) {
    throw new Error("No choices provided");
  }
  if (!choices) {
    // free form text input
    return await (display.startDisplay({
      print: () => ({ prefix: text, lines: [] }),
    }).promise);
  }

  let input = "";
  let selectedLine = 0; // TODO: Move line-change code out of display and into here.
  let startOffset = 0;
  const host: display.DisplayHost = {
    print: () => {
      const lines = utils
        .filterAndSortChoices(choices, input)
        .slice(startOffset, startOffset + NUM_OF_SHOWN_CHOICES)
        .map((choice, i) =>
          utils.renderChoice(choice, i === selectedLine, input),
        );
      if (lines.length === 0) {
        lines.push(color.magenta("No matching choices"));
      }
      return {
        prefix: text,
        lines: lines,
      };
    },
    handleKey: (key) => {
      if (key === "\r") {
        if (utils.filterAndSortChoices(choices, input).length === 0) {
          process.stdout.write("\x07"); // beep
          return true; // prevent default action, which is to close the display
        }
      }
      return false;
    },
    inputChanged: (newInput) => {
      input = newInput;
      const NUM_ACTIVE_CHOICES = utils.filterAndSortChoices(
        choices,
        input,
      ).length;
      if (NUM_ACTIVE_CHOICES === 0) {
        startOffset = 0;
        selectedLine = 0;
        return;
      }
      if (startOffset + NUM_OF_SHOWN_CHOICES > NUM_ACTIVE_CHOICES) {
        startOffset = Math.max(0, NUM_ACTIVE_CHOICES - NUM_OF_SHOWN_CHOICES);
      }
      if (selectedLine >= NUM_ACTIVE_CHOICES) {
        selectedLine = NUM_ACTIVE_CHOICES - 1;
      }
    },
    lineChanged: (line) => {
      const NUM_ACTIVE_CHOICES = utils.filterAndSortChoices(
        choices,
        input,
      ).length;
      selectedLine += line;
      if (selectedLine < 0) {
        selectedLine = 0;
        if (startOffset > 0) {
          startOffset -= 1;
        }
      }
      if (
        NUM_ACTIVE_CHOICES !== NUM_OF_SHOWN_CHOICES &&
        selectedLine >= NUM_ACTIVE_CHOICES
      ) {
        selectedLine = NUM_ACTIVE_CHOICES - 1;
      } else if (selectedLine >= NUM_OF_SHOWN_CHOICES) {
        selectedLine = NUM_OF_SHOWN_CHOICES - 1;
        if (startOffset + NUM_OF_SHOWN_CHOICES < choices.length) {
          startOffset += 1;
        }
      }
    },
  };

  await (display.startDisplay(host).promise);

  const selected = utils
    .filterAndSortChoices(choices, input)
    .slice(startOffset, startOffset + NUM_OF_SHOWN_CHOICES)[selectedLine];

  const shownResult = typeof selected === "string" ? selected : selected.message || selected.name;

  // move up one line, clear the console, print "text" + selected
  process.stdout.write("\x1B[1A\x1B[J" + text + color.cyan(shownResult) + "\n");

  return typeof selected === "string" ? selected : selected.name;
}

export async function confirm(
  message: string,
  defaultChoice = true,
  secondsTimeout = 0,
): Promise<boolean> {
  if (secondsTimeout !== 0){
    throw new Error("TODO: Not implemented");
  }

  let answer : boolean | undefined = undefined;

  const hideCursorAnsi = "\x1B[?25l";

  const text = color.cyan("? ") + color.bold.white(message.trim()) + color.dim(" (Y/n) · ");

  const host : display.DisplayHost = {
    print: () => ({
      prefix: text + color.green(defaultChoice + "") + " " + hideCursorAnsi,
      lines: [],
    }),
    handleKey: (key, display) => {
      if (key === "y" || key === "Y") {
        answer = true;
        display.stop();
      } else if (key === "n" || key === "N") {
        answer = false;
        display.stop();
      } else if (key === "\r") {
        answer = defaultChoice;
        display.stop();
      }
      return true;
    },
  };

  const disp = display.startDisplay(host);

  await disp.promise;

  // move up one line, clear the console, print "text" + selected
  process.stdout.write("\x1B[1A\x1B[J" + text + color.cyan(answer + "") + "\n");

  return answer!;
}

export async function file(message: string, ext?: string): Promise<string> {
  throw new Error("TODO: Not implemented");
}

export async function multiple(
  text: string,
  choices: StringOrChoice[],
  requiredAtLeastOne = true,
): Promise<string[]> {
  throw new Error("TODO: Not implemented");
}

export function logAbove(str: string) {
  throw new Error("TODO: Not implemented");
}

// if main
(async function () {
  const c = await confirm("Are you sure?", true);
  console.log(color.bold.white(c + ""));
  // 15
  console.log(
    await ask(
      "Select one of these?",
      [
        "one",
        "two",
        "three",
        "four",
        "five",
        "six",
        "seven",
        "eight",
        "nine",
        "ten",
        "eleven",
        "twelve",
        "thirteen",
        "fourteen",
        "fifteen",
      ].map((s) => ({
        name: s,
        message: s + " (msg)",
        hint: "hint",
      })),
    ),
  );
})();
