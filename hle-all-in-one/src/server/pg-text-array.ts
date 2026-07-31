// The ONLY way to bind a Postgres array column value. Bun 1.3.x binds a JS
// array parameter as a comma-joined string (`["a","b"]` → `a,b`), so
// `${arr}` into a TEXT[] column throws `malformed array literal` — an
// explicit `::text[]` cast does not help (the value is already wrong), and
// `sql.array()` silently CORRUPTS instead (elements gain literal quotes).
// This builds the array-literal syntax by hand — each element in double
// quotes, backslash and double-quote escaped — and stays a single bound
// parameter, so it is still fully parameterized. Use as:
// ${pgTextArray(tags)}::text[] (sql-invariants.test.ts enforces the cast
// never appears without it). Pure module (no Bun global) so unit tests can
// import it without a DATABASE_URL.
export function pgTextArray(items: Array<string>): string {
  const escaped = items.map(
    (s) => `"${s.replaceAll("\\", "\\\\").replaceAll('"', '\\"')}"`
  )
  return `{${escaped.join(",")}}`
}
