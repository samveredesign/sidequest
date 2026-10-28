import { buildGameState } from "@/lib/game-state";
import { reapStalePlayers, touchPlayerPresence } from "@/lib/game-lifecycle";
import { viewerInGame } from "@/lib/player-auth";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ gameId: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  const viewer = await viewerInGame(req, gameId);
  if (viewer) {
    await touchPlayerPresence(viewer.id);
    await reapStalePlayers(gameId, viewer.id);
  } else {
    await reapStalePlayers(gameId);
  }

  const state = await buildGameState(gameId, viewer?.id ?? null);
  if (!state) {
    return NextResponse.json({ error: "Game not found" }, { status: 404 });
  }

  return NextResponse.json(state);
}
