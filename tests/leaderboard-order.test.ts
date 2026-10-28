import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  pickFirstFinisher,
  pickLeastProgressPlayer,
  sortLeaderboardPlayers,
} from "../lib/leaderboard-order";

describe("leaderboard order", () => {
  it("ranks the first finisher above a higher or equal score", () => {
    const players = [
      {
        id: "amy",
        name: "Amy",
        score: 3,
        finishedAt: null,
        completedQuests: 3,
      },
      {
        id: "zara",
        name: "Zara",
        score: 2,
        finishedAt: "2026-10-28T12:00:00.000Z",
        completedQuests: 2,
      },
    ];
    const sorted = sortLeaderboardPlayers("FIRST_FINISH_WINS", "FINISHED", players);
    assert.equal(sorted[0]?.id, "zara");
    assert.equal(pickFirstFinisher(players)?.id, "zara");
  });

  it("picks the least progress as the loser, including someone who never finished", () => {
    const players = [
      {
        id: "amy",
        name: "Amy",
        score: 2,
        finishedAt: "2026-10-28T12:00:00.000Z",
        completedQuests: 2,
      },
      {
        id: "opal",
        name: "Opal",
        score: 0,
        finishedAt: null,
        completedQuests: 0,
      },
      {
        id: "ned",
        name: "Ned",
        score: 1,
        finishedAt: null,
        completedQuests: 1,
      },
    ];
    assert.equal(pickLeastProgressPlayer(players)?.id, "opal");
    const sorted = sortLeaderboardPlayers("LAST_FINISH_LOSES", "FINISHED", players);
    assert.equal(sorted.at(-1)?.id, "opal");
    assert.equal(sorted[0]?.id, "amy");
  });

  it("breaks a progress tie by who finished last", () => {
    const players = [
      {
        id: "early",
        name: "Early",
        score: 2,
        finishedAt: "2026-10-28T12:00:00.000Z",
        completedQuests: 2,
      },
      {
        id: "late",
        name: "Late",
        score: 2,
        finishedAt: "2026-10-28T12:05:00.000Z",
        completedQuests: 2,
      },
    ];
    assert.equal(pickLeastProgressPlayer(players)?.id, "late");
  });
});
