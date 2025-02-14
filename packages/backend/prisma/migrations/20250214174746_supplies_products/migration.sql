-- AddForeignKey
ALTER TABLE "products_on_supply" ADD CONSTRAINT "products_on_supply_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
