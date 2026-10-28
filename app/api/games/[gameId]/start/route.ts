import { ensureQuestCatalogSeeded } from "@/lib/ensure-quest-catalog";
import { errorResponse } from "@/lib/http";
import { requirePlayer } from "@/lib/player-auth";
import { startGameForHost } from "@/lib/start-game";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ gameId: string }> };

export async function POST(req: Request, ctx: Ctx) {
  const { gameId } = await ctx.params;
  const auth = await requirePlayer(req, { gameId });
  if ("response" in auth) return auth.response;

  try {
    await ensureQuestCatalogSeeded();
    const result = await startGameForHost(gameId, auth.player.id);
    return NextResponse.json({ ok: true, alreadyStarted: result.alreadyStarted });
  } catch (error) {
    return errorResponse(error);
  }
}
