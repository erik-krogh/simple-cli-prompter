import stripAnsi from "strip-ansi";

// how many lines down we've moved the cursor. Used to move back up before rendering.
let linesDown: number = 0;

function render(lines: string[], cursor: number = 0) {
  let str = "";
  // if we have moved down some lines, move back up
  if (linesDown > 0) {
    str += "\x1B[" + linesDown + "A";
  }
  // move the cursor to the far left
  str += "\x1B[0G";
  // Clear the terminal from the current cursor position to the end of the screen
  str += "\x1B[J";

  const maxLength = process.stdout.columns || 80;

  // render every line
  lines.forEach((line, i) => {
    str += limitLengthAnsiAware(line, 0, maxLength);
    if (i !== lines.length - 1) {
      str += "\n";
    }
  });

  // Move the cursor back to the top
  if (lines.length > 1) {
    str += "\x1B[" + (lines.length - 1) + "F";
  } else {
    // move to the far left again
    str += "\x1B[0G";
  }

  // now move the cursor
  if (cursor > maxLength) {
    linesDown = Math.floor(cursor / maxLength);
    str += "\x1B[" + (cursor % maxLength) + "C";
    str += "\x1B[" + linesDown + "B";
  } else {
    linesDown = 0;
    str += "\x1B[" + cursor + "C";
  }

  process.stdout.write(str);
}

/**
 * Ansi aware version of `str.slice(start, end)`.
 * Returns a string where the ansi-striped length is between `start` and `end`, while making sure to not cut off any ansi escape sequences and properly ending all ansi codes.
 */
function limitLengthAnsiAware(str: string, start: number, end: number) {
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
        if (visible >= start && visible < end) {
          out += escape;
        }
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

const handlers: ((char: string) => void)[] = [];
process.stdin.on("data", (key: string) => {
  // Ctrl-C is very hardcoded, to make sure it always works
  if (key === "\u0003") {
    process.stdout.write("\x1B[?25h"); // show the cursor
    process.exit(0);
  }
  handlers.forEach((handler) => {
    // if ordinary keyboard char, extended ascii, special char, unicode, etc. handle one by one
    if (/^[\x20-\x7E\u00A0-\uFFFF]+$/.test(key)) {
      for (let i = 0; i < key.length; i++) {
        handler(key[i]);
      }
    } else {
      // might be an escape sequence, handle as one
      handler(key);
    }
  });
});

export type DisplayHost = {
  print: () => {
    prefix: string; // the prefix to show before the input string
    suffix?: string; // the suffix to show after the input string
    lines?: string[]; // the lines to show below the input string
  };
  inputChanged?: (input: string) => void; // called when the input changes
  handleKey?: (key: string, display: Display) => boolean; // called when a key is pressed, return true to stop the default action
};

export type Display = {
  promise: Promise<string>;
  stop: () => void;
  update: () => void;
  setInput: (input: string) => void;
  isStopped: () => boolean;
};

// make sure `update()` is called when the terminal is resized
let currentUpdate: (() => void) | undefined;
process.stdout.on("resize", () => {
  if (currentUpdate) {
    currentUpdate();
  }
});

export function startDisplay(host: DisplayHost): Display {
  let input = "";
  let cursor = 0;
  let stopped = false;

  function update() {
    if (stopped) {
      return;
    }
    const printed = host.print();

    // The first line is special, that's the one that has the cursor.
    // We show the hint, only if there is space on the first line (cutting of the last part of the hint if necessary).
    // If the line is still too long, we split it across multiple lines (ansi code aware).
    let firstLine = printed.prefix + input + (printed.suffix ?? "");
    const maxLength = process.stdout.columns || 80;
    if (stripAnsi(printed.prefix + input).length > maxLength) {
      firstLine = printed.prefix + input;
    } else {
      firstLine = limitLengthAnsiAware(printed.prefix + input + (printed.suffix ?? ""), 0, maxLength)
    }
    const firstLines: string[] = [];
    if (stripAnsi(firstLine).length < maxLength) {
      firstLines.push(firstLine);
    } else {
      // split into multiple lines
      const numLines = Math.ceil(stripAnsi(firstLine).length / maxLength);
      for (let i = 0; i < numLines; i++) {
        firstLines.push(
          limitLengthAnsiAware(firstLine, i * maxLength, (i + 1) * maxLength),
        );
      }
    }

    render(
      [...firstLines, ...(printed.lines ?? [])],
      cursor + stripAnsi(printed.prefix).length,
    );
  }

  currentUpdate = update;

  update();

  const { resolve, promise } = mkPromise<string>();

  const done: (result: string) => void = function (result: string) {
    if (stopped) {
      return;
    }
    handlers.splice(handlers.indexOf(handler), 1);
    // it's the callers responsibility to print the result. We reset the display and clear the prompting UI.
    if (linesDown > 0) {
      // move up again
      process.stdout.write("\x1B[" + linesDown + "A");
    }
    process.stdout.write("\x1B[1000C\x1B[J\n"); // move to the end of the line, clear the screen, and start a new line
    process.stdin.setRawMode(false);
    process.stdin.pause();
    stopped = true;
    resolve(result);
  };

  const display = {
    promise,
    stop: () => done(""),
    update,
    setInput: (newInput: string) => {
      input = newInput;
      cursor = input.length;
      host.inputChanged?.(input);
      update();
    },
    isStopped: () => stopped,
  } satisfies Display;

  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");

  function handler(char: string) {
    if (host.handleKey && host.handleKey(char, display)) {
      update();
      return;
    }

    const oldInput = input;
    // left arrow, cursor left
    if (char === "\u001b[D") {
      cursor = Math.max(0, cursor - 1);
    }
    // right arrow, cursor right
    else if (char === "\u001b[C") {
      cursor = Math.min(input.length, cursor + 1);
    }
    // backspace, remove char at cursor
    else if (char === "\u007f") {
      input = input.slice(0, cursor - 1) + input.slice(cursor);
      cursor = Math.max(0, cursor - 1);
    }
    // delete, remove char after cursor
    else if (char === "\u001b[3~") {
      input = input.slice(0, cursor) + input.slice(cursor + 1);
    }
    // ctrl + a, move cursor to start
    else if (char === "\u0001") {
      cursor = 0;
    }
    // ctrl + e, move cursor to end
    else if (char === "\u0005") {
      cursor = input.length;
    }
    // if unknown escape sequence, ignore
    else if (char.startsWith("\u001b")) {
      // ignore
    }
    // enter === done
    else if (char === "\r") {
      done(input);
      return;
    }
    // plain ascii char, add to input (at cursor position)
    else if (char.length === 1) {
      input = input.slice(0, cursor) + char + input.slice(cursor);
      cursor++;
    } else {
      // fail hard, I don't know what to do with this char
      throw new Error(
        "Unknown char: " +
          char +
          " with code: " +
          char.charCodeAt(0) +
          " and length: " +
          char.length,
      );
    }

    if (input !== oldInput) {
      host.inputChanged && host.inputChanged(input);
    }

    update();
  }

  handlers.push(handler);

  return display;
}

function mkPromise<T>(): {
  promise: Promise<T>;
  resolve: (value: T) => void;
} {
  let resolve: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve: resolve! };
}
