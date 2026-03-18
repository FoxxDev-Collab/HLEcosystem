import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_EXPENSE_CATEGORIES = [
  { name: "Groceries", icon: "shopping-cart", color: "#22c55e" },
  { name: "Dining Out", icon: "utensils", color: "#f97316" },
  { name: "Gas & Fuel", icon: "fuel", color: "#eab308" },
  { name: "Utilities", icon: "zap", color: "#3b82f6" },
  { name: "Rent / Mortgage", icon: "home", color: "#8b5cf6" },
  { name: "Insurance", icon: "shield", color: "#6366f1" },
  { name: "Medical & Health", icon: "heart-pulse", color: "#ef4444" },
  { name: "Transportation", icon: "car", color: "#14b8a6" },
  { name: "Entertainment", icon: "tv", color: "#ec4899" },
  { name: "Shopping", icon: "shopping-bag", color: "#a855f7" },
  { name: "Subscriptions", icon: "repeat", color: "#0ea5e9" },
  { name: "Education", icon: "graduation-cap", color: "#06b6d4" },
  { name: "Personal Care", icon: "scissors", color: "#f472b6" },
  { name: "Clothing", icon: "shirt", color: "#d946ef" },
  { name: "Home Maintenance", icon: "wrench", color: "#78716c" },
  { name: "Childcare", icon: "baby", color: "#fb923c" },
  { name: "Pets", icon: "paw-print", color: "#84cc16" },
  { name: "Gifts & Donations", icon: "gift", color: "#e11d48" },
  { name: "Travel", icon: "plane", color: "#0284c7" },
  { name: "Taxes", icon: "landmark", color: "#475569" },
  { name: "Fees & Charges", icon: "receipt", color: "#94a3b8" },
  { name: "Miscellaneous", icon: "ellipsis", color: "#71717a" },
];

const DEFAULT_INCOME_CATEGORIES = [
  { name: "Salary", icon: "briefcase", color: "#22c55e" },
  { name: "Freelance / Side Hustle", icon: "laptop", color: "#10b981" },
  { name: "Investment Income", icon: "trending-up", color: "#0ea5e9" },
  { name: "Rental Income", icon: "building", color: "#8b5cf6" },
  { name: "Refunds", icon: "rotate-ccw", color: "#6366f1" },
  { name: "Gifts Received", icon: "gift", color: "#f59e0b" },
  { name: "Other Income", icon: "plus-circle", color: "#64748b" },
];

const DEFAULT_TRANSFER_CATEGORIES = [
  { name: "Transfer", icon: "arrow-left-right", color: "#94a3b8" },
  { name: "Credit Card Payment", icon: "credit-card", color: "#64748b" },
  { name: "Savings Transfer", icon: "piggy-bank", color: "#22c55e" },
  { name: "Investment Transfer", icon: "trending-up", color: "#3b82f6" },
];

async function main() {
  // Get households from the central family_manager schema
  const households = await prisma.$queryRaw<{ id: string; name: string }[]>`
    SELECT "id", "name" FROM family_manager."Household" ORDER BY "name"
  `;

  if (households.length === 0) {
    console.log("No households found. Default categories will be created when a household is set up.");
    console.log("The app will seed categories on first household creation.");
    return;
  }

  for (const household of households) {
    console.log(`Seeding categories for household: ${household.name}`);

    const existingCount = await prisma.category.count({
      where: { householdId: household.id },
    });

    if (existingCount > 0) {
      console.log(`  Skipping — ${existingCount} categories already exist`);
      continue;
    }

    let sortOrder = 0;

    for (const cat of DEFAULT_EXPENSE_CATEGORIES) {
      await prisma.category.create({
        data: {
          householdId: household.id,
          name: cat.name,
          type: "EXPENSE",
          icon: cat.icon,
          color: cat.color,
          sortOrder: sortOrder++,
        },
      });
    }

    for (const cat of DEFAULT_INCOME_CATEGORIES) {
      await prisma.category.create({
        data: {
          householdId: household.id,
          name: cat.name,
          type: "INCOME",
          icon: cat.icon,
          color: cat.color,
          sortOrder: sortOrder++,
        },
      });
    }

    for (const cat of DEFAULT_TRANSFER_CATEGORIES) {
      await prisma.category.create({
        data: {
          householdId: household.id,
          name: cat.name,
          type: "TRANSFER",
          icon: cat.icon,
          color: cat.color,
          sortOrder: sortOrder++,
        },
      });
    }

    console.log(`  Created ${sortOrder} default categories`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
