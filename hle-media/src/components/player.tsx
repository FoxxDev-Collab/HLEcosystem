import { Button } from "@/components/ui/button";
import { navigate } from "@/lib/router";

export function Player({ fileId }: { fileId: string }) {
  return (
    <div className="space-y-4">
      <Button variant="ghost" onClick={() => window.history.back()}>
        ← Back
      </Button>
      <video
        controls
        autoPlay
        playsInline
        className="w-full max-h-[80vh] bg-black rounded-lg"
        src={`/api/stream/${encodeURIComponent(fileId)}`}
        onError={(e) => {
          const v = e.currentTarget;
          // The MediaError code surface is small; just log + nudge the user
          // to re-scan if the file is missing.
          console.warn("video error", v.error);
        }}
      />
      <p className="text-xs text-muted-foreground">
        If playback fails, the file's container may not be browser-direct-play
        (e.g. MKV). Phase 2 will add an on-demand transcoder.{" "}
        <button
          className="underline"
          onClick={() => navigate("/")}
        >
          Back to library
        </button>
      </p>
    </div>
  );
}
