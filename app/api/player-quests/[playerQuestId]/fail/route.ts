import { expireGameIfTimeUp } from "@/lib/game-expiry";
import { pickRandomQuestIdsForPlayer } from "@/lib/quest-utils";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ playerQuestId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { playerQuestId } = await ctx.params;
  let body: { playerId?: string };
  try {
    body = (await req.json()) as { playerId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const actingPlayerId = body.playerId;
  if (!actingPlayerId) {
    return NextResponse.json({ error: "playerId required" }, { status: 400 });
  }

  const pq = await prisma.playerQuest.findUnique({
    where: { id: playerQuestId },
    include: { player: { include: { game: true } } },
  });

  if (!pq || pq.playerId !== actingPlayerId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await expireGameIfTimeUp(pq.player.gameId);

  const game = await prisma.game.findUnique({ where: { id: pq.player.gameId } });
  if (!game || game.status !== "ACTIVE") {
    return NextResponse.json({ error: "Game not active" }, { status: 400 });
  }
  if (game.mode === "SECRET_ALLIANCE") {
    return NextResponse.json(
      { error: "Failing quests is not available in Secret Alliance" },
      { status: 400 },
    );
  }
  if (pq.player.status !== "ACTIVE") {
    return NextResponse.json({ error: "Player not active" }, { status: 400 });
  }
  if (pq.status !== "ACTIVE") {
    return NextResponse.json({ error: "Quest not active" }, { status: 400 });
  }

  const now = new Date();
  const gameId = pq.player.gameId;

  try {
    await prisma.$transaction(async (tx) => {
      await tx.playerQuest.update({
        where: { id: playerQuestId },
        data: { status: "FAILED", failedAt: now },
      });
      await tx.player.update({
        where: { id: actingPlayerId },
        data: { score: { decrement: 1 } },
      });
      const newIds = await pickRandomQuestIdsForPlayer(actingPlayerId, 2, {
        gameId,
        tx,
      });
      await tx.playerQuest.createMany({
        data: newIds.map((questId) => ({
          playerId: actingPlayerId,
          questId,
          status: "ACTIVE" as const,
        })),
      });
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Could not assign new quests" },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true });
}
