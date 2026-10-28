-- Host-chosen fail cap. Existing games keep the previous fixed limit of 5.
ALTER TABLE "Game" ADD COLUMN "maxFailsPerPlayer" INTEGER NOT NULL DEFAULT 5;
