import { isNameTakenInGame } from "@/lib/name-game";
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
    if (await isNameTakenInGame(lobbyGame.id, name)) {
      return NextResponse.json(
        { error: "That name is already taken in this game." },
        { status: 409 },
      );
    }

    const player = await prisma.player.create({
      data: {
        gameId: lobbyGame.id,
        name,
        isHost: false,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({
      game: {
        id: lobbyGame.id,
        codeWord1: lobbyGame.codeWord1,
        codeWord2: lobbyGame.codeWord2,
        status: lobbyGame.status,
        mode: lobbyGame.mode,
      },
      player: { id: player.id, name: player.name, isHost: player.isHost },
    });
  }

  const activeGame = await prisma.game.findFirst({
    where: { codeWord1: w1, codeWord2: w2, status: "ACTIVE" },
  });

  if (activeGame) {
    if (await isNameTakenInGame(activeGame.id, name)) {
      return NextResponse.json(
        { error: "That name is already taken in this game." },
        { status: 409 },
      );
    }

    const joinRequest = await prisma.joinRequest.create({
      data: {
        gameId: activeGame.id,
        playerName: name,
        status: "PENDING",
      },
    });

    return NextResponse.json({
      joinRequestId: joinRequest.id,
      gameId: activeGame.id,
      message: "Waiting for host approval",
    });
  }

  return NextResponse.json(
    { error: "No game found for that code, or the game has already ended." },
    { status: 404 },
  );
}
