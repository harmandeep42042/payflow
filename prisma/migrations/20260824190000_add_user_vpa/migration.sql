-- AlterTable
ALTER TABLE "User" ADD COLUMN "vpa" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "User_vpa_key" ON "User"("vpa");
