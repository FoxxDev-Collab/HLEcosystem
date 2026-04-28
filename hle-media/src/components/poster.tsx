import { posterUrl } from "@/lib/format";

export function Poster({
  src,
  title,
  className = "",
}: {
  src: string | null;
  title: string;
  className?: string;
}) {
  const url = posterUrl(src);
  return (
    <div className={`aspect-[2/3] bg-muted overflow-hidden ${className}`}>
      {url ? (
        <img
          src={url}
          alt={title}
          className="w-full h-full object-cover"
          loading="lazy"
        />
      ) : (
        <div className="w-full h-full grid place-items-center p-3 text-center text-xs text-muted-foreground">
          {title}
        </div>
      )}
    </div>
  );
}
