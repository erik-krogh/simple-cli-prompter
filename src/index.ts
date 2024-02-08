import * as display from "./display.js";
import color from "ansi-colors";
import * as utils from "./utils.js";
import * as path from "path";

const NUM_OF_SHOWN_CHOICES = 10;

export type Choice = { message?: string; name: string; hint?: string };

export type StringOrChoice = string | Choice;

function startText(text: string) {
  return color.cyan("? ") + text;
}

function printEndText(text: string, answer: string) {
  text = text.replace(color.cyan("? "), color.green("✔ "));
  // move up one line, clear the console, print "text" + selected, and show the cursor
  process.stdout.write(
    "\x1B[1A\x1B[J" + text + " " + color.cyan(answer) + "\n\x1B[?25h",
  );
}

/**
 * Prompts the user for a string, and if the `choices` parameter is provided, the user can only select one of the provided options.
 * The selected option is returned as a string.
 * If using the `Choice` type the `name` field is the value that is returned when the user selects the option, and `message` and `hint` are used to display the option to the user.
 */
export async function ask(
  text: string,
  choices?: StringOrChoice[],
): Promise<string> {
  text = startText(color.bold.white(text.trim()) + color.dim(" … "));
  if (choices && choices.length === 0) {
    throw new Error("No choices provided");
  }
  if (!choices) {
    // free form text input
    const answer = await (currentDisplay = display.startDisplay({
      print: () => ({ prefix: text }),
    })).promise;

    printEndText(text, answer);

    return answer;
  }

  let input = "";
  let selectedLine = 0;
  let startOffset = 0;
  const host: display.DisplayHost = {
    print: () => {
      return printChoices(choices, input, startOffset, text, (choice, index) =>
        utils.renderChoice(choice, index === selectedLine, input),
      );
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
        ({ selectedLine, startOffset } = handleKeyUpDown(
          selectedLine,
          key,
          choices,
          input,
          startOffset,
        ));
        return true;
      }
      return false;
    },
    inputChanged: (newInput) => {
      input = newInput;
      ({ selectedLine, startOffset } = handleNewInput(
        selectedLine,
        startOffset,
        choices,
        input,
      ));
    },
  };

  await (currentDisplay = display.startDisplay(host)).promise;

  const selected = utils
    .filterAndSortChoices(choices, input)
    .slice(startOffset, startOffset + NUM_OF_SHOWN_CHOICES)[selectedLine];

  const shownResult =
    typeof selected === "string" ? selected : selected.message || selected.name;

  printEndText(text, shownResult);

  return typeof selected === "string" ? selected : selected.name;
}

