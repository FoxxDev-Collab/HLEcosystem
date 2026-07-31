import { posterUrl } from "./format"

export function Poster({
  src,
  title,
  className = "",
}: {
  src: string | null
  title: string
  className?: string
}) {
  const url = posterUrl(src)
  return (
    <div className={`aspect-[2/3] overflow-hidden bg-muted ${className}`}>
      {url ? (
        <img
          src={url}
          alt={title}
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="grid h-full w-full place-items-center p-3 text-center text-xs text-muted-foreground">
          {title}
        </div>
      )}
    </div>
  )
}
