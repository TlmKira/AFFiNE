-- AlterTable
ALTER TABLE
    "users"
ADD
    COLUMN "phone" VARCHAR,
ADD
    COLUMN "phone_verified_at" TIMESTAMPTZ(3);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE INDEX "users_phone_idx" ON "users"("phone");
