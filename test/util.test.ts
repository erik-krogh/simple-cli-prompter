import { expect } from "chai";
import color from "ansi-colors";

import * as search from "../src/utils.js";

const highlight = (str: string) => color.cyan.bold.underline(str);

describe("highlighting", function () {
  function test(str: string, input: string, expected: string) {
    const actual = search.highlightSubsequence(str, input);
    console.log("Expected: ", expected);
    console.log("Actual: ", actual);
    expect(actual).to.equal(expected);
  }

  it("should should correctly highlight sections of string", function () {
    let longStr = "foo this is a text bar";
    let input = "foobar";

    let expected = highlight("foo") + " this is a text " + highlight("bar");
    test(longStr, input, expected);
  });

  it("should work on another search string", function () {
    let longStr = "foo this is a text bar";
    const input = "this text";

    const expected =
      "foo " + highlight("this ") + "is a " + highlight("text") + " bar";
    test(longStr, input, expected);
  });

  it("should work with seven", function () {
    const longStr = "seven";
    const input = "ee";

    const expected = "s" + highlight("e") + "v" + highlight("e") + "n";
    test(longStr, input, expected);
  });

  it("should work with repeated chars", function () {
    const longStr = "Missing import";
    const input = "misi";

    const expected = highlight("Mis") + "s" + highlight("i") + "ng import";
    test(longStr, input, expected);
  });

  it("should match on casing when possible", function () {
    const longStr = "microsoft/TypeScript";

    let input = "miType";

    let expected = highlight("mi") + "crosoft/" + highlight("Type") + "Script";
    test(longStr, input, expected);

    input = "mit";
    expected = highlight("mi") + "crosof" + highlight("t") + "/TypeScript";
    test(longStr, input, expected);

    input = "miT";
    expected = highlight("mi") + "crosoft/" + highlight("T") + "ypeScript";
    test(longStr, input, expected);
  });
});
