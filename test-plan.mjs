import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
const shop = await prisma.shop.findFirst({ where: { shopDomain: 'codikogiftapp.myshopify.com' }});
console.log('Shop record:', JSON.stringify(shop, null, 2));
await prisma.$disconnect();
