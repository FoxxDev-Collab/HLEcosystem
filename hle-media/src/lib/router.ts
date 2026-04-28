import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "movie"; id: string }
  | { name: "series"; id: string }
  | { name: "play"; fileId: string };

function parseHash(hash: string): Route {
  const p = hash.replace(/^#\/?/, "");
  if (!p) return { name: "home" };
  const parts = p.split("/").filter(Boolean);
  if (parts[0] === "movies" && parts[1]) return { name: "movie", id: parts[1] };
  if (parts[0] === "series" && parts[1]) return { name: "series", id: parts[1] };
  if (parts[0] === "play" && parts[1]) return { name: "play", fileId: parts[1] };
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
