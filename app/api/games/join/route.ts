import { lockGame } from "@/lib/db-lock";
import { errorResponse } from "@/lib/http";
import { isNameTakenInGame } from "@/lib/name-game";
import { reapStalePlayers } from "@/lib/game-lifecycle";
import { generatePlayerToken } from "@/lib/player-token";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Body = {
  playerName?: string;
  word1?: string;
  word2?: string;
};

function norm(s: string) {
  return s.trim().toLowerCase();
}

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = body.playerName?.trim();
  const w1 = body.word1 ? norm(body.word1) : "";
  const w2 = body.word2 ? norm(body.word2) : "";

  if (!name) {
    return NextResponse.json({ error: "Player name required" }, { status: 400 });
  }
  if (!w1 || !w2 || w1.length !== 5 || w2.length !== 5) {
    return NextResponse.json({ error: "Both code words must be five letters" }, { status: 400 });
  }

  const lobbyGame = await prisma.game.findFirst({
    where: { codeWord1: w1, codeWord2: w2, status: "LOBBY" },
  });

  if (lobbyGame) {
    await reapStalePlayers(lobbyGame.id);
    try {
      const player = await prisma.$transaction(async (tx) => {
        await lockGame(tx, lobbyGame.id);
        const fresh = await tx.game.findUnique({ where: { id: lobbyGame.id } });
        if (!fresh || fresh.status !== "LOBBY") {
          return null;
        }
        if (await isNameTakenInGame(fresh.id, name, { tx })) {
          throw Object.assign(new Error("That name is already taken in this game."), { status: 409 });
        }
        const host = await tx.player.findFirst({
          where: { gameId: fresh.id, isHost: true, status: { not: "LEFT" } },
          select: { id: true },
        });
        return tx.player.create({
          data: {
            gameId: fresh.id,
            name,
            isHost: !host,
            status: "ACTIVE",
            secretToken: generatePlayerToken(),
          },
        });
      });

      if (!player) {
        return NextResponse.json(
          { error: "No game found for that code, or the game has already ended." },
          { status: 404 },
        );
      }

      return NextResponse.json({
        game: {
          id: lobbyGame.id,
          codeWord1: lobbyGame.codeWord1,
          codeWord2: lobbyGame.codeWord2,
          status: "LOBBY" as const,
          mode: lobbyGame.mode,
        },
        player: {
          id: player.id,
          name: player.name,
          isHost: player.isHost,
          token: player.secretToken,
        },
      });
    } catch (error) {
      const status = (error as { status?: number }).status;
      if (status === 409) {
        return NextResponse.json(
          { error: "That name is already taken in this game." },
          { status: 409 },
        );
      }
      return errorResponse(error);
    }
  }

  const activeGame = await prisma.game.findFirst({
    where: { codeWord1: w1, codeWord2: w2, status: "ACTIVE" },
  });

  if (activeGame) {
    await reapStalePlayers(activeGame.id);
    try {
      const joinRequest = await prisma.$transaction(async (tx) => {
        await lockGame(tx, activeGame.id);
        const fresh = await tx.game.findUnique({ where: { id: activeGame.id } });
        if (!fresh || fresh.status !== "ACTIVE") return null;
        const host = await tx.player.findFirst({
          where: { gameId: fresh.id, isHost: true, status: { not: "LEFT" } },
          select: { id: true },
        });
        if (!host) {
          throw Object.assign(new Error("This game has no host to approve joins."), { status: 409 });
        }
        if (await isNameTakenInGame(fresh.id, name, { tx })) {
          throw Object.assign(new Error("That name is already taken in this game."), { status: 409 });
        }
        return tx.joinRequest.create({
          data: {
            gameId: fresh.id,
            playerName: name,
            status: "PENDING",
            playerToken: generatePlayerToken(),
          },
        });
      });

      if (!joinRequest) {
        return NextResponse.json(
          { error: "No game found for that code, or the game has already ended." },
          { status: 404 },
        );
      }

      return NextResponse.json({
        joinRequestId: joinRequest.id,
        gameId: activeGame.id,
        playerToken: joinRequest.playerToken,
        message: "Waiting for host approval",
      });
    } catch (error) {
      const status = (error as { status?: number }).status;
      const message = error instanceof Error ? error.message : "Could not join";
      if (status === 409) {
        return NextResponse.json({ error: message }, { status: 409 });
      }
      return errorResponse(error);
    }
  }

  return NextResponse.json(
    { error: "No game found for that code, or the game has already ended." },
    { status: 404 },
  );
}
