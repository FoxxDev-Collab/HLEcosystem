import { sql } from "../src/server/db"

// Idempotent dev seed: provisions the instance ADMIN with an OWNER household.
// On conflict it refreshes the name but NOT the password (so an existing
// admin keeps whatever password it already has).
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? "admin@hle.local"
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD ?? "ChangeMe123!"
const ADMIN_FIRST = process.env.SEED_ADMIN_FIRST_NAME ?? "Admin"
const ADMIN_LAST = process.env.SEED_ADMIN_LAST_NAME ?? "User"

async function main() {
  const passwordHash = await Bun.password.hash(ADMIN_PASSWORD, {
    algorithm: "bcrypt",
    cost: 12,
  })

  const [admin] = (await sql`
    INSERT INTO "User" ("email", "firstName", "lastName", "password", "role", "active")
    VALUES (${ADMIN_EMAIL}, ${ADMIN_FIRST}, ${ADMIN_LAST}, ${passwordHash}, 'ADMIN', true)
    ON CONFLICT ("email") DO UPDATE
      SET "firstName" = EXCLUDED."firstName", "lastName" = EXCLUDED."lastName"
    RETURNING "id", "email", "firstName", "lastName", "role"
  `)

  const displayName = `${admin.firstName} ${admin.lastName}`.trim()

  const member = (await sql`
    SELECT "householdId" FROM "HouseholdMember"
    WHERE "userId" = ${admin.id} LIMIT 1
  `)

  if (member.length === 0) {
    await sql.begin(async (tx) => {
      const [hh] = (await tx`
        INSERT INTO "Household" ("name", "createdById")
        VALUES (${"Admin Household"}, ${admin.id})
        RETURNING "id"
      `)
      await tx`
        INSERT INTO "HouseholdMember" ("householdId", "userId", "displayName", "role")
        VALUES (${hh.id}, ${admin.id}, ${displayName}, 'OWNER')
      `
    })
  }

  const rows = await sql`
    SELECT u."email", u."role", h."name" AS "household", hm."role" AS "householdRole"
    FROM "User" u
    JOIN "HouseholdMember" hm ON hm."userId" = u."id"
    JOIN "Household" h ON h."id" = hm."householdId"
    WHERE u."id" = ${admin.id}
  `

  console.log("Seeded + read back via Bun.sql:")
  console.table(rows)
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
