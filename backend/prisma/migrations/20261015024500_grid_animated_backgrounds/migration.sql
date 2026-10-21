ALTER TABLE "garden_backgrounds"
ADD COLUMN "animation_columns" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "animation_rows" INTEGER NOT NULL DEFAULT 1;

UPDATE "garden_backgrounds"
SET "animation_columns" = "animation_frames"
WHERE "animation_frames" > 1;
