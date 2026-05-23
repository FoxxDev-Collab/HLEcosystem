import { readdir } from "node:fs/promises";
import path from "node:path";
import { sql } from "./db";

const MIGRATIONS_DIR = path.resolve(import.meta.dir, "../../migrations");
const SCHEMA = "media";

type AppliedRow = { id: string; checksum: string };

export async function runMigrations(): Promise<void> {
  await sql.unsafe(`CREATE SCHEMA IF NOT EXISTS "${SCHEMA}"`);
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "${SCHEMA}"."_migrations" (
      "id"        TEXT PRIMARY KEY,
      "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
      "checksum"  TEXT NOT NULL
    )
  `);

  const files = (await readdir(MIGRATIONS_DIR))
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const appliedRows = (await sql`
    SELECT "id", "checksum" FROM media."_migrations"
  `) as AppliedRow[];
  const applied = new Map(appliedRows.map((r) => [r.id, r.checksum]));

  let pending = 0;
  for (const file of files) {
    const id = file.replace(/\.sql$/, "");
    const content = await Bun.file(path.join(MIGRATIONS_DIR, file)).text();
    const checksum = new Bun.CryptoHasher("sha256")
      .update(content)
      .digest("hex");

    const prior = applied.get(id);
    if (prior !== undefined) {
      if (prior !== checksum) {
        throw new Error(
          `migration drift: ${id} on disk does not match the checksum recorded ` +
            `in media."_migrations". Applied migrations must not be edited. ` +
            `If this is intentional, write a new migration that fixes the prior one.`,
        );
      }
      continue;
    }

    pending++;
    console.log(`→ applying ${id}`);
    await sql.begin(async (tx) => {
      await tx.unsafe(content);
      await tx`
        INSERT INTO media."_migrations" ("id", "checksum")
        VALUES (${id}, ${checksum})
      `;
    });
    console.log(`✓ applied  ${id}`);
  }

  if (pending === 0) {
    console.log("migrations: nothing to apply");
  }
}
