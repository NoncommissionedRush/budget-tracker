-- AlterTable
ALTER TABLE "categories" ADD COLUMN "isUnbudgeted" BOOLEAN NOT NULL DEFAULT false;

-- Insert default "Unexpected expenses" category
INSERT INTO "categories" ("id", "name", "icon", "color", "allocatedAmount", "activeMonths", "sortOrder", "isActive", "isUnbudgeted", "createdAt", "updatedAt")
VALUES (
  'cunexpected00000000000000',
  'Unexpected',
  'tag',
  '#f97316',
  0,
  ARRAY[]::INTEGER[],
  9999,
  true,
  true,
  NOW(),
  NOW()
) ON CONFLICT ("id") DO NOTHING;
