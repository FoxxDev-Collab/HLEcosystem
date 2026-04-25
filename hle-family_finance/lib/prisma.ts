import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const basePrisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

export const prisma = basePrisma;
export default basePrisma;

/**
 * Returns a Prisma client that activates the RLS household context for every
 * operation. Use this in authenticated Server Actions instead of the bare
 * `prisma` singleton to enable Row-Level Security enforcement.
 *
 * The session variable app.household_id is set via SET LOCAL (scoped to the
 * current transaction) before each query. The RLS policies on Transaction and
 * Account will then restrict visible rows to that household.
 *
 * Migration path: replace `prisma` with `getScopedPrisma(householdId)` in
 * Server Actions that already have the householdId in scope. Once all actions
 * use the scoped client, remove the permissive fallback from the RLS policies
 * to make enforcement strict.
 */
export function getScopedPrisma(householdId: string) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const [, result] = await basePrisma.$transaction([
            basePrisma.$executeRaw`SELECT set_config('app.household_id', ${householdId}, true)`,
            query(args),
          ]);
          return result;
        },
      },
    },
  });
}
