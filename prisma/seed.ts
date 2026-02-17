import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prisma = new (PrismaClient as any)();

async function main() {
  console.log("Seeding database...");

  // Create test organization
  const org = await prisma.organization.create({
    data: {
      name: "Acme Manufacturing",
      slug: "acme-manufacturing",
    },
  });

  console.log(`Created organization: ${org.name}`);

  // Create admin user
  const adminPassword = await bcrypt.hash("admin123", 12);
  const admin = await prisma.user.create({
    data: {
      name: "Admin User",
      email: "admin@acme.com",
      passwordHash: adminPassword,
      role: "ADMIN",
      organizationId: org.id,
    },
  });

  console.log(`Created admin: ${admin.email} (password: admin123)`);

  // Create worker user
  const workerPassword = await bcrypt.hash("worker123", 12);
  const worker = await prisma.user.create({
    data: {
      name: "John Worker",
      email: "worker@acme.com",
      passwordHash: workerPassword,
      role: "WORKER",
      organizationId: org.id,
    },
  });

  console.log(`Created worker: ${worker.email} (password: worker123)`);

  console.log("\nSeed complete! You can now log in with:");
  console.log("  Admin: admin@acme.com / admin123");
  console.log("  Worker: worker@acme.com / worker123");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
