import "dotenv/config";
import { PrismaNeon } from "@prisma/adapter-neon";
import { PrismaClient } from "../src/generated/prisma/client";
import bcrypt from "bcryptjs";

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not set");

  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

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

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
