"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

export function SearchInput({ baseUrl, className }: { baseUrl: string; className?: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const urlQuery = searchParams.get("q") || "";
  // null = "mirror the URL value"; set to a string while user is typing before
  // the debounce fires. Clears itself after navigation, so back/forward always
  // shows the URL value without needing a useEffect or ref-during-render sync.
  const [pendingQuery, setPendingQuery] = useState<string | null>(null);
  const displayQuery = pendingQuery ?? urlQuery;

  const navigate = (value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("q", value);
    } else {
      params.delete("q");
    }
    router.replace(`${baseUrl}?${params.toString()}`);
    setPendingQuery(null);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setPendingQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => navigate(value), 300);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    navigate(displayQuery);
  };

  const handleClear = () => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setPendingQuery(null);
    navigate("");
  };

  return (
    <form onSubmit={handleSubmit} className={`relative ${className ?? ""}`}>
      <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <Input
        value={displayQuery}
        onChange={handleChange}
        placeholder="Search files & content..."
        className="pl-9 pr-8 w-full"
      />
      {displayQuery && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          aria-label="Clear search"
        >
          <X className="size-3.5" />
        </button>
      )}
    </form>
  );
}
