<h1>Simple CLI prompter <a href="https://npmjs.org/package/simple-cli-prompter"><img src="https://img.shields.io/npm/v/simple-cli-prompter.svg" alt="version"></a></h1>

This repo contains simple utility methods for promting the user for input in a CLI application.
There is deliberately only a few different types of prompts that behave consistently and are easy to use (both for the end-user and the developer).

When there are options to select you can always type to search for the option you want.  
The search is case-insensitive and looks for subsequences, e.g. to find the item `This is a test` you can type `is test`, which will match (and highlight) `is` and `test` in the item.

## API

There are 4 methods for prompting users for input.

### `ask`

```TypeScript
export type Choice = { message?: string; name: string; hint?: string };

export type StringOrChoice = string | Choice;

export async function ask(
  text: string,
  choices?: StringOrChoice[],
): Promise<string>;
```

The `ask` function prompts the user for a string, and if the `choices` parameter is provided, the user can only select one of the provided options.
The selected option is returned as a string.

If using the `Choice` type the `name` field is the value that is returned when the user selects the option, and `message` and `hint` are used to display the option to the user.

### `confirm`

```TypeScript
export async function confirm(
  message: string,
  defaultChoice = true,
  secondsTimeout = 0,
): Promise<boolean>;
```

The `confirm` function prompts the user for a boolean value, and if the `secondsTimeout` parameter is provided the default choice is used after the timeout has passed.

### `file`

```TypeScript
export async function file(text: string, ext?: string, cwd?: string): Promise<string>;
```

The `file` function prompts the user for a file path, and if the `ext` parameter is provided the user can only select files with the provided extension.
`cwd` is used as the base directory for the file path. It defaults to the current working directory.

### `multiple`

```TypeScript
export async function multiple(
  text: string,
  choices: StringOrChoice[],
  requiredAtLeastOne = true,
): Promise<string[]>;
```

Similar to `ask` but allows the user to select multiple options.
Tapping the `space` key toggles the selection of the currently highlighted option.

### `logAbove`

```TypeScript
export function logAbove(str: string): void;
```

There is additionally a utility function `logAbove` that logs a string above current prompting UI.
Simply logging a string using `console.log(...)` will overwrite the prompting UI, so this function has to be used if a user might be actively interacting with a prompt.

## Guidelines for application developers

- Provide options to select from whenever possible.  
  The UI scales to an absurd amount of options, so it's fine to present a UI where there are thousands of options to select from.
- Prepare things in the background using promises.  
  Heavy work can often be prepared in the background. E.g. in the example app (see `exampleApp`) a git repository is cloned in the background while the user is prompted for what to do.
- `async` all the things!
  Any synchronous IO that happens while the user is prompted will block the UI.
