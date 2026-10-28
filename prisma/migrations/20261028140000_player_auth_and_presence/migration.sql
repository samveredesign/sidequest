-- Device tokens, presence, and one quest row per player per quest.

ALTER TABLE "JoinRequest" ADD COLUMN "playerToken" TEXT;

UPDATE "JoinRequest"
SET "playerToken" = md5(random()::text || "id") || md5(random()::text || "createdAt"::text)
WHERE "playerToken" IS NULL;

ALTER TABLE "JoinRequest" ALTER COLUMN "playerToken" SET NOT NULL;

CREATE UNIQUE INDEX "JoinRequest_playerToken_key" ON "JoinRequest"("playerToken");

ALTER TABLE "Player" ADD COLUMN "secretToken" TEXT;
ALTER TABLE "Player" ADD COLUMN "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

UPDATE "Player"
SET "secretToken" = md5(random()::text || "id") || md5(random()::text || "createdAt"::text)
WHERE "secretToken" IS NULL;

ALTER TABLE "Player" ALTER COLUMN "secretToken" SET NOT NULL;

CREATE UNIQUE INDEX "Player_secretToken_key" ON "Player"("secretToken");

-- A player must never hold the same quest twice. Drop older duplicate rows if any exist.
DELETE FROM "PlayerQuest" AS newer
USING "PlayerQuest" AS older
WHERE newer."playerId" = older."playerId"
  AND newer."questId" = older."questId"
  AND newer.ctid <> older.ctid
  AND newer."createdAt" > older."createdAt";

DELETE FROM "PlayerQuest" AS newer
USING "PlayerQuest" AS older
WHERE newer."playerId" = older."playerId"
  AND newer."questId" = older."questId"
  AND newer.ctid > older.ctid;

CREATE UNIQUE INDEX "PlayerQuest_playerId_questId_key" ON "PlayerQuest"("playerId", "questId");
