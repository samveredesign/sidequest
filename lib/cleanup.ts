import { prisma } from "@/lib/prisma";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

export async function deleteGamesOlderThanSevenDays(): Promise<number> {
  const cutoff = new Date(Date.now() - SEVEN_DAYS_MS);
  const result = await prisma.game.deleteMany({
    where: { createdAt: { lt: cutoff } },
  });
  return result.count;
}
