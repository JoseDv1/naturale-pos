import { PrismaClient } from '../generated/client/client';
import { PrismaBunSqlite } from 'prisma-adapter-bun-sqlite';

const adapter = new PrismaBunSqlite({ url: 'file:./prisma/dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Seeding database...');

  // 1. Create Users with hashed PINs (using Bun's built-in password hasher)
  const adminPinHash = await Bun.password.hash('1234');
  const cashierPinHash = await Bun.password.hash('0000');

  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: 'Admin Natural',
      passwordHash: adminPinHash,
      role: 'ADMIN',
      active: true,
    },
  });

  const cashier = await prisma.user.upsert({
    where: { username: 'cajero' },
    update: {},
    create: {
      username: 'cajero',
      name: 'Cajero Café',
      passwordHash: cashierPinHash,
      role: 'CASHIER',
      active: true,
    },
  });

  console.log('Users created:', { admin: admin.username, cashier: cashier.username });

  // 2. Create Categories
  const categoriesData = [
    { name: 'Suplementos', description: 'Proteínas, creatinas y colágenos' },
    { name: 'Bebidas', description: 'Cafés, tés, jugos y bebidas embotelladas' },
    { name: 'Snacks', description: 'Barras saludables, frutos secos y chocolates' },
    { name: 'Panadería', description: 'Panes, galletas y repostería saludable' },
  ];

  const categories: Record<string, any> = {};
  for (const cat of categoriesData) {
    const createdCat = await prisma.category.upsert({
      where: { name: cat.name },
      update: {},
      create: cat,
    });
    categories[cat.name] = createdCat;
  }
  console.log('Categories created:', Object.keys(categories));

  // 3. Create Products (Market vs Café, some marked as raw material)
  const productsData = [
    // Suplementos (Market)
    {
      sku: '7701234567890',
      name: 'Proteína Vegana Vainilla 1kg',
      description: 'Proteína aislada de arveja y arroz',
      price: 95000,
      cost: 60000,
      stock: 15,
      categoryId: categories['Suplementos'].id,
      department: 'MARKET',
      isRawMaterial: true, // Can be transferred to Café to make protein shakes
      active: true,
    },
    {
      sku: '7701234567891',
      name: 'Creatina Monohidratada 300g',
      description: 'Creatina micronizada pura',
      price: 85000,
      cost: 50000,
      stock: 20,
      categoryId: categories['Suplementos'].id,
      department: 'MARKET',
      isRawMaterial: false,
      active: true,
    },
    // Bebidas (Market & Café)
    {
      sku: '7701234567892',
      name: 'Leche de Almendras 1L (Suministro)',
      description: 'Bebida de almendras sin azúcar añadida',
      price: 9000,
      cost: 5000,
      stock: 24,
      categoryId: categories['Bebidas'].id,
      department: 'MARKET',
      isRawMaterial: true, // Used as milk base for coffee/smoothies
      active: true,
    },
    {
      sku: 'CAFE-001',
      name: 'Café Latte de Almendras (Pág)',
      description: 'Espresso con leche de almendras espumada',
      price: 7500,
      cost: 1500,
      stock: 999, // Prepared on demand
      categoryId: categories['Bebidas'].id,
      department: 'CAFE',
      isRawMaterial: false,
      active: true,
    },
    {
      sku: 'CAFE-002',
      name: 'Espresso Doble',
      description: 'Extracción doble de café de especialidad',
      price: 5000,
      cost: 800,
      stock: 999,
      categoryId: categories['Bebidas'].id,
      department: 'CAFE',
      isRawMaterial: false,
      active: true,
    },
    // Snacks (Market)
    {
      sku: '7701234567893',
      name: 'Chocolate Orgánico 80% Cacao',
      description: 'Barra de chocolate oscuro orgánico',
      price: 6500,
      cost: 3200,
      stock: 50,
      categoryId: categories['Snacks'].id,
      department: 'MARKET',
      isRawMaterial: false,
      active: true,
    },
    // Panadería (Café / Market)
    {
      sku: 'CAFE-003',
      name: 'Galleta de Avena y Arándanos',
      description: 'Galleta horneada sin gluten ni azúcar refinada',
      price: 3500,
      cost: 1200,
      stock: 30, // Freshly baked daily
      categoryId: categories['Panadería'].id,
      department: 'CAFE',
      isRawMaterial: false,
      active: true,
    },
    {
      sku: 'CAFE-004',
      name: 'Torta de Banano y Nueces (Porción)',
      description: 'Porción de torta saludable de banano',
      price: 5500,
      cost: 1800,
      stock: 12,
      categoryId: categories['Panadería'].id,
      department: 'CAFE',
      isRawMaterial: false,
      active: true,
    },
  ];

  for (const prod of productsData) {
    await prisma.product.upsert({
      where: { sku: prod.sku },
      update: {},
      create: prod,
    });
  }

  console.log('Products seeded successfully.');

  // 4. Create Tables if none exist
  const tableCount = await prisma.cafeTable.count();
  if (tableCount === 0) {
    const tablesData = Array.from({ length: 8 }, (_, i) => {
      const row = Math.floor(i / 4);
      const col = i % 4;
      return {
        name: `Mesa ${i + 1}`,
        status: 'AVAILABLE',
        x: 20 + col * 20,
        y: 30 + row * 25,
      };
    });
    for (const t of tablesData) {
      await prisma.cafeTable.create({ data: t });
    }
    console.log('Default tables seeded.');
  }

  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
