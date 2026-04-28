import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "movie"; id: string }
  | { name: "series"; id: string }
  | { name: "play"; fileId: string };

// All IDs we generate are UUIDs (see node:crypto.randomUUID() in the
// scanner). Anything that doesn't look like one cannot have come from
// our own data and must not be allowed to flow into a fetch URL — this
// closes the CodeQL js/request-forgery sink fed by window.location.hash.
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidId(s: string | undefined | null): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

function parseHash(hash: string): Route {
  const p = hash.replace(/^#\/?/, "");
  if (!p) return { name: "home" };
  const parts = p.split("/").filter(Boolean);
  if (parts[0] === "movies" && isValidId(parts[1])) {
    return { name: "movie", id: parts[1] };
  }
  if (parts[0] === "series" && isValidId(parts[1])) {
    return { name: "series", id: parts[1] };
  }
  if (parts[0] === "play" && isValidId(parts[1])) {
    return { name: "play", fileId: parts[1] };
  }
  return { name: "home" };
}

export function useRoute(): Route {
  const [hash, setHash] = useState(() =>
    typeof window === "undefined" ? "" : window.location.hash,
  );
  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return parseHash(hash);
}

export function navigate(to: string) {
  window.location.hash = to.startsWith("/") ? to : `/${to}`;
}
