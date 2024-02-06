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
  let selectedLine = 0;
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
      // up/down arrow, modify line number
      else if (key === "\u001b[A" || key === "\u001b[B") {
        selectedLine += key === "\u001b[A" ? -1 : 1;
        const NUM_ACTIVE_CHOICES = utils.filterAndSortChoices(
          choices,
          input,
        ).length;
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
        return true;
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
    }
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
  let answer : boolean | undefined = undefined;

  const text = color.cyan("? ") + color.bold.white(message.trim()) + color.dim(" (Y/n) · ");

  const host : display.DisplayHost = {
    print: () => ({
      prefix: text + color.green(defaultChoice + "") + " " + "\x1B[?25l", // hide cursor
      suffix: secondsTimeout > 0 ? color.dim(" defaulting to " + defaultChoice + " in " + secondsTimeout + " seconds") : "",
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

  if (secondsTimeout > 0) {
    (async () => {
      while (secondsTimeout > 0 && answer === undefined) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
        secondsTimeout--;
        if (answer === undefined) {
          disp.update();
        }
      }
      if (answer === undefined) {
        answer = defaultChoice;
        disp.stop();
      }
    })();
  }

  await disp.promise;

  // move up one line, clear the console, print "text" + selected, and show the cursor
  process.stdout.write("\x1B[1A\x1B[J" + text + color.cyan(answer + "") + "\n\x1B[?25h");

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
  const c = await confirm("Are you sure?", false, 5);
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
