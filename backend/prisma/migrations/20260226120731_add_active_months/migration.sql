-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "activeMonths" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
