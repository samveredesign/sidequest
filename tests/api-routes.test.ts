import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { POST as createGame } from "../app/api/games/route";
import { POST as joinGame } from "../app/api/games/join/route";
import { GET as getGame } from "../app/api/games/[gameId]/route";
import { POST as startGame } from "../app/api/games/[gameId]/start/route";
import { POST as endGame } from "../app/api/games/[gameId]/end/route";
import { POST as acceptJoin } from "../app/api/games/[gameId]/join-requests/[requestId]/accept/route";
import { POST as denyJoin } from "../app/api/games/[gameId]/join-requests/[requestId]/deny/route";
import { GET as viewQuests } from "../app/api/games/[gameId]/players/[otherPlayerId]/quests/route";
import { GET as pollJoin } from "../app/api/join-requests/[requestId]/route";
import { POST as completeQuest } from "../app/api/player-quests/[playerQuestId]/complete/route";
import { POST as failQuest } from "../app/api/player-quests/[playerQuestId]/fail/route";
import { POST as leaveGame } from "../app/api/players/[playerId]/leave/route";
import { POST as submitPlayer } from "../app/api/players/[playerId]/submit/route";
import { sortLeaderboardPlayers } from "../lib/leaderboard-order";
import { prisma } from "../lib/prisma";

type PlayerSession = { id: string; token: string; name: string };
type Created = {
  gameId: string;
  codeWord1: string;
  codeWord2: string;
  host: PlayerSession;
};

const gameIds: string[] = [];

after(async () => {
  if (gameIds.length > 0) {
    await prisma.game.deleteMany({ where: { id: { in: gameIds } } });
  }
  await prisma.$disconnect();
});

function post(url: string, body: unknown, token?: string): Request {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { "x-player-token": token } : {}),
    },
    body: JSON.stringify(body ?? {}),
  });
}

async function read(res: Response): Promise<{ status: number; data: Record<string, unknown> }> {
  const data = (await res.json()) as Record<string, unknown>;
  return { status: res.status, data };
}

async function create(opts: {
  name: string;
  quests: number;
  mode?: "FIRST_FINISH_WINS" | "LAST_FINISH_LOSES";
}): Promise<Created> {
  const res = await createGame(
    post("http://test/api/games", {
      playerName: opts.name,
      durationSeconds: 3600,
      numberOfQuests: opts.quests,
      mode: opts.mode ?? "FIRST_FINISH_WINS",
    }),
  );
  const { status, data } = await read(res);
  assert.equal(status, 200, JSON.stringify(data));
  const game = data.game as { id: string; codeWord1: string; codeWord2: string };
  const player = data.player as { id: string; token: string; name: string };
  gameIds.push(game.id);
  return {
    gameId: game.id,
    codeWord1: game.codeWord1,
    codeWord2: game.codeWord2,
    host: { id: player.id, token: player.token, name: player.name },
  };
}

async function joinLobby(game: Created, name: string): Promise<PlayerSession> {
  const res = await joinGame(
    post("http://test/api/games/join", {
      playerName: name,
      word1: game.codeWord1,
      word2: game.codeWord2,
    }),
  );
  const { status, data } = await read(res);
  assert.equal(status, 200, JSON.stringify(data));
  const player = data.player as { id: string; token: string; name: string };
  assert.ok(player.token);
  return { id: player.id, token: player.token, name: player.name };
}

async function start(game: Created, token = game.host.token) {
  const res = await startGame(post(`http://test/api/games/${game.gameId}/start`, {}, token), {
    params: Promise.resolve({ gameId: game.gameId }),
  });
  return read(res);
}

async function state(gameId: string, token?: string) {
  const res = await getGame(
    new Request(`http://test/api/games/${gameId}`, {
      headers: token ? { "x-player-token": token } : {},
    }),
    { params: Promise.resolve({ gameId }) },
  );
  return read(res);
}

function questsOf(data: Record<string, unknown>, status?: string) {
  const rows = (data.myQuests as { id: string; text: string; status: string; questId: string }[]) ?? [];
  return status ? rows.filter((row) => row.status === status) : rows;
}

