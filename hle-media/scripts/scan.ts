import { scanLibrary } from "../src/server/scanner";

const householdId = process.argv[2] ?? process.env.MEDIA_HOUSEHOLD_ID;
const rootPath =
  process.argv[3] ?? process.env.MEDIA_LIBRARY_PATH ?? "/app/library";

if (!householdId) {
  console.error("usage: bun scripts/scan.ts <householdId> [rootPath]");
  console.error("   or: MEDIA_HOUSEHOLD_ID=… MEDIA_LIBRARY_PATH=… bun scripts/scan.ts");
  process.exit(2);
}

console.log(`scanning ${rootPath} for household ${householdId}…`);
const summary = await scanLibrary({ householdId, rootPath });
console.log(JSON.stringify(summary, null, 2));
process.exit(0);
