/**
 * Temporary stand-in for routes whose real pages are being ported from the
 * existing Next.js apps. Replaced module-by-module during migration.
 */
export function ModulePlaceholder({
  title,
  note,
}: {
  title: string
  note?: string
}) {
  return (
    <div className="space-y-1">
      <h1 className="text-lg font-semibold">{title}</h1>
      <p className="text-sm text-muted-foreground">
        {note ?? "Placeholder — real page ported in a later phase."}
      </p>
    </div>
  )
}
