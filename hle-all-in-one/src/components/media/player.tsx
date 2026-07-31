import { Link } from "@tanstack/react-router"
import { ArrowLeft } from "lucide-react"
import { Button } from "@/components/ui/button"

// HTML5 direct-play against the range-aware streaming endpoint. Legacy
// player semantics: autoplay, inline playback, and the container caveat —
// browsers cannot direct-play MKV / AVI; those wait on the Phase 2
// transcoder.
export function Player({ fileId }: { fileId: string }) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" render={<Link to="/media" />}>
        <ArrowLeft className="size-4" /> Back to library
      </Button>
      <video
        controls
        autoPlay
        playsInline
        className="max-h-[80vh] w-full rounded-lg bg-black"
        src={`/api/media/stream/${encodeURIComponent(fileId)}`}
        onError={(e) => {
          // The MediaError code surface is small; just log + the caveat text
          // below nudges the user if the container isn't direct-playable.
          console.warn("video error", e.currentTarget.error)
        }}
      />
      <p className="text-xs text-muted-foreground">
        If playback fails, the file&apos;s container may not be
        browser-direct-play (e.g. MKV). Phase 2 will add an on-demand
        transcoder.
      </p>
    </div>
  )
}
