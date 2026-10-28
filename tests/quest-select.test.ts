import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { selectQuestIds } from "../lib/quest-select";

const pool = ["a", "b", "c", "d", "e"];

describe("selectQuestIds", () => {
  it("uses only unused quests when the pool is large enough", () => {
    const picked = selectQuestIds({
      allQuestIds: pool,
      playerHistory: [],
      usedInGame: ["a", "b"],
      count: 2,
      random: () => 0,
    });
    assert.equal(picked.length, 2);
    assert.ok(picked.every((id) => !["a", "b"].includes(id)));
    assert.equal(new Set(picked).size, 2);
  });

  it("duplicates across players only after unique quests are exhausted", () => {
    const picked = selectQuestIds({
      allQuestIds: pool,
      playerHistory: [],
      usedInGame: ["a", "b", "c", "d"],
      count: 3,
      random: () => 0,
    });
    assert.equal(picked.length, 3);
    assert.ok(picked.includes("e"));
    const dupes = picked.filter((id) => id !== "e");
    assert.equal(dupes.length, 2);
    assert.ok(dupes.every((id) => ["a", "b", "c", "d"].includes(id)));
  });

  it("never gives a player a quest they already held", () => {
    assert.throws(
      () =>
        selectQuestIds({
          allQuestIds: pool,
          playerHistory: pool,
          usedInGame: [],
          count: 1,
        }),
      /not already had/,
    );

    const picked = selectQuestIds({
      allQuestIds: pool,
      playerHistory: ["a", "b", "c", "d"],
      usedInGame: pool,
      count: 1,
      random: () => 0,
    });
    assert.deepEqual(picked, ["e"]);
  });
});
