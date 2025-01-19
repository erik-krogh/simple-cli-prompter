import { ansiAwareSlice, debounce, displayLength } from "./utils.js";
// how many lines down we've moved the cursor. Used to move back up before rendering.
let linesDown = 0;
function render(lines, cursor = 0) {
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
        str += ansiAwareSlice(line, 0, maxLength);
        if (i !== lines.length - 1) {
            str += "\n";
        }
    });
    // Move the cursor back to the top
    if (lines.length > 1) {
        str += "\x1B[" + (lines.length - 1) + "F";
    }
    else {
        // move to the far left again
        str += "\x1B[0G";
    }
    // now move the cursor
    if (cursor > maxLength) {
        linesDown = Math.floor(cursor / maxLength);
        str += "\x1B[" + (cursor % maxLength) + "C";
        str += "\x1B[" + linesDown + "B";
    }
    else {
        linesDown = 0;
        str += "\x1B[" + cursor + "C";
    }
    process.stdout.write(str);
}
function registerHandler(handler) {
    function listener(key) {
        if (Buffer.isBuffer(key)) {
            if (key[0] > 127 && key[1] === void 0) {
                key[0] -= 128;
                key = "\x1b" + String(key);
            }
            else {
                key = String(key);
            }
        }
        else if (key !== void 0 && typeof key !== "string") {
            key = String(key);
        }
        // Ctrl-C is very hardcoded, to make sure it always works
        if (key === "\u0003") {
            handleExit();
            return;
        }
        // if ordinary keyboard char, extended ascii, special char, unicode, etc. handle one by one
        if (/^[\x20-\x7E\u00A0-\uFFFF]+$/.test(key)) {
            for (let i = 0; i < key.length; i++) {
                handler(key[i]);
            }
        }
        else {
            // might be an escape sequence, handle as one
            handler(key);
        }
    }
    process.stdin.on("data", listener);
    return {
        remove: () => process.stdin.off("data", listener),
    };
}
// make sure `update()` is called when the terminal is resized
let currentUpdate;
process.stdout.on("resize", () => {
    if (currentUpdate) {
        currentUpdate();
    }
});
export function startDisplay(host) {
    let input = "";
    let cursor = 0;
    let stopped = false;
    const update = debounce(function () {
        if (stopped) {
            return;
        }
        const printed = host.print();
        // The first line is special, that's the one that has the cursor.
        // We show the hint, only if there is space on the first line (cutting of the last part of the hint if necessary).
        // If the line is still too long, we split it across multiple lines (ansi code aware).
        let firstLine;
        const maxLength = process.stdout.columns || 80;
        if (displayLength(printed.prefix + input) > maxLength) {
            firstLine = printed.prefix + input;
        }
        else {
            firstLine = ansiAwareSlice(printed.prefix + input + (printed.suffix ?? ""), 0, maxLength);
        }
        const firstLines = [];
        if (displayLength(firstLine) < maxLength) {
            firstLines.push(firstLine);
        }
        else {
            // split into multiple lines
            const numLines = Math.ceil(displayLength(firstLine) / maxLength);
            for (let i = 0; i < numLines; i++) {
                firstLines.push(ansiAwareSlice(firstLine, i * maxLength, (i + 1) * maxLength));
            }
        }
        render([...firstLines, ...(printed.lines ?? [])], cursor + displayLength(printed.prefix));
    }, 10);
    currentUpdate = update;
    update();
    const { resolve, promise } = mkPromise();
    const register = registerHandler(handler);
    const done = function (result) {
        if (stopped) {
            return;
        }
        register.remove();
        // it's the callers responsibility to print the result. We reset the display and clear the prompting UI.
        if (linesDown > 0) {
            // move up again
            process.stdout.write("\x1B[" + linesDown + "A");
        }
        process.stdout.write("\x1B[1000C\x1B[J\n"); // move to the end of the line, clear the screen, and start a new line
        if (process.stdin.isTTY)
            process.stdin.setRawMode(false);
        stopped = true;
        resolve(result);
    };
    const display = {
        promise,
        stop: () => done(""),
        update,
        setInput: (newInput) => {
            input = newInput;
            cursor = displayLength(input);
            host.inputChanged?.(input);
            update();
        },
        isStopped: () => stopped,
    };
    if (process.stdin.isTTY)
        process.stdin.setRawMode(true);
    process.stdin.setEncoding("utf8");
    function handler(char) {
        if (host.handleKey && host.handleKey(char, display)) {
            update();
            return;
        }
        const oldInput = input;
        ({ cursor, input } = handleKeyPress(char, cursor, input, done));
        if (input !== oldInput && !stopped && host.inputChanged) {
            host.inputChanged(input);
        }
        update();
    }
    return display;
}
function handleKeyPress(char, cursor, input, done) {
    if (char === "\u001b[D") {
        cursor = Math.max(0, cursor - 1);
    }
    // right arrow, cursor right
    else if (char === "\u001b[C") {
        cursor = Math.min(displayLength(input), cursor + 1);
    }
    // backspace, remove char at cursor
    else if (char === "\u007f" || char === "\b") {
        input = ansiAwareSlice(input, 0, cursor - 1) + ansiAwareSlice(input, cursor);
        cursor = Math.max(0, cursor - 1);
    }
    // delete, remove char after cursor
    else if (char === "\u001b[3~") {
        input = ansiAwareSlice(input, 0, cursor) + ansiAwareSlice(input, cursor + 1);
    }
    // ctrl + a, move cursor to start
    else if (char === "\u0001") {
        cursor = 0;
    }
    // ctrl + e, move cursor to end
    else if (char === "\u0005") {
        cursor = displayLength(input);
    }
    // ctrl + u, delete entire line
    else if (char === "\u0015") {
        input = "";
        cursor = 0;
    }
    // ctrl + k, delete from cursor to end
    else if (char === "\u000b") {
        input = ansiAwareSlice(input, 0, cursor);
    }
    // ctrl + d, or zero-width-space and empty input, exit hard
    else if (char === "\u0004" && input === "") {
        handleExit();
        return { cursor, input };
    }
    // else, if ctrl + d, skip
    else if (char === "\u0004") {
        return { cursor, input };
    }
    // option + right arrow or ctrl + right arrow, move cursor to end of word, or end of string if no match
    else if (char === "\u001b\u001b[C" || char === "\u001b[1;5C") {
        const searchString = ansiAwareSlice(input, cursor);
        const match = searchString.match(/\s/);
        cursor += match && match.index ? displayLength(searchString.slice(0, match.index)) + 1 : displayLength(input) - cursor;
    }
    // option + left arrow or ctrl + left arrow, move cursor to start of word
    else if (char === "\u001b\u001b[D" || char === "\u001b[1;5D") {
        const match = ansiAwareSlice(input, 0, cursor).match(/\S+\s*$/);
        cursor = match ? cursor - displayLength(match[0]) : 0;
    }
    // if unknown escape sequence, ignore
    else if (char.startsWith("\u001b")) {
        // ignore
    }
    // enter === done
    else if (char === "\r") {
        done(input);
        return { cursor, input };
    }
    // plain ascii chars, add to input (at cursor position)
    else {
        input = ansiAwareSlice(input, 0, cursor) + char + ansiAwareSlice(input, cursor);
        cursor += displayLength(char);
    }
    return { cursor, input };
}
function handleExit() {
    process.stdout.write("\x1B[?25h"); // show the cursor
    if (process.stdin.isTTY)
        process.stdin.setRawMode(false);
    // figure out of a SIGINT handler is installed
    if (process.listeners("SIGINT").length === 0) {
        process.exit(0);
    }
    // otherwise, run them.
    for (const listener of process.listeners("SIGINT")) {
        listener("SIGINT");
    }
}
function mkPromise() {
    let resolve;
    const promise = new Promise((res) => {
        resolve = res;
    });
    return { promise, resolve: resolve }; // eslint-disable-line @typescript-eslint/no-non-null-assertion
}
//# sourceMappingURL=display.js.map