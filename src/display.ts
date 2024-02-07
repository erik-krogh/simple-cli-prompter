import stripAnsi from "strip-ansi";

function render(lines: string[], cursor: number = 0) {
  let str = "";
  // move the cursor to the far left
  str += "\x1B[0G";
  // Clear the terminal from the current cursor position to the end of the screen
  str += "\x1B[J";

  // render every line
  lines.forEach((line, i) => {
    str += line;
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
  str += "\x1B[" + cursor + "C";

  process.stdout.write(str);
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

export function startDisplay(host: DisplayHost): Display {
  let input = "";
  let cursor = 0;
  let stopped = false;

  function update() {
    if (stopped) {
      return;
    }
    const printed = host.print();
    render(
      [
        printed.prefix + input + (printed.suffix ?? ""),
        ...(printed.lines ?? []),
      ],
      cursor + stripAnsi(printed.prefix).length,
    );
  }

  update();

  const { resolve, promise } = mkPromise<string>();

  const done: (result: string) => void = function (result: string) {
    if (stopped) {
      return;
    }
    handlers.splice(handlers.indexOf(handler), 1);
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
