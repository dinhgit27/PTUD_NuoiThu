ALTER TABLE "items"
ADD COLUMN "sprite_sheet_url" TEXT,
ADD COLUMN "frame_config" JSONB,
ADD COLUMN "animations" JSONB;
