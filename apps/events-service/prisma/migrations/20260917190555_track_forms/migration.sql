/*
  Warnings:

  - A unique constraint covering the columns `[sessionId]` on the table `registration_forms` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "registration_forms" ADD COLUMN     "sessionId" TEXT,
ALTER COLUMN "eventId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "registration_forms_sessionId_key" ON "registration_forms"("sessionId");

-- AddForeignKey
ALTER TABLE "registration_forms" ADD CONSTRAINT "registration_forms_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
