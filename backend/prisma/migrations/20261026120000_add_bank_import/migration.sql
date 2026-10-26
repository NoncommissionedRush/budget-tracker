-- CreateEnum
CREATE TYPE "ExpenseSource" AS ENUM ('MANUAL', 'IMPORT');

-- CreateEnum
CREATE TYPE "ImportSource" AS ENUM ('UPLOAD', 'EMAIL');

-- CreateEnum
CREATE TYPE "TransactionDirection" AS ENUM ('DEBIT', 'CREDIT');

-- CreateEnum
CREATE TYPE "BankTransactionStatus" AS ENUM ('CATEGORIZED', 'NEEDS_REVIEW', 'IGNORED');

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "bankTransactionId" TEXT,
ADD COLUMN     "source" "ExpenseSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "import_batches" (
    "id" TEXT NOT NULL,
    "source" "ImportSource" NOT NULL,
    "messageId" TEXT,
    "fileName" TEXT,
    "fileHash" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "statementId" TEXT,
    "accountIban" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalCount" INTEGER NOT NULL DEFAULT 0,
    "importedCount" INTEGER NOT NULL DEFAULT 0,
    "duplicateCount" INTEGER NOT NULL DEFAULT 0,
    "ignoredCount" INTEGER NOT NULL DEFAULT 0,
    "errorCount" INTEGER NOT NULL DEFAULT 0,
    "errors" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "import_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bank_transactions" (
    "id" TEXT NOT NULL,
    "importBatchId" TEXT NOT NULL,
    "bankTransactionId" TEXT NOT NULL,
    "accountIban" TEXT,
    "bookingDate" DATE NOT NULL,
    "valueDate" DATE,
    "transactionDate" DATE,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL,
    "direction" "TransactionDirection" NOT NULL,
    "counterpartyName" TEXT,
    "counterpartyIban" TEXT,
    "variableSymbol" TEXT,
    "constantSymbol" TEXT,
    "specificSymbol" TEXT,
    "description" TEXT,
    "bankTxCode" TEXT,
    "status" "BankTransactionStatus" NOT NULL,
    "ignoreReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "import_batches_fileHash_key" ON "import_batches"("fileHash");

-- CreateIndex
CREATE INDEX "import_batches_messageId_idx" ON "import_batches"("messageId");

-- CreateIndex
CREATE UNIQUE INDEX "bank_transactions_bankTransactionId_key" ON "bank_transactions"("bankTransactionId");

-- CreateIndex
CREATE INDEX "bank_transactions_importBatchId_idx" ON "bank_transactions"("importBatchId");

-- CreateIndex
CREATE INDEX "bank_transactions_status_idx" ON "bank_transactions"("status");

-- CreateIndex
CREATE INDEX "bank_transactions_bookingDate_idx" ON "bank_transactions"("bookingDate");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_bankTransactionId_key" ON "expenses"("bankTransactionId");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_bankTransactionId_fkey" FOREIGN KEY ("bankTransactionId") REFERENCES "bank_transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_importBatchId_fkey" FOREIGN KEY ("importBatchId") REFERENCES "import_batches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

