export type Choice = {
    message?: string;
    name: string;
    hint?: string;
};
export type StringOrChoice = string | Choice;
/**
 * Prompts the user for a string, and if the `choices` parameter is provided, the user can only select one of the provided options.
 * The selected option is returned as a string.
 * If using the `Choice` type the `name` field is the value that is returned when the user selects the option, and `message` and `hint` are used to display the option to the user.
 */
export declare function ask(text: string, choices?: StringOrChoice[]): Promise<string>;
/** Prompts the user for a boolean value, and if the `secondsTimeout` parameter is provided the default choice is used after the timeout has passed. */
export declare function confirm(message: string, defaultChoice?: boolean, secondsTimeout?: number): Promise<boolean>;
/**
 * Prompts the user for a file path, and if the `ext` parameter is provided the user can only select files with the provided extension.
 * `cwd` is used as the base directory for the file path. It defaults to the current working directory.
 */
export declare function file(text: string, ext?: string, cwd?: string): Promise<string>;
export declare function multiple(text: string, choices: StringOrChoice[], requiredAtLeastOne?: boolean): Promise<string[]>;
/**
 * Logs a string above current prompting UI.
 * Simply logging a string using `console.log(...)` will overwrite the prompting UI, so this function has to be used if a user might be actively interacting with a prompt.
 */
export declare function logAbove(str: string): void;
