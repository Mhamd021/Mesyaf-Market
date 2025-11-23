import { PrismaClient } from "@prisma/client";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  const categories = [
    { name: "Electronics" },
    { name: "Books" },
    { name: "Clothing" },
    { name: "Home & Kitchen" },
  ];

  const tags = [
    "new", "sale", "popular", "limited edition", "bestseller",
    "discount", "exclusive", "trending", "classic", "eco-friendly",
  ];

  const categoryOps = categories.map((category) =>
    prisma.category.upsert({
      where: { name: category.name },
      update: {},
      create: category,
    }),
  );

  const tagOps = tags.map((name) =>
    prisma.productTag.upsert({
      where: { name },
      update: {},
      create: { name },
    }),
  );

  // Seed Admin user
  const passwordHash = await bcrypt.hash("admin123", 10);
  const adminOp = prisma.user.upsert({
    where: { email: "admin@example.com" },
    update: {},
    create: {
      name: "MhamdGhanoum",
      email: "admin@example.com",
      password: passwordHash,
      role: "ADMIN", 
    },
  });

  await prisma.$transaction([...categoryOps, ...tagOps, adminOp]);

  console.log("Seeding completed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
