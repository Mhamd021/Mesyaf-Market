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

  // 2 — Customer (Damascus coordinates)
  const customer = await prisma.user.create({
    data: {
      email: 'customer@test.com',
      password,
      name: 'Test Customer',
      role: Role.CUSTOMER,
    },
  });
  console.log('✅ Customer:', customer.email);

  // 3 — Vendor user + profile
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
      latitude: 33.5100,   // ← your schema uses latitude/longitude
      longitude: 36.2700,
      isVerified: true,
      isActive: true,
    },
  });
  console.log('✅ Vendor:', vendorUser.email);

  // 4 — Deliverer user + profile (available, near the vendor)
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
      currentLat: 33.5115,   // ← your schema uses currentLat/currentLng
      currentLng: 36.2710,
      availability: true,    // ← available to be assigned
      activeJobId: null,     // ← no active job
      maxConcurrentOrders: 3,
      maxStops: 5,
      acceptsBatching: true,
    },
  });
  console.log('✅ Deliverer:', delivererUser.email);

  // 5 — Category (required by Product)
  const category = await prisma.category.create({
    data: {
      name: 'General',
    },
  });
  console.log('✅ Category:', category.name);

  // 6 — Product
  const product = await prisma.product.create({
    data: {
      vendorId: vendorProfile.id,
      categoryId: category.id,
      name: 'Test Product',
      price: 25.00,
      stockQuantity: 100,
      condition: Condition.NEW,
      isAvailable: true,
    },
  });
  console.log('✅ Product:', product.name);

  // 7 — Order (READY_FOR_DELIVERY so it can be batched)
  const order = await prisma.order.create({
    data: {
      customerId: customer.id,
      vendorId: vendorProfile.id,
      status: OrderStatus.READY_FOR_DELIVERY,
      orderType: OrderType.GROCERY,
      // Vendor coordinates — critical for deliverer assignment
      vendorLat: vendorProfile.latitude,
      vendorLng: vendorProfile.longitude,
      // Customer coordinates — used for dropoff
      customerLat: 33.5138,
      customerLng: 36.2765,
      customerAddress: 'Test Customer Address',
      vendorAddress: 'Test Vendor Address',
      orderItems: {
        create: {
          productId: product.id,
          quantity: 1,
          price: 25.00,
        },
      },
    },
  });
  console.log('✅ Order:', order.id, '| Status:', order.status);

  // 8 — DeliveryBatch (PENDING — this is what closeBatch() will process)
  const batch = await prisma.deliveryBatch.create({
    data: {
      status: JobStatus.PENDING,  // ← JobStatus enum not string
      orders: {
        connect: { id: order.id },
      },
    },
  });
  console.log('✅ DeliveryBatch:', batch.id, '| Status:', batch.status);

  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('🎯 TEST DATA READY');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log(`   BatchId to use in test: ${batch.id}`);
  console.log(`   OrderId:                ${order.id}`);
  console.log('');
  console.log('   Credentials (password: password123)');
  console.log(`   Admin:     admin@test.com`);
  console.log(`   Customer:  customer@test.com`);
  console.log(`   Vendor:    vendor@test.com`);
  console.log(`   Deliverer: deliverer@test.com`);
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });