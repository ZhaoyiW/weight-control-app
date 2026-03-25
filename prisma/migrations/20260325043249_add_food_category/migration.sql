-- AlterTable
ALTER TABLE "FoodItem" ADD COLUMN "category" TEXT;

-- CreateIndex
CREATE INDEX "FoodItem_category_idx" ON "FoodItem"("category");
