-- AddForeignKey
ALTER TABLE "products_on_sale" ADD CONSTRAINT "products_on_sale_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;
