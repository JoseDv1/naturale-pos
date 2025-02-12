// TODO: Create Default Provider 
// TODO: Create Default Category
import { PrismaClient } from '@prisma/client'
const db = new PrismaClient()
async function seed() {
	console.log('Seeding...')
	console.log('Creating Default Provider...')
	await db.provider.create({
		data: {
			name: "Default Provider",
			id: "0"
		}
	})
	console.log('Default Provider Created!')
	console.log('Creating Default Category...')
	await db.category.create({
		data: {
			name: "Default Category",
			id: "0"
		}
	})
	console.log('Default Category Created!')
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