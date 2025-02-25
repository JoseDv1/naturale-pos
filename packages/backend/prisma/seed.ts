import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function seed() {
	console.log('Seeding...')

	await db.$transaction([
		db.provider.create({
			data: {
				name: "Default Provider",
				id: "0"
			}
		}),
		db.category.create({
			data: {
				name: "Default Category",
				id: 0
			}
		}),
		db.user.create({
			data: {
				name: "Admin",
				username: "admin",
				password: await Bun.password.hash("admin"),
				role: "ADMIN"
			}
		})
	])

}

seed()
	.then(async () => {
		console.log('Seeding Completed!')
		await db.$disconnect()
	})
	.catch(async e => {
		console.error(e)
		await db.$disconnect()
		process.exit(1)
	})