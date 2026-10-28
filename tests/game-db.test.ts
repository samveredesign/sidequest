import assert from "node:assert/strict";
import { after, describe, it } from "node:test";
import { ensureQuestCatalogSeeded } from "../lib/ensure-quest-catalog";
import { reapStalePlayers } from "../lib/game-lifecycle";
import { generatePlayerToken } from "../lib/player-token";
import { prisma } from "../lib/prisma";
import { startGameForHost } from "../lib/start-game";

const createdGameIds: string[] = [];

after(async () => {
  if (createdGameIds.length > 0) {
    await prisma.game.deleteMany({ where: { id: { in: createdGameIds } } });
  }
  await prisma.$disconnect();
});

describe("start rollback and presence", () => {
  it("rolls back a start that cannot assign every quest", async () => {
    await ensureQuestCatalogSeeded();
    const game = await prisma.game.create({
      data: {
        codeWord1: "zzzzz",
        codeWord2: "yyyyy",
        durationSeconds: 3600,
        numberOfQuests: 200,
        mode: "FIRST_FINISH_WINS",
        status: "LOBBY",
      },
    });
    createdGameIds.push(game.id);
    const host = await prisma.player.create({
      data: {
        gameId: game.id,
        name: "Host",
        isHost: true,
        status: "ACTIVE",
        secretToken: generatePlayerToken(),
      },
    });

    await assert.rejects(() => startGameForHost(game.id, host.id));

    const fresh = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    assert.equal(fresh.status, "LOBBY");
    assert.equal(fresh.startedAt, null);
    const quests = await prisma.playerQuest.count({ where: { playerId: host.id } });
    assert.equal(quests, 0);
  });

  it("treats a player who stopped polling as left and passes the host role", async () => {
    const game = await prisma.game.create({
      data: {
        codeWord1: "qqqqq",
        codeWord2: "rrrrr",
        durationSeconds: 3600,
        numberOfQuests: 1,
        mode: "LAST_FINISH_LOSES",
        status: "ACTIVE",
        startedAt: new Date(),
      },
    });
    createdGameIds.push(game.id);
    const host = await prisma.player.create({
      data: {
        gameId: game.id,
        name: "Host",
        isHost: true,
        status: "ACTIVE",
        secretToken: generatePlayerToken(),
        lastSeenAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });
    const other = await prisma.player.create({
      data: {
        gameId: game.id,
        name: "Other",
        isHost: false,
        status: "ACTIVE",
        secretToken: generatePlayerToken(),
      },
    });

    await reapStalePlayers(game.id, other.id);

    const hostFresh = await prisma.player.findUniqueOrThrow({ where: { id: host.id } });
    const otherFresh = await prisma.player.findUniqueOrThrow({ where: { id: other.id } });
    const gameFresh = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    assert.equal(hostFresh.status, "LEFT");
    assert.equal(hostFresh.isHost, false);
    assert.equal(otherFresh.isHost, true);
    assert.equal(otherFresh.status, "ACTIVE");
    assert.equal(gameFresh.status, "ACTIVE");
  });

  it("finishes the game when every remaining active player has gone quiet", async () => {
    const game = await prisma.game.create({
      data: {
        codeWord1: "sssss",
        codeWord2: "ttttt",
        durationSeconds: 3600,
        numberOfQuests: 1,
        mode: "LAST_FINISH_LOSES",
        status: "ACTIVE",
        startedAt: new Date(),
      },
    });
    createdGameIds.push(game.id);
    await prisma.player.create({
      data: {
        gameId: game.id,
        name: "Only",
        isHost: true,
        status: "ACTIVE",
        secretToken: generatePlayerToken(),
        lastSeenAt: new Date(Date.now() - 5 * 60 * 1000),
      },
    });

    await reapStalePlayers(game.id);

    const fresh = await prisma.game.findUniqueOrThrow({ where: { id: game.id } });
    assert.equal(fresh.status, "FINISHED");
    assert.ok(fresh.finishedAt);
  });
});
