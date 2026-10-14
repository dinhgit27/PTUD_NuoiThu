ALTER TABLE "pet_types"
ADD COLUMN "is_shop_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "exp_price" INTEGER NOT NULL DEFAULT 0;

CREATE TABLE "purchased_pet_types" (
    "purchased_pet_type_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "type_id" TEXT NOT NULL,
    "acquired_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchased_pet_types_pkey" PRIMARY KEY ("purchased_pet_type_id")
);

CREATE UNIQUE INDEX "purchased_pet_types_user_id_type_id_key"
ON "purchased_pet_types"("user_id", "type_id");

ALTER TABLE "purchased_pet_types"
ADD CONSTRAINT "purchased_pet_types_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("user_id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "purchased_pet_types"
ADD CONSTRAINT "purchased_pet_types_type_id_fkey"
FOREIGN KEY ("type_id") REFERENCES "pet_types"("type_id")
ON DELETE CASCADE ON UPDATE CASCADE;
