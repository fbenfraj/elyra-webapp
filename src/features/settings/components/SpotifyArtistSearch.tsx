"use client";

import { useState, useEffect, useRef } from "react";
import { Search, Music, Loader2 } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

type ArtistResult = { id: string; name: string; imageUrl: string | null };

interface SpotifyArtistSearchProps {
  onSelect: (artist: ArtistResult) => void;
}

export function SpotifyArtistSearch({ onSelect }: SpotifyArtistSearchProps) {
  const trpc = useTRPC();
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    setOpen(debouncedQuery.length >= 2);
  }, [debouncedQuery]);

  useEffect(() => {
    function handleMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleMouseDown);
    return () => document.removeEventListener("mousedown", handleMouseDown);
  }, []);

  const { data: results, isFetching } = useQuery({
    ...trpc.user.searchArtists.queryOptions({ query: debouncedQuery }),
    enabled: debouncedQuery.length >= 2,
    staleTime: 30_000,
  });

  function handleSelect(artist: ArtistResult) {
    onSelect(artist);
    setQuery("");
    setDebouncedQuery("");
    setOpen(false);
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative flex items-center">
        <Search className="pointer-events-none absolute left-3 size-4 text-zinc-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (debouncedQuery.length >= 2) setOpen(true);
          }}
          placeholder="Search for an artist…"
          className="w-full rounded-lg border border-zinc-700/50 bg-zinc-900 py-2 pl-9 pr-9 text-sm text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:ring-2 focus:ring-zinc-600"
        />
        {isFetching && (
          <Loader2 className="pointer-events-none absolute right-3 size-4 animate-spin text-zinc-400" />
        )}
      </div>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-1 w-full overflow-hidden rounded-lg border border-zinc-700/50 bg-zinc-900 py-1 shadow-lg"
        >
          {!isFetching && results && results.length === 0 && (
            <li className="px-3 py-2 text-sm text-zinc-500">No artists found</li>
          )}
          {results?.map((artist) => (
            <li
              key={artist.id}
              role="option"
              aria-selected={false}
              onClick={() => handleSelect(artist)}
              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm text-zinc-100 hover:bg-zinc-800"
            >
              {artist.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={artist.imageUrl}
                  alt={artist.name}
                  width={36}
                  height={36}
                  className="size-9 shrink-0 rounded-full object-cover"
                />
              ) : (
                <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-zinc-800">
                  <Music className="size-4 text-zinc-400" />
                </div>
              )}
              <span className="truncate">{artist.name}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
