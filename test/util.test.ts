import { expect } from "chai";
import dedent from "dedent";
import color from "ansi-colors";

import * as search from "../src/utils.js";

describe("counting non-comment lines", function () {
  it("should should correctly highlight sections of string", function () {
    let longStr = "foo this is a text bar";
    let input = "foobar";

    let expected =
      color.cyan.underline("foo") +
      " this is a text " +
      color.cyan.underline("bar");
    let actual = search.highlightSubsequence(longStr, input);

    console.log("Expected: ", expected);
    console.log("Actual: ", actual);

    expect(actual).to.equal(expected);
  });

  it("should work on another search string", function () {
    let longStr = "foo this is a text bar";
    const input = "this text";

    const expected =
      "foo " +
      color.cyan.underline("this ") +
      "is a " +
      color.cyan.underline("text") +
      " bar";
    const actual = search.highlightSubsequence(longStr, input);

    console.log("Expected: ", expected);
    console.log("Actual: ", actual);

    expect(actual).to.equal(expected);
  });

  it("should work with seven", function () {
    const longStr = "seven";
    const input = "ee";

    const expected =
      "s" + color.cyan.underline("e") + "v" + color.cyan.underline("e") + "n";
    const actual = search.highlightSubsequence(longStr, input);

    console.log("Expected: ", expected);
    console.log("Actual: ", actual);

    expect(actual).to.equal(expected);
  });
});
