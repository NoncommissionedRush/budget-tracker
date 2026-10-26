-- CreateEnum
CREATE TYPE "CategorizationMethod" AS ENUM ('RULE', 'HISTORY', 'BILL', 'MANUAL');

-- CreateEnum
CREATE TYPE "RuleField" AS ENUM ('COUNTERPARTY_IBAN', 'COUNTERPARTY_NAME', 'DESCRIPTION', 'VARIABLE_SYMBOL');

-- CreateEnum
CREATE TYPE "RuleMatchType" AS ENUM ('EQUALS', 'CONTAINS');

-- CreateEnum
CREATE TYPE "RuleAction" AS ENUM ('CATEGORIZE', 'IGNORE');

-- AlterTable
ALTER TABLE "bank_transactions" ADD COLUMN     "categorizedBy" "CategorizationMethod",
ADD COLUMN     "ruleId" TEXT;

-- CreateTable
CREATE TABLE "categorization_rules" (
    "id" TEXT NOT NULL,
    "field" "RuleField",
    "matchType" "RuleMatchType" NOT NULL DEFAULT 'CONTAINS',
    "pattern" TEXT,
    "amountMin" DECIMAL(12,2),
    "amountMax" DECIMAL(12,2),
    "action" "RuleAction" NOT NULL DEFAULT 'CATEGORIZE',
    "categoryId" TEXT,
    "subcategoryId" TEXT,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "categorization_rules_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "categorization_rules_priority_idx" ON "categorization_rules"("priority");

-- AddForeignKey
ALTER TABLE "bank_transactions" ADD CONSTRAINT "bank_transactions_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "categorization_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "categorization_rules" ADD CONSTRAINT "categorization_rules_subcategoryId_fkey" FOREIGN KEY ("subcategoryId") REFERENCES "subcategories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

