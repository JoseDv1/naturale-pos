import { Hono } from "hono";
import { userRouter } from "@/modules/users/userController";
import { productRouter } from "@/modules/products/productsController";
import { categoryRouter } from "@/modules/categories/categoriesController";
import { providerRouter } from "@/modules/providers/providersController";
import { saleRouter } from "@/modules/sales/salesController";
import { supplyRouter } from "@/modules/supplies/suppliesController";
import { productOnSaleRouter } from "@/modules/productsOnSale/productsOnSalesController";
import { productOnSupplyRouter } from "@/modules/productsOnSupply/productsOnSupplyController";
import { jwt } from "./lib/jwt";

export const apiRoutes = new Hono()
	.route('/users', userRouter)
	.use(jwt())
	.route('/products', productRouter)
	.route('/categories', categoryRouter)
	.route('/providers', providerRouter)
	.route('/sales/:saleId/products', productOnSaleRouter)
	.route('/sales', saleRouter)
	.route('/supplies/:supplyId/products', productOnSupplyRouter)
	.route('/supplies', supplyRouter)
