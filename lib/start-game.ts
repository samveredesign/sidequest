import { ApiError } from "@/lib/api-error";
import { lockGame } from "@/lib/db-lock";
import { MAX_STARTING_QUESTS, MIN_STARTING_QUESTS } from "@/lib/game-rules";
import { prisma } from "@/lib/prisma";
import { assignInitialQuestsToPlayers } from "@/lib/quest-utils";
import { assignSecretAllianceInTx } from "@/lib/secret-alliance";

export async function startGameForHost(
  gameId: string,
  hostPlayerId: string,
): Promise<{ alreadyStarted: boolean }> {
  return prisma.$transaction(
    async (tx) => {
      await lockGame(tx, gameId);
      const game = await tx.game.findUnique({
        where: { id: gameId },
        include: { players: true },
      });
      if (!game) throw new ApiError("Game not found", 404);
      if (game.status !== "LOBBY") return { alreadyStarted: true };

      const starter = game.players.find((player) => player.id === hostPlayerId);
      if (!starter?.isHost) throw new ApiError("Only the host can start", 403);
      if (starter.status === "LEFT") {
        throw new ApiError("Cannot start as left player", 400);
      }
      if (
        game.numberOfQuests < MIN_STARTING_QUESTS ||
        game.numberOfQuests > MAX_STARTING_QUESTS
      ) {
        throw new ApiError(
          `Number of quests must be ${MIN_STARTING_QUESTS}–${MAX_STARTING_QUESTS}`,
          400,
        );
      }

      const activePlayers = game.players.filter((player) => player.status !== "LEFT");
      if (game.mode === "SECRET_ALLIANCE" && activePlayers.length < 4) {
        throw new ApiError(
          "At least 4 players are required to start Secret Alliance.",
          400,
        );
      }

      if (game.mode === "SECRET_ALLIANCE") {
        const allianceQuestCount = await tx.quest.count({ where: { allianceOnly: true } });
        if (allianceQuestCount < game.numberOfQuests) {
          throw new ApiError(
            "Not enough Secret Alliance quest lines in the database for this game size.",
            409,
          );
        }
      } else {
        const questCount = await tx.quest.count({ where: { allianceOnly: false } });
        if (questCount === 0) {
          throw new ApiError("Quest pool could not be loaded. Try again in a moment.", 500);
        }
      }

      const now = new Date();
      const claimed = await tx.game.updateMany({
        where: { id: gameId, status: "LOBBY" },
        data: { status: "ACTIVE", startedAt: now },
      });
      if (claimed.count !== 1) return { alreadyStarted: true };

      if (game.mode === "SECRET_ALLIANCE") {
        await assignSecretAllianceInTx(tx, gameId, game.numberOfQuests);
      } else {
        await assignInitialQuestsToPlayers(gameId, game.numberOfQuests, tx);
      }
      return { alreadyStarted: false };
    },
    { timeout: 20_000 },
  );
}
