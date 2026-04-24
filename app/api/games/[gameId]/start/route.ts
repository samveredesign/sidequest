import { ensureQuestCatalogSeeded } from "@/lib/ensure-quest-catalog";
import { assignInitialQuestsToPlayers } from "@/lib/quest-utils";
import { prisma } from "@/lib/prisma";
import { assignSecretAllianceInTx } from "@/lib/secret-alliance";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  let body: { playerId?: string };
  try {
    body = (await req.json()) as { playerId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const playerId = body.playerId;
  if (!playerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  const game = await prisma.game.findUnique({
    where: { id: gameId },
    include: { players: true },
  });

  if (!game) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }
  if (game.status !== "LOBBY") {
    return NextResponse.json({ error: "Game already started" }, { status: 400 });
  }

  const starter = game.players.find((p) => p.id === playerId);
  if (!starter || !starter.isHost) {
    return NextResponse.json({ error: "Only the host can start" }, { status: 403 });
  }
  if (starter.status === "LEFT") {
    return NextResponse.json({ error: "Cannot start as left player" }, { status: 400 });
  }
  const activePlayers = game.players.filter((p) => p.status !== "LEFT");
  if (game.mode === "SECRET_ALLIANCE" && activePlayers.length < 4) {
    return NextResponse.json(
      { error: "At least 4 players are required to start Secret Alliance." },
      { status: 400 },
    );
  }

  await ensureQuestCatalogSeeded();

  if (game.mode === "SECRET_ALLIANCE") {
    const allianceQuestCount = await prisma.quest.count({
      where: { allianceOnly: true },
    });
    if (allianceQuestCount < game.numberOfQuests) {
      return NextResponse.json(
        {
          error: `Not enough Secret Alliance quest lines in the database for this game size.`,
        },
        { status: 500 },
      );
    }
  } else {
    const questCount = await prisma.quest.count({
      where: { allianceOnly: false },
    });
    if (questCount === 0) {
      return NextResponse.json(
        { error: "Quest pool could not be loaded. Try again in a moment." },
        { status: 500 },
      );
    }
  }

  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.game.update({
      where: { id: gameId },
      data: { status: "ACTIVE", startedAt: now },
    });
    if (game.mode === "SECRET_ALLIANCE") {
      await assignSecretAllianceInTx(tx, gameId, game.numberOfQuests);
    }
  });

  if (game.mode !== "SECRET_ALLIANCE") {
    await assignInitialQuestsToPlayers(gameId, game.numberOfQuests);
  }

  return NextResponse.json({ ok: true });
}
