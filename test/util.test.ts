import { expect } from "chai";
import color from "ansi-colors";

import * as search from "../src/utils.js";

const highlight = (str: string) => color.cyan.bold.underline(str);

describe("counting non-comment lines", function () {
  it("should should correctly highlight sections of string", function () {
    let longStr = "foo this is a text bar";
    let input = "foobar";

    let expected = highlight("foo") + " this is a text " + highlight("bar");
    let actual = search.highlightSubsequence(longStr, input);

    console.log("Expected: ", expected);
    console.log("Actual: ", actual);

    expect(actual).to.equal(expected);
  });

  it("should work on another search string", function () {
    let longStr = "foo this is a text bar";
    const input = "this text";

    const expected =
      "foo " + highlight("this ") + "is a " + highlight("text") + " bar";
    const actual = search.highlightSubsequence(longStr, input);

    console.log("Expected: ", expected);
    console.log("Actual: ", actual);

    expect(actual).to.equal(expected);
  });

  it("should work with seven", function () {
    const longStr = "seven";
    const input = "ee";

    const expected = "s" + highlight("e") + "v" + highlight("e") + "n";
    const actual = search.highlightSubsequence(longStr, input);

    console.log("Expected: ", expected);
    console.log("Actual: ", actual);

    expect(actual).to.equal(expected);
  });

  it("should work with repeated chars", function () {
    const longStr = "Missing import";
    const input = "misi";

    const expected = highlight("Mis") + "s" + highlight("i") + "ng import";
    const actual = search.highlightSubsequence(longStr, input);

    console.log("Expected: ", expected);
    console.log("Actual: ", actual);

    expect(actual).to.equal(expected);
  });
});
