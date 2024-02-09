import { expect } from "chai";
import color from "ansi-colors";

import * as utils from "../src/utils.js";

const highlight = (str: string) => color.cyan.bold.underline(str);

describe("highlighting", function () {
  function test(str: string, input: string, expected: string) {
    const actual = utils.highlightSubsequence(str, input);
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

  it("should find consequtive matches when possible", function () {
    const longStr = "microsoft/typescript";

    let input = "script";
    let expected = "microsoft/type" + highlight("script");
    test(longStr, input, expected);

    input = "oftscript";
    expected = "micros" + highlight("oft") + "/type" + highlight("script");
    test(longStr, input, expected);
  });

  function mkRandomHex(len: number) {
    return Array.from({ length: len }, () =>
      Math.floor(Math.random() * 16).toString(16),
    ).join("");
  }

  it("should perform well", function () {
    const startInit = Date.now();

    // fill a list of 100.000 strings that 100 char long random hex strings
    const list = Array.from({ length: 100_000 }, () => mkRandomHex(100));
    // input as a random 10 char hex string
    const input = mkRandomHex(10);

    const endInit = Date.now();
    console.log("Init time: ", endInit - startInit, "ms"); // 672ms on my machine

    // time the search
    const startSort = Date.now();

    const sorted = utils.filterAndSortChoices(list, input);
    console.log("Sorted: ", sorted.length);

    const endSort = Date.now();

    console.log("Time: ", endSort - startSort, "ms"); // 158ms on my machine

    // fail hard if it took more than a second
    expect(endSort - startSort).to.be.lessThan(1000);
  });
});
