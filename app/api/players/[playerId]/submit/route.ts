import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { prisma } from "@/lib/prisma";
import { canAllianceSubmit } from "@/lib/secret-alliance";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ playerId: string }> };

export async function POST(_req: Request, ctx: Ctx) {
  const { playerId } = await ctx.params;

  const player = await prisma.player.findUnique({
    where: { id: playerId },
    include: { game: true },
  });

  if (!player) {
    return NextResponse.json({ error: "Player not found" }, { status: 404 });
  }

  await expireGameIfTimeUp(player.gameId);

  if (player.status === "LEFT") {
    return NextResponse.json({ error: "Player left" }, { status: 400 });
  }
  if (player.status === "FINISHED") {
    return NextResponse.json({ error: "Already submitted" }, { status: 400 });
  }

  const gameFresh = await prisma.game.findUnique({ where: { id: player.gameId } });
  if (!gameFresh || gameFresh.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game not active" }, { status: 400 });
  }

  const activeLeft = await prisma.playerQuest.count({
    where: { playerId, status: "ACTIVE" },
  });

  if (gameFresh.mode === "SECRET_ALLIANCE") {
    if (!(await canAllianceSubmit(prisma, playerId))) {
      return NextResponse.json(
        {
          error:
            "Your alliance must complete every quest (you and every partner) before anyone can submit.",
        },
        { status: 400 },
      );
    }
  } else if (activeLeft > 0) {
    return NextResponse.json({ error: "Still have active quests" }, { status: 400 });
  }

  const totalQuests = await prisma.playerQuest.count({ where: { playerId } });
  if (totalQuests === 0) {
    return NextResponse.json({ error: "No quests assigned" }, { status: 400 });
  }

  const now = new Date();

  await prisma.$transaction(async (tx) => {
    if (gameFresh.mode === "SECRET_ALLIANCE") {
      const me = await tx.player.findUnique({ where: { id: playerId } });
      if (me?.allianceGroup == null) return;
      const allies = await tx.player.findMany({
        where: {
          gameId: player.gameId,
          allianceGroup: me.allianceGroup,
          status: "ACTIVE",
        },
      });
      for (const a of allies) {
        await tx.player.update({
          where: { id: a.id },
          data: { status: "FINISHED", finishedAt: now },
        });
      }
    } else {
      await tx.player.update({
        where: { id: playerId },
        data: { status: "FINISHED", finishedAt: now },
      });
    }

    const game = await tx.game.findUnique({ where: { id: player.gameId } });
    if (!game || game.status !== "ACTIVE") {
      return;
    }

    if (game.mode === "FIRST_FINISH_WINS" || game.mode === "SECRET_ALLIANCE") {
      await tx.game.update({
        where: { id: game.id },
        data: { status: "FINISHED", finishedAt: now },
      });
      await tx.joinRequest.updateMany({
        where: { gameId: game.id, status: "PENDING" },
        data: { status: "DENIED" },
      });
      return;
    }

    const stillPlaying = await tx.player.count({
      where: {
        gameId: game.id,
        status: "ACTIVE",
      },
    });

    if (stillPlaying === 0) {
      await tx.game.update({
        where: { id: game.id },
        data: { status: "FINISHED", finishedAt: now },
      });
      await tx.joinRequest.updateMany({
        where: { gameId: game.id, status: "PENDING" },
        data: { status: "DENIED" },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