describe("api rules", () => {
  it("rejects more than 10 starting quests", async () => {
    const res = await createGame(
      post("http://test/api/games", {
        playerName: "Too Many",
        durationSeconds: 3600,
        numberOfQuests: 11,
        mode: "FIRST_FINISH_WINS",
      }),
    );
    const { status, data } = await read(res);
    assert.equal(status, 400);
    assert.match(String(data.error), /1–10/);
  });

  it("keeps one score and one assignment under concurrent complete, fail, and start", async () => {
    const game = await create({ name: "Zara", quests: 2 });
    const amy = await joinLobby(game, "Amy");
    const started = await Promise.all(Array.from({ length: 5 }, () => start(game)));
    assert.ok(started.every((result) => result.status === 200));
    const hostState = await state(game.gameId, game.host.token);
    const amyState = await state(game.gameId, amy.token);
    assert.equal(questsOf(hostState.data).length, 2);
    assert.equal(questsOf(amyState.data).length, 2);

    const questId = questsOf(hostState.data, "ACTIVE")[0]!.id;
    const completes = await Promise.all(
      Array.from({ length: 5 }, () =>
        completeQuest(post(`http://test/complete/${questId}`, {}, game.host.token), {
          params: Promise.resolve({ playerQuestId: questId }),
        }).then(read),
      ),
    );
    assert.ok(completes.every((result) => result.status === 200));
    const afterComplete = await state(game.gameId, game.host.token);
    assert.equal((afterComplete.data.me as { score: number }).score, 1);
    assert.equal(questsOf(afterComplete.data, "COMPLETED").length, 1);

    const amyQuest = questsOf(amyState.data, "ACTIVE")[0]!.id;
    const fails = await Promise.all(
      Array.from({ length: 5 }, () =>
        failQuest(post(`http://test/fail/${amyQuest}`, {}, amy.token), {
          params: Promise.resolve({ playerQuestId: amyQuest }),
        }).then(read),
      ),
    );
    assert.ok(fails.every((result) => result.status === 200), JSON.stringify(fails));
    const afterFail = await state(game.gameId, amy.token);
    assert.equal((afterFail.data.me as { score: number }).score, -1);
    assert.equal((afterFail.data.me as { failsUsed: number }).failsUsed, 1);
    assert.equal(questsOf(afterFail.data, "FAILED").length, 1);
    assert.equal(questsOf(afterFail.data, "ACTIVE").length, 3);
  });

  it("blocks acting on another player's quests and hides them without a token", async () => {
    const game = await create({ name: "Host", quests: 1 });
    const other = await joinLobby(game, "Other");
    assert.equal((await start(game)).status, 200);
    const hostView = await state(game.gameId, game.host.token);
    const otherView = await state(game.gameId, other.token);
    const hostQuest = questsOf(hostView.data)[0]!;
    const otherQuest = questsOf(otherView.data)[0]!;
    assert.notEqual(hostQuest.text, undefined);
    assert.equal(
      questsOf(hostView.data).some((quest) => quest.id === otherQuest.id),
      false,
    );

    const anonymous = await state(game.gameId);
    assert.equal(anonymous.data.me, null);
    assert.equal(anonymous.data.myQuests, null);

    const stolen = await read(
      await completeQuest(post("http://test/complete", {}, other.token), {
        params: Promise.resolve({ playerQuestId: hostQuest.id }),
      }),
    );
    assert.equal(stolen.status, 404);

    const leaveOther = await read(
      await leaveGame(post("http://test/leave", {}, other.token), {
        params: Promise.resolve({ playerId: game.host.id }),
      }),
    );
    assert.equal(leaveOther.status, 403);

    const endAsOther = await read(
      await endGame(post("http://test/end", {}, other.token), {
        params: Promise.resolve({ gameId: game.gameId }),
      }),
    );
    assert.equal(endAsOther.status, 403);

    const peek = await read(
      await viewQuests(
        new Request(`http://test/quests`, { headers: { "x-player-token": other.token } }),
        { params: Promise.resolve({ gameId: game.gameId, otherPlayerId: game.host.id }) },
      ),
    );
    assert.equal(peek.status, 403);
  });

  it("accepts a late joiner once, and does not hand their token to the host", async () => {
    const game = await create({ name: "Host", quests: 2, mode: "LAST_FINISH_LOSES" });
    await joinLobby(game, "Early");
    assert.equal((await start(game)).status, 200);

    const joinRes = await read(
      await joinGame(
        post("http://test/api/games/join", {
          playerName: "Late",
          word1: `  ${game.codeWord1.toUpperCase()} `,
          word2: game.codeWord2,
        }),
      ),
    );
    assert.equal(joinRes.status, 200, JSON.stringify(joinRes.data));
    const requestId = String(joinRes.data.joinRequestId);
    const playerToken = String(joinRes.data.playerToken);
    assert.equal(joinRes.data.gameId, game.gameId);

    const accepts = await Promise.all(
      Array.from({ length: 5 }, () =>
        acceptJoin(post("http://test/accept", {}, game.host.token), {
          params: Promise.resolve({ gameId: game.gameId, requestId }),
        }).then(read),
      ),
    );
    assert.ok(accepts.every((result) => result.status === 200), JSON.stringify(accepts));
    assert.ok(accepts.every((result) => !JSON.stringify(result.data).includes(playerToken)));

    const poll = await read(
      await pollJoin(new Request(`http://test/join-requests/${requestId}`), {
        params: Promise.resolve({ requestId }),
      }),
    );
    assert.equal(poll.data.status, "ACCEPTED");
    assert.equal(JSON.stringify(poll.data).includes(playerToken), false);
    const playerId = String(poll.data.playerId);
    const lateState = await state(game.gameId, playerToken);
    assert.equal((lateState.data.me as { id: string }).id, playerId);
    assert.equal(questsOf(lateState.data).length, 2);

    const players = await prisma.player.count({
      where: { gameId: game.gameId, name: "Late", status: { not: "LEFT" } },
    });
    assert.equal(players, 1);

    const denyAfter = await read(
      await denyJoin(post("http://test/deny", {}, game.host.token), {
        params: Promise.resolve({ gameId: game.gameId, requestId }),
      }),
    );
    assert.equal(denyAfter.status, 409);
  });

  it("passes the host role when the host leaves and ends when nobody is still playing", async () => {
    const game = await create({ name: "Host", quests: 1, mode: "LAST_FINISH_LOSES" });
    const next = await joinLobby(game, "Next");
    const last = await joinLobby(game, "Last");
    assert.equal((await start(game)).status, 200);

    const left = await read(
      await leaveGame(post("http://test/leave", {}, game.host.token), {
        params: Promise.resolve({ playerId: game.host.id }),
      }),
    );
    assert.equal(left.status, 200);
    const mid = await state(game.gameId, next.token);
    assert.equal((mid.data.me as { isHost: boolean }).isHost, true);
    assert.equal((mid.data.game as { status: string }).status, "ACTIVE");

    await leaveGame(post("http://test/leave", {}, next.token), {
      params: Promise.resolve({ playerId: next.id }),
    });
    await leaveGame(post("http://test/leave", {}, last.token), {
      params: Promise.resolve({ playerId: last.id }),
    });
    const ended = await state(game.gameId, last.token);
    assert.equal((ended.data.game as { status: string }).status, "FINISHED");
  });

  it("names the first finisher as the winner even with a tied score", async () => {
    const game = await create({ name: "Zara", quests: 1, mode: "FIRST_FINISH_WINS" });
    const amy = await joinLobby(game, "Amy");
    assert.equal((await start(game)).status, 200);
    const amyQuest = questsOf((await state(game.gameId, amy.token)).data, "ACTIVE")[0]!.id;
    const zaraQuest = questsOf((await state(game.gameId, game.host.token)).data, "ACTIVE")[0]!.id;
    assert.equal(
      (
        await read(
          await completeQuest(post("http://test/c", {}, amy.token), {
            params: Promise.resolve({ playerQuestId: amyQuest }),
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await read(
          await completeQuest(post("http://test/c", {}, game.host.token), {
            params: Promise.resolve({ playerQuestId: zaraQuest }),
          }),
        )
      ).status,
      200,
    );
    const submitted = await read(
      await submitPlayer(post("http://test/submit", {}, game.host.token), {
        params: Promise.resolve({ playerId: game.host.id }),
      }),
    );
    assert.equal(submitted.status, 200, JSON.stringify(submitted.data));
    const board = await state(game.gameId, game.host.token);
    const outcome = board.data.outcome as { winnerId: string; winnerName: string };
    assert.equal(outcome.winnerName, "Zara");
    const rows = board.data.leaderboardPlayers as {
      id: string;
      name: string;
      score: number;
      finishedAt: string | null;
      completedQuests: number;
    }[];
    assert.equal(outcome.winnerId, game.host.id);
    const sorted = sortLeaderboardPlayers("FIRST_FINISH_WINS", "FINISHED", rows);
    assert.equal(sorted[0]?.name, "Zara");
    const amyRow = rows.find((row) => row.name === "Amy");
    const zaraRow = rows.find((row) => row.name === "Zara");
    assert.equal(amyRow?.score, zaraRow?.score);
    assert.ok(amyRow && amyRow.score > 0);
  });

  it("shows the least-progress player when Last to Finish Loses ends", async () => {
    const game = await create({ name: "Hal", quests: 1, mode: "LAST_FINISH_LOSES" });
    const mia = await joinLobby(game, "Mia");
    const opal = await joinLobby(game, "Opal");
    assert.equal((await start(game)).status, 200);
    const miaQuest = questsOf((await state(game.gameId, mia.token)).data, "ACTIVE")[0]!.id;
    const halQuest = questsOf((await state(game.gameId, game.host.token)).data, "ACTIVE")[0]!.id;
    assert.equal(
      (
        await read(
          await completeQuest(post("http://test/c", {}, mia.token), {
            params: Promise.resolve({ playerQuestId: miaQuest }),
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await read(
          await completeQuest(post("http://test/c", {}, game.host.token), {
            params: Promise.resolve({ playerQuestId: halQuest }),
          }),
        )
      ).status,
      200,
    );
    assert.equal(
      (
        await read(
          await submitPlayer(post("http://test/s", {}, mia.token), {
            params: Promise.resolve({ playerId: mia.id }),
          }),
        )
      ).status,
      200,
    );
    const ended = await read(
      await endGame(post("http://test/end", {}, game.host.token), {
        params: Promise.resolve({ gameId: game.gameId }),
      }),
    );
    assert.equal(ended.status, 200);
    const board = await state(game.gameId, opal.token);
    const outcome = board.data.outcome as { loserName: string; loserCompletedQuests: number };
    assert.equal(outcome.loserName, "Opal");
    assert.equal(outcome.loserCompletedQuests, 0);
    const names = (board.data.leaderboardPlayers as { name: string }[]).map((row) => row.name);
    assert.ok(names.includes("Opal"));
    assert.ok(names.includes("Hal"));
    assert.ok(names.includes("Mia"));
  });

  it("stops at 5 fails and tells the player how many remain", async () => {
    const game = await create({ name: "Failer", quests: 1 });
    assert.equal((await start(game)).status, 200);
    const left: number[] = [];
    for (let i = 0; i < 5; i++) {
      const current = await state(game.gameId, game.host.token);
      const active = questsOf(current.data, "ACTIVE")[0];
      assert.ok(active);
      const result = await read(
        await failQuest(post("http://test/fail", {}, game.host.token), {
          params: Promise.resolve({ playerQuestId: active.id }),
        }),
      );
      assert.equal(result.status, 200, JSON.stringify(result.data));
      left.push(Number(result.data.failsLeft));
    }
    assert.deepEqual(left, [4, 3, 2, 1, 0]);
    const before = await state(game.gameId, game.host.token);
    const score = (before.data.me as { score: number }).score;
    const activeCount = questsOf(before.data, "ACTIVE").length;
    const blocked = await read(
      await failQuest(post("http://test/fail", {}, game.host.token), {
        params: Promise.resolve({ playerQuestId: questsOf(before.data, "ACTIVE")[0]!.id }),
      }),
    );
    assert.equal(blocked.status, 400);
    assert.match(String(blocked.data.error), /all 5 fails/);
    const after = await state(game.gameId, game.host.token);
    assert.equal((after.data.me as { score: number }).score, score);
    assert.equal((after.data.me as { failsRemaining: number }).failsRemaining, 0);
    assert.equal(questsOf(after.data, "ACTIVE").length, activeCount);
  });

  it("rolls back a fail that cannot deal replacement quests", async () => {
    const game = await create({ name: "Stuck", quests: 1 });
    assert.equal((await start(game)).status, 200);
    const view = await state(game.gameId, game.host.token);
    const active = questsOf(view.data, "ACTIVE")[0]!;
    const catalog = await prisma.quest.findMany({
      where: { allianceOnly: false, id: { not: active.questId } },
      select: { id: true },
    });
    await prisma.playerQuest.createMany({
      data: catalog.map((quest) => ({
        playerId: game.host.id,
        questId: quest.id,
        status: "COMPLETED" as const,
      })),
    });
    const result = await read(
      await failQuest(post("http://test/fail", {}, game.host.token), {
        params: Promise.resolve({ playerQuestId: active.id }),
      }),
    );
    assert.equal(result.status, 409);
    const after = await prisma.playerQuest.findUniqueOrThrow({ where: { id: active.id } });
    assert.equal(after.status, "ACTIVE");
    const player = await prisma.player.findUniqueOrThrow({ where: { id: game.host.id } });
    assert.equal(player.score, 0);
  });

  it("duplicates quests across players only after the unique pool is exhausted", async () => {
    const catalog = await prisma.quest.count({ where: { allianceOnly: false } });
    assert.ok(catalog >= 10);
    const perPlayer = 10;
    const playerCount = Math.floor(catalog / perPlayer) + 1;
    const game = await create({ name: "P0", quests: perPlayer });
    const players = [game.host];
    for (let i = 1; i < playerCount; i++) {
      players.push(await joinLobby(game, `P${i}`));
    }
    const started = await start(game);
    assert.equal(started.status, 200, JSON.stringify(started.data));
    const idsByPlayer: string[][] = [];
    for (const player of players) {
      const view = await state(game.gameId, player.token);
      const ids = questsOf(view.data).map((quest) => quest.questId);
      assert.equal(ids.length, perPlayer);
      assert.equal(new Set(ids).size, perPlayer, `player held a quest twice: ${ids.join(",")}`);
      idsByPlayer.push(ids);
    }
    const all = idsByPlayer.flat();
    const unique = new Set(all);
    assert.equal(all.length, playerCount * perPlayer);
    assert.ok(all.length > catalog);
    assert.equal(unique.size, catalog);
  });
});
