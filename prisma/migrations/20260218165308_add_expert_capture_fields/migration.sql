-- CreateEnum
CREATE TYPE "DocType" AS ENUM ('STANDARD', 'EXPERT_CAPTURE');

-- AlterTable
ALTER TABLE "Document" ADD COLUMN     "description" TEXT,
ADD COLUMN     "docType" "DocType" NOT NULL DEFAULT 'STANDARD',
ADD COLUMN     "expertCaptureData" JSONB,
ADD COLUMN     "title" TEXT;
