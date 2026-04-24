import { ensureQuestCatalogSeeded } from "../lib/ensure-quest-catalog";
import { prisma } from "../lib/prisma";

async function main() {
  await ensureQuestCatalogSeeded();
  const mainCount = await prisma.quest.count({ where: { allianceOnly: false } });
  const allianceCount = await prisma.quest.count({ where: { allianceOnly: true } });
  console.log(
    `Quest catalog ready: ${mainCount} main quest(s), ${allianceCount} Secret Alliance quest(s).`,
  );
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
