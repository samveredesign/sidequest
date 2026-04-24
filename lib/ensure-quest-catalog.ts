import { QUEST_POOL } from "@/data/quest-pool";
import { SECRET_ALLIANCE_QUEST_POOL } from "@/data/secret-alliance-quest-pool";
import { prisma } from "@/lib/prisma";

/**
 * Ensures the global quest catalog is loaded (e.g. production never ran `db:seed`).
 * Safe to call on every request; only inserts when a pool is empty.
 */
export async function ensureQuestCatalogSeeded(): Promise<void> {
  const mainCount = await prisma.quest.count({ where: { allianceOnly: false } });
  if (mainCount === 0) {
    await prisma.quest.createMany({
      data: QUEST_POOL.map((text) => ({ text, allianceOnly: false })),
    });
  }

  const allianceCount = await prisma.quest.count({ where: { allianceOnly: true } });
  if (allianceCount === 0) {
    await prisma.quest.createMany({
      data: SECRET_ALLIANCE_QUEST_POOL.map((text) => ({
        text,
        allianceOnly: true,
      })),
    });
  }
}
