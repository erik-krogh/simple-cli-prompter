/// <reference types="node" />
import type { StringOrChoice } from ".";
export declare function renderChoice(choice: StringOrChoice, selected?: boolean, input?: string, arrowSelected?: boolean): string;
/**
 * Holds if `substr` is a subsequence of `str`.
 */
export declare function hasSubsequence(str: string, sequence: string, caseNormalize?: boolean): boolean;
export declare function filterAndSortChoices(choices: StringOrChoice[], input: string): StringOrChoice[];
export declare function highlightSubsequence(message: string, typed: string): string;
export declare function makeFileCompletions(input: string, ext?: string, cwd?: string): string[];
import * as cp from "child_process";
/**
 * Waits for the given process to terminate, and returns its stdout.
 * On crash or non-zero exit code, throws an error with the given message.
 */
export declare function waitForProcess(msg: string, proc: cp.ChildProcess): Promise<string>;
