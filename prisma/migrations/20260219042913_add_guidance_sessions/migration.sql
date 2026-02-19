-- CreateEnum
CREATE TYPE "GuidanceSessionStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

-- CreateTable
CREATE TABLE "GuidanceSession" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "currentStep" INTEGER NOT NULL DEFAULT 1,
    "totalSteps" INTEGER NOT NULL,
    "status" "GuidanceSessionStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GuidanceSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GuidanceSession_userId_idx" ON "GuidanceSession"("userId");

-- CreateIndex
CREATE INDEX "GuidanceSession_documentId_idx" ON "GuidanceSession"("documentId");

-- AddForeignKey
ALTER TABLE "GuidanceSession" ADD CONSTRAINT "GuidanceSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GuidanceSession" ADD CONSTRAINT "GuidanceSession_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "Document"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
