-- CreateEnum
CREATE TYPE "FscCertificateStatus" AS ENUM ('SI', 'NO');

-- AlterTable
ALTER TABLE "ForestPatrimonyLevel4" ADD COLUMN     "fscCertificateStatus" "FscCertificateStatus" NOT NULL DEFAULT 'NO';
