import { prisma } from "../lib/prisma";
import { QUEST_POOL } from "../data/quest-pool";
import { SECRET_ALLIANCE_QUEST_POOL } from "../data/secret-alliance-quest-pool";

async function main() {
  // Quest text lives in the DB; `data/quest-pool.ts` is only used here (and in dev reset).
  const mainCount = await prisma.quest.count({ where: { allianceOnly: false } });
  if (mainCount === 0) {
    await prisma.quest.createMany({
      data: QUEST_POOL.map((text) => ({ text })),
    });
    console.log(`Seeded ${QUEST_POOL.length} main quests.`);
  } else {
    console.log(`Main quest pool already has ${mainCount} rows; skipping.`);
  }

  await seedAllianceQuests();
}

async function seedAllianceQuests() {
  const n = await prisma.quest.count({ where: { allianceOnly: true } });
  if (n > 0) {
    console.log(`Alliance quest pool already has ${n} rows; skipping.`);
    return;
  }
  await prisma.quest.createMany({
    data: [...SECRET_ALLIANCE_QUEST_POOL].map((text) => ({
      text,
      allianceOnly: true,
    })),
  });
  console.log(`Seeded ${SECRET_ALLIANCE_QUEST_POOL.length} Secret Alliance quests.`);
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
