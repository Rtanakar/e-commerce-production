// ============================================================================
// seed.ts - Database seeding
// ============================================================================
// Local dev me test data
// Run: pnpm db:seed
// ============================================================================

import { PrismaClient, UserRole, UserStatus } from "../src/generated/prisma/client.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // ===== Admin user =====
  const adminPassword = await bcrypt.hash("Admin@12345", 12);
  await prisma.user.upsert({
    where: { email: "admin@shop.local" },
    update: {},
    create: {
      email: "admin@shop.local",
      password: adminPassword,
      name: "Platform Admin",
      role: UserRole.ADMIN,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
    },
  });

  // ===== Test customer =====
  const customerPassword = await bcrypt.hash("Customer@12345", 12);
  await prisma.user.upsert({
    where: { email: "customer@shop.local" },
    update: {},
    create: {
      email: "customer@shop.local",
      password: customerPassword,
      name: "Test Customer",
      role: UserRole.CUSTOMER,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
      customerProfile: { create: {} },
    },
  });

  // ===== Test vendor =====
  const vendorPassword = await bcrypt.hash("Vendor@12345", 12);
  await prisma.user.upsert({
    where: { email: "vendor@shop.local" },
    update: {},
    create: {
      email: "vendor@shop.local",
      password: vendorPassword,
      name: "Test Vendor",
      role: UserRole.VENDOR,
      status: UserStatus.ACTIVE,
      emailVerified: new Date(),
      vendorProfile: {
        create: {
          shopName: "Test Vendor Shop",
          shopSlug: "test-vendor-shop",
          status: "APPROVED",
          verifiedAt: new Date(),
        },
      },
    },
  });

  console.log("✅ Seed complete");
  console.log("   Admin   : admin@shop.local    / Admin@12345");
  console.log("   Customer: customer@shop.local / Customer@12345");
  console.log("   Vendor  : vendor@shop.local   / Vendor@12345");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