/** Prompts the user for a boolean value, and if the `secondsTimeout` parameter is provided the default choice is used after the timeout has passed. */
export async function confirm(
  message: string,
  defaultChoice = true,
  secondsTimeout = 0,
): Promise<boolean> {
  let answer: boolean | undefined = undefined;

  const text = startText(
    color.bold.white(message.trim()) + color.dim(" (Y/n) · "),
  );

  const host: display.DisplayHost = {
    print: () => ({
      prefix: text + color.green(defaultChoice + "") + " " + "\x1B[?25l", // hide cursor
      suffix:
        secondsTimeout > 0
          ? color.dim(
              " defaulting to " +
                defaultChoice +
                " in " +
                secondsTimeout +
                " seconds",
            )
          : "",
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
  currentDisplay = disp;

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

  printEndText(text, answer + "");

  return answer!;
}

/**
 * Prompts the user for a file path, and if the `ext` parameter is provided the user can only select files with the provided extension.
 * `cwd` is used as the base directory for the file path. It defaults to the current working directory.
 */
export async function file(
  text: string,
  ext?: string,
  cwd?: string,
): Promise<string> {
  text = startText(color.bold.white(text.trim()) + color.dim(" … "));

  let input = "";

  const host = {
    print: () => {
      const completionsHints =
        input === ""
          ? []
          : utils
              .makeFileCompletions(input, ext, cwd)
              .map((c) => input + c)
              .map((c) => path.basename(c) + (c.endsWith("/") ? "/" : ""))
              .filter((s) => s)
              .slice(0, NUM_OF_SHOWN_CHOICES);
      return {
        prefix: text,
        suffix: color.dim(" You can use tab completion"),
        lines: completionsHints,
      };
    },
    handleKey: (key, display) => {
      // tab -> trigger completion
      if (key === "\t") {
        if (input === "") {
          return true;
        }
        const completions = utils.makeFileCompletions(input, ext, cwd);
        if (completions.length === 1) {
          const completion = completions[0];
          display.setInput(input + completion);
        } else if (completions.length > 1) {
          let commonStr = "";
          let i = 0;

          const minLen = Math.min(...completions.map((c) => c.length));

          outer: while (i < minLen) {
            const char = completions[0][i];
            for (const completion of completions.slice(1)) {
              if (completion.length <= i || completion[i] !== char) {
                break outer;
              }
            }
            commonStr += char;
            i++;
          }
          if (commonStr.length > 0) {
            display.setInput(input + commonStr);
          }
        }
        return true;
      }
      return false;
    },
    inputChanged: (newInput) => {
      input = newInput;
    },
  } satisfies display.DisplayHost;

  const disp = display.startDisplay(host);
  currentDisplay = disp;

  const res = await disp.promise;

  printEndText(text, res);

  return res;
}

/*
 * Similar to `ask` but allows the user to select multiple options.
 * Tapping the `space` key toggles the selection of the currently highlighted option.
 */
export async function multiple(
  text: string,
  choices: StringOrChoice[],
  requiredAtLeastOne = true,
): Promise<string[]> {
  text = startText(color.bold.white(text.trim()) + color.dim(" … "));
  if (choices.length === 0) {
    throw new Error("No choices provided");
  }

  let input = "";
  let selectedLine = 0;
  let startOffset = 0;
  const selected = new Set<StringOrChoice>();

  const host: display.DisplayHost = {
    print: () => {
      // add a green bold checkmark to the selected choices, and a dimmed (default) to the rest.
      const render = (choice: StringOrChoice, index: number) => {
        const isSelected = selected.has(choice);
        const prefix = isSelected ? color.green.bold("✔ ") : color.dim("✔ ");

        return (
          prefix +
          utils.renderChoice(choice, index === selectedLine, input, false)
        );
      };

      return {
        ...printChoices(choices, input, startOffset, text, render),
        suffix: color.dim("  (Use <space> to select, <return> to submit)"),
      };
    },
    handleKey: (key) => {
      if (key === "\r") {
        if (requiredAtLeastOne && selected.size === 0) {
          process.stdout.write("\x07"); // beep
          return true; // prevent default action, which is to close the display
        }
      }
      // up/down arrow, modify line number
      else if (key === "\u001b[A" || key === "\u001b[B") {
        ({ selectedLine, startOffset } = handleKeyUpDown(
          selectedLine,
          key,
          choices,
          input,
          startOffset,
        ));
        return true;
      }
      // space: toggle selection
      else if (key === " ") {
        const selectedChoice = utils
          .filterAndSortChoices(choices, input)
          .slice(startOffset, startOffset + NUM_OF_SHOWN_CHOICES)[selectedLine];

        if (selected.has(selectedChoice)) {
          selected.delete(selectedChoice);
        } else {
          selected.add(selectedChoice);
        }
        return true;
      }
      return false;
    },
    inputChanged: (newInput) => {
      input = newInput;
      ({ selectedLine, startOffset } = handleNewInput(
        selectedLine,
        startOffset,
        choices,
        input,
      ));
    },
  };

  await (currentDisplay = display.startDisplay(host)).promise;

  const selectedChoices = choices.filter((c) => selected.has(c)); // preserves the original order

  printEndText(
    text,
    selectedChoices.length === 0
      ? color.italic("(none)")
      : selectedChoices
          .map((c) => (typeof c === "string" ? c : c.message || c.name))
          .join(", "),
  );

  return selectedChoices.map((c) => (typeof c === "string" ? c : c.name));
}

let currentDisplay: display.Display | undefined;

/**
 * Logs a string above current prompting UI.
 * Simply logging a string using `console.log(...)` will overwrite the prompting UI, so this function has to be used if a user might be actively interacting with a prompt.
 */
export function logAbove(str: string) {
  if (currentDisplay?.isStopped()) {
    console.log(str);
  } else {
    // move left to the start of the line, and clear all content below
    process.stdout.write("\x1b[1G\x1b[J");
    process.stdout.write(str + "\n");
    currentDisplay?.update();
  }
}

function printChoices(
  choices: StringOrChoice[],
  input: string,
  startOffset: number,
  text: string,
  render: (c: StringOrChoice, index: number) => string,
) {
  const lines = utils
    .filterAndSortChoices(choices, input)
    .slice(startOffset, startOffset + NUM_OF_SHOWN_CHOICES)
    .map((choice, i) => render(choice, i));
  if (lines.length === 0) {
    lines.push(color.magenta("No matching choices"));
  }
  return {
    prefix: text,
    lines: lines,
  };
}

function handleNewInput(
  selectedLine: number,
  startOffset: number,
  choices: StringOrChoice[],
  input: string,
) {
  const NUM_ACTIVE_CHOICES = utils.filterAndSortChoices(choices, input).length;
  if (NUM_ACTIVE_CHOICES === 0) {
    startOffset = 0;
    selectedLine = 0;
    return { selectedLine, startOffset };
  }
  if (startOffset + NUM_OF_SHOWN_CHOICES > NUM_ACTIVE_CHOICES) {
    startOffset = Math.max(0, NUM_ACTIVE_CHOICES - NUM_OF_SHOWN_CHOICES);
  }
  if (selectedLine >= NUM_ACTIVE_CHOICES) {
    selectedLine = NUM_ACTIVE_CHOICES - 1;
  }
  return { selectedLine, startOffset };
}

function handleKeyUpDown(
  selectedLine: number,
  key: string,
  choices: StringOrChoice[],
  input: string,
  startOffset: number,
) {
  selectedLine += key === "\u001b[A" ? -1 : 1;
  const NUM_ACTIVE_CHOICES = utils.filterAndSortChoices(choices, input).length;
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
    if (startOffset + NUM_OF_SHOWN_CHOICES < NUM_ACTIVE_CHOICES) {
      startOffset += 1;
    }
  }
  return { selectedLine, startOffset };
}
