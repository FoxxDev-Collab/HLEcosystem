#!/usr/bin/env node

// seed-admin.js — First-run admin user + household seeding
// Runs on container startup if ADMIN_EMAIL is set and no users exist.
// Requires: DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME (optional), HOUSEHOLD_NAME (optional)

const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

async function main() {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.log("[seed] ADMIN_EMAIL or ADMIN_PASSWORD not set — skipping seed.");
    return;
  }

  const prisma = new PrismaClient();

  try {
    // Only seed if no users exist (first-run guard)
    const userCount = await prisma.user.count();
    if (userCount > 0) {
      console.log(`[seed] ${userCount} user(s) already exist — skipping seed.`);
      return;
    }

    const name = process.env.ADMIN_NAME || "Admin";
    const householdName = process.env.HOUSEHOLD_NAME || "My Household";
    const hash = await bcrypt.hash(password, 12);

    // Create admin user
    const user = await prisma.user.create({
      data: {
        email,
        name,
        password: hash,
        role: "ADMIN",
        active: true,
      },
    });
    console.log(`[seed] Created admin user: ${user.email} (${user.id})`);

    // Create default household
    const household = await prisma.household.create({
      data: {
        name: householdName,
      },
    });
    console.log(`[seed] Created household: ${household.name} (${household.id})`);

    // Link user to household as admin
    await prisma.householdMember.create({
      data: {
        userId: user.id,
        householdId: household.id,
        displayName: name,
        role: "ADMIN",
      },
    });
    console.log(`[seed] Linked ${user.email} to "${household.name}" as ADMIN`);
    console.log("[seed] First-run setup complete. You can now log in.");
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error("[seed] Error:", err.message);
  // Don't crash the container — seed failure shouldn't prevent startup
  process.exit(0);
});
