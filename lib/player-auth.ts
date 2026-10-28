import { prisma } from "@/lib/prisma";
import type { Player } from "@prisma/client";
import { NextResponse } from "next/server";

export const PLAYER_TOKEN_HEADER = "x-player-token";

export function readPlayerToken(req: Request): string | null {
  const direct = req.headers.get(PLAYER_TOKEN_HEADER)?.trim();
  if (direct) return direct;
  const authorization = req.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    if (token) return token;
  }
  return null;
}

export async function requirePlayer(
  req: Request,
  opts?: { gameId?: string; playerId?: string },
): Promise<{ player: Player } | { response: NextResponse }> {
  const token = readPlayerToken(req);
  if (!token) {
    return {
      response: NextResponse.json({ error: "Missing player token" }, { status: 401 }),
    };
  }

  const player = await prisma.player.findUnique({ where: { secretToken: token } });
  if (!player) {
    return {
      response: NextResponse.json({ error: "Invalid player token" }, { status: 401 }),
    };
  }
  if (opts?.gameId && player.gameId !== opts.gameId) {
    return {
      response: NextResponse.json({ error: "You are not in this game" }, { status: 403 }),
    };
  }
  if (opts?.playerId && player.id !== opts.playerId) {
    return {
      response: NextResponse.json({ error: "You can only act as yourself" }, { status: 403 }),
    };
  }
  return { player };
}

/** Viewer for a game poll. A token for a different game is ignored. */
export async function viewerInGame(req: Request, gameId: string): Promise<Player | null> {
  const token = readPlayerToken(req);
  if (!token) return null;
  const player = await prisma.player.findUnique({ where: { secretToken: token } });
  if (!player || player.gameId !== gameId) return null;
  return player;
}
