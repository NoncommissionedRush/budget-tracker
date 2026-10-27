-- CreateEnum
CREATE TYPE "MailMessageStatus" AS ENUM ('PROCESSED', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "mail_messages" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "folder" TEXT NOT NULL,
    "sender" TEXT,
    "subject" TEXT,
    "sentAt" TIMESTAMP(3),
    "status" "MailMessageStatus" NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "fileCount" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mail_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "mail_messages_messageId_key" ON "mail_messages"("messageId");

-- CreateIndex
CREATE INDEX "mail_messages_createdAt_idx" ON "mail_messages"("createdAt");

