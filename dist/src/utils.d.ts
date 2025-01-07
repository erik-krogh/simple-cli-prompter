/// <reference types="node" />
import type { ChildProcess } from "child_process";
import type { StringOrChoice } from "./index.js";
export declare function renderChoice(choice: StringOrChoice, selected?: boolean, input?: string, arrowSelected?: boolean): string;
/**
 * Holds if `substr` is a subsequence of `str`.
 */
export declare function hasSubsequence(str: string, sequence: string, caseNormalize?: boolean): boolean;
export declare function filterAndSortChoices(choices: StringOrChoice[], input: string): StringOrChoice[];
export declare function highlightSubsequence(message: string, typed: string): string;
export declare function expandHomeDir(p: string): string;
export declare function makeFileCompletions(input: string, ext?: string, cwd?: string): string[];
/**
 * Waits for the given process to terminate, and returns its stdout.
 * On crash or non-zero exit code, throws an error with the given message.
 */
export declare function waitForProcess(msg: string, proc: ChildProcess): Promise<string>;
/**
 * Ansi aware version of `str.slice(start, end)`.
 * Returns a string where the ansi-striped length is between `start` and `end`, while making sure to not cut off any ansi escape sequences and properly ending all ansi codes.
 */
export declare function ansiAwareSlice(str: string, start: number, end: number): string;
/**
 * Wraps the function `fn` such that it is called `ms` milliseconds after the last call to the returned function.
 * Multiple calls within `ms` milliseconds will only result in one call.
 * Calls that are more than `ms` milliseconds apart will result in multiple calls.
 */
export declare function debounce(fn: () => void, ms: number): () => void;
/** Calculates the displayed length (in columns) of a string, accounting for ANSI codes and wide characters. */
export declare function displayLength(str: string): number;
