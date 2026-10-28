import type { Prisma } from "@prisma/client";
import { ApiError } from "@/lib/api-error";

export async function lockGame(tx: Prisma.TransactionClient, gameId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Game" WHERE "id" = ${gameId} FOR UPDATE
  `;
  if (!rows[0]) {
    throw new ApiError("Game not found", 404);
  }
}

export async function lockPlayer(tx: Prisma.TransactionClient, playerId: string): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Player" WHERE "id" = ${playerId} FOR UPDATE
  `;
  if (!rows[0]) {
    throw new ApiError("Player not found", 404);
  }
}

export async function lockJoinRequest(
  tx: Prisma.TransactionClient,
  requestId: string,
): Promise<void> {
  const rows = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "JoinRequest" WHERE "id" = ${requestId} FOR UPDATE
  `;
  if (!rows[0]) {
    throw new ApiError("Request not found", 404);
  }
}
