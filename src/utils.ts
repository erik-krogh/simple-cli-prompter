import type { StringOrChoice } from ".";
import * as color from "ansi-colors";

export function renderChoice(
  choice: StringOrChoice,
  selected: boolean,
): string {
  let text;
  if (typeof choice === "string") {
    text = choice;
  } else {
    text = choice.message || choice.name;
    if (choice.hint) {
      text += " " + color.dim(choice.hint);
    }
  }

  if (!selected) {
    return "  " + text;
  } else {
    return color.greenBright("\u276f ") + color.bold.white(text);
  }
}
