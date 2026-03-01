-- AlterTable
ALTER TABLE "ForestPatrimonyLevel2" ADD COLUMN     "organizationId" UUID;

-- CreateIndex
CREATE INDEX "ForestPatrimonyLevel2_organizationId_idx" ON "ForestPatrimonyLevel2"("organizationId");

-- AddForeignKey
ALTER TABLE "ForestPatrimonyLevel2" ADD CONSTRAINT "ForestPatrimonyLevel2_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
