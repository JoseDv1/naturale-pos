import { Hono } from "hono";
import { userRouter } from "@/modules/users/userController";
import { productRouter } from "@/modules/products/productsController";
import { categoryRouter } from "@/modules/categories/categoriesController";
import { providerRouter } from "@/modules/providers/providersController";
import { saleRouter } from "@/modules/sales/salesController";
import { supplyRouter } from "@/modules/supplies/suppliesController";

export const apiRoutes =
	new Hono()
		.route('/users', userRouter)
		.route('/products', productRouter)
		.route('/categories', categoryRouter)
		.route('/providers', providerRouter)
		.route('/sales', saleRouter)
		.route('/supplies', supplyRouter);
