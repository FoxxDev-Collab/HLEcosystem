// Bun's native Postgres client, taken from the runtime global so Vite never
// has to resolve a "bun" module specifier (that fails in the dev SSR module
// runner). Tagged-template interpolation is parameterized automatically
// (`sql`...WHERE id = ${id}``) — satisfies "parameterized queries only".
// No ORM, no driver adapter.
if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required")
}

export const sql = Bun.sql
