import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePastedGameCode, sanitizeCodeWord } from "../lib/code-entry";

describe("parsePastedGameCode", () => {
  it("trims a single word with surrounding whitespace", () => {
    assert.deepEqual(parsePastedGameCode(" MIMIC"), { kind: "word", word: "mimic" });
    assert.deepEqual(parsePastedGameCode("mimic  "), { kind: "word", word: "mimic" });
    assert.deepEqual(parsePastedGameCode("  MiMiC\n"), { kind: "word", word: "mimic" });
  });

  it("fills both words when the paste includes padding", () => {
    assert.deepEqual(parsePastedGameCode("  mimic apple  "), {
      kind: "pair",
      w1: "mimic",
      w2: "apple",
    });
    assert.deepEqual(parsePastedGameCode("MIMICAPPLE"), {
      kind: "pair",
      w1: "mimic",
      w2: "apple",
    });
  });
});

describe("sanitizeCodeWord", () => {
  it("drops whitespace and keeps five letters", () => {
    assert.equal(sanitizeCodeWord(" MIMIC"), "mimic");
    assert.equal(sanitizeCodeWord("mimicapple"), "mimic");
  });
});
