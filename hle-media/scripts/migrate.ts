import { runMigrations } from "../src/server/migrate";

try {
  await runMigrations();
  process.exit(0);
} catch (err) {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
}
