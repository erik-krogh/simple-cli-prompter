import * as display from "./display.js";
import * as color from "ansi-colors";
import * as utils from "./utils.js";
import * as search from "./search.js";

const NUM_OF_SHOWN_CHOICES = 10;

export type Choice = { message?: string; name: string; hint?: string };

export type StringOrChoice = string | Choice;

export async function ask(
  text: string,
  choices?: StringOrChoice[],
): Promise<string> {
  text = color.cyan("? ") + color.bold.white(text.trim()) + color.dim(" … ");
  if (!choices) {
    // free form text input
    return await display.startDisplay({
      print: () => ({ prefix: text, lines: [] }),
    });
  }

  let input = "";
  let selectedLine = 0;
  let startOffset = 0;
  const host: display.DisplayHost = {
    print: () => {
      const lines = search
        .filterChoices(choices, input)
        .slice(startOffset, startOffset + NUM_OF_SHOWN_CHOICES);
      return {
        prefix: text,
        lines: lines.map((choice, i) =>
          utils.renderChoice(choice, i === selectedLine),
        ),
      };
    },
    inputChanged: (newInput) => {
      input = newInput;
      const NUM_ACTIVE_CHOICES = search.filterChoices(choices, input).length;
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
      const NUM_ACTIVE_CHOICES = search.filterChoices(choices, input).length;
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

  // TODO: Underline the choices, sort the choices.

  await display.startDisplay(host);

  const selected = search
    .filterChoices(choices, input)
    .slice(startOffset, startOffset + NUM_OF_SHOWN_CHOICES)[selectedLine];

  return typeof selected === "string" ? selected : selected.name;
}

export async function confirm(
  message: string,
  defaultChoice = true,
  secondsTimeout = 0,
): Promise<boolean> {
  throw new Error("TODO: Not implemented");
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
  // 15
  console.log(
    await ask("Select one of these?", [
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
    ]),
  );
})();
