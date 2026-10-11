// prisma/seed.ts
import { PrismaClient, Role, OrderStatus, JobStatus, Condition, OrderType } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // Clean in correct order (respect foreign keys)
  await prisma.eventLog.deleteMany();
  await prisma.jobTimeline.deleteMany();
  await prisma.orderTimeline.deleteMany();
  await prisma.deliveryDropOff.deleteMany();
  await prisma.deliveryJob.deleteMany();
  await prisma.deliveryBatch.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.productImage.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.delivererProfile.deleteMany();
  await prisma.vendorProfile.deleteMany();
  await prisma.user.deleteMany();

  console.log('🧹 Database cleaned');

  const password = await bcrypt.hash('password123', 10);

  // 1 — Admin
  const admin = await prisma.user.create({
    data: {
      email: 'admin@test.com',
      password,
      name: 'Admin User',
      role: Role.ADMIN,
    },
  });
  console.log('✅ Admin:', admin.email);


  const customer = await prisma.user.create({
    data: {
      email: 'customer@test.com',
      password,
      name: 'Test Customer',
      role: Role.CUSTOMER,
    },
  });
  console.log('✅ Customer:', customer.email);

  const vendorUser = await prisma.user.create({
    data: {
      email: 'vendor@test.com',
      password,
      name: 'Test Vendor',
      role: Role.VENDOR,
    },
  });

  const vendorProfile = await prisma.vendorProfile.create({
    data: {
      userId: vendorUser.id,
      shopName: 'Test Shop',
      latitude: 35.06197273,  
      longitude: 36.338286284,
      isVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Vendor:', vendorUser.email);

  const delivererUser = await prisma.user.create({
    data: {
      email: 'deliverer@test.com',
      password,
      name: 'Test Deliverer',
      role: Role.DELIVERER,
    },
  });

  await prisma.delivererProfile.create({
    data: {
      userId: delivererUser.id,
      currentLat: 35.058723373814736,  
      currentLng: 36.33788931767618,
      availability: true,    
      activeJobId: null,   
      maxConcurrentOrders: 3,
      maxStops: 5,
      acceptsBatching: true,
    },
  });
  console.log('✅ Deliverer:', delivererUser.email);

  const delivererUser2 = await prisma.user.create({
    data: {
      email: 'deliverer2@test.com',
      password,
      name: 'Test-Deliverer2',
      role: Role.DELIVERER,
    },
  });

  await prisma.delivererProfile.create({
    data: {
      userId: delivererUser2.id,
      currentLat: 35.070367513306294,  
      currentLng: 36.338452795103464,
      availability: true,    
      activeJobId: null,   
      maxConcurrentOrders: 3,
      maxStops: 5,
      acceptsBatching: true,
    },
  });
  console.log('✅ Deliverer:', delivererUser2.email);

  
  const category = await prisma.category.create({
    data: {
      name: 'General',
    },
  });
  console.log('✅ Category:', category.name);
   const category2 = await prisma.category.create({
    data: {
      name: 'Food',
    },
  });
  console.log('✅ Category:', category2.name);

  const products = await prisma.product.createMany({
    data:[
{
      vendorId: vendorProfile.id,
      categoryId: category.id,
      name: 'Test Product',
      price: 25.00,
      stockQuantity: 100,
      condition: Condition.NEW,
      isAvailable: true,
    },
    {
      vendorId: vendorProfile.id,
      categoryId: category2.id,
      name: 'Test-Food-Product',
      price: 25.00,
      stockQuantity: 100,
      condition: Condition.NEW,
      isAvailable: true,
    },
    ] 
  });
  console.log('✅ Product:', products);
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });


 