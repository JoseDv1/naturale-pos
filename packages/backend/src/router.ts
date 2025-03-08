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
import { promisify } from "node:util"
import { execFile } from "child_process"
import { HTTPException } from "hono/http-exception";
const execFileAsync = promisify(execFile)
import { z } from "zod";
import { zValidator } from "@hono/zod-validator";
import { getSuppliesReport } from "./modules/supplies/suppliesServices";
import { getSalesReport } from "./modules/sales/salesServices";

export const apiRoutes = new Hono()
	.route('/users', userRouter)
	.get("/backups",
		async (ctx) => {
			const databaseContainerName = Bun.env.DATABASE_CONTAINER
			const command = `exec ${databaseContainerName} ls -l /var/db_backups`
			const child = await execFileAsync("docker", command.split(" "))
			if (child.stderr) throw new HTTPException(500, { message: child.stderr })
			console.log(child.stdout)
			const files = child.stdout.split("\n")
				.filter((file) => file.includes(".dump"))
				.map((file) => {
					const rows = file.split(" ")
					const name = rows.at(-1)
					const size = rows.at(-5)
					return { name, size: size + " bytes" }
				})
			return ctx.json({ files })
		}
	)
	.post('/backups',
		async (ctx) => {
			const databaseContainerName = Bun.env.DATABASE_CONTAINER!
			const filePath = "./backup.sh"
			const args = ["-c", databaseContainerName]
			const child = await execFileAsync(filePath, args) // This is relative where the server is running
			if (child.stderr) throw new HTTPException(500, { message: child.stderr })
			return ctx.json({ message: child.stdout })
		})
	.get("/reports",
		zValidator("query", z.object({ from: z.string().date(), to: z.string().date() })),
		async (ctx) => {
			const { from, to } = ctx.req.valid("query")
			const supplies = await getSuppliesReport(from, to)
			const sales = await getSalesReport(from, to)
			return ctx.json({ supplies, sales })
		}
	)
	.use(jwt())
	.route('/products', productRouter)
	.route('/categories', categoryRouter)
	.route('/providers', providerRouter)
	.route('/sales/:saleId/products', productOnSaleRouter)
	.route('/sales', saleRouter)
	.route('/supplies/:supplyId/products', productOnSupplyRouter)
	.route('/supplies', supplyRouter)
