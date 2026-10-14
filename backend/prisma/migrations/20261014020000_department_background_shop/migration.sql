ALTER TABLE "garden_backgrounds"
ADD COLUMN "exp_price" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "department_backgrounds" (
    "department_background_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "background_id" TEXT NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_backgrounds_pkey" PRIMARY KEY ("department_background_id")
);

CREATE UNIQUE INDEX "department_backgrounds_department_id_background_id_key"
ON "department_backgrounds"("department_id", "background_id");

ALTER TABLE "department_backgrounds"
ADD CONSTRAINT "department_backgrounds_department_id_fkey"
FOREIGN KEY ("department_id") REFERENCES "departments"("dept_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "department_backgrounds"
ADD CONSTRAINT "department_backgrounds_background_id_fkey"
FOREIGN KEY ("background_id") REFERENCES "garden_backgrounds"("background_id")
ON DELETE CASCADE ON UPDATE CASCADE;
