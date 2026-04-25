"use client";

import { Music, X } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SpotifyArtistSearch } from "@/features/settings/components/SpotifyArtistSearch";

type ArtistResult = { id: string; name: string; imageUrl: string | null };

export function SpotifyArtistSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: settings, isLoading } = useQuery(trpc.user.settings.queryOptions());

  const setArtist = useMutation(
    trpc.user.setSpotifyArtist.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.user.settings.queryKey() });
        toast.success("Artist saved");
      },
    })
  );

  const clearArtist = useMutation(
    trpc.user.clearSpotifyArtist.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: trpc.user.settings.queryKey() });
        toast.success("Artist removed");
      },
    })
  );

  function handleSelect(artist: ArtistResult) {
    setArtist.mutate({
      id: artist.id,
      name: artist.name,
      imageUrl: artist.imageUrl,
    });
  }

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900 p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">Spotify Artist</h2>
        <p className="mt-1 text-sm text-zinc-400">
          Link your Spotify artist profile to personalise your album cover generation.
        </p>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-3">
          <div className="size-12 shrink-0 animate-pulse rounded-full bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-4 w-32 animate-pulse rounded bg-zinc-800" />
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-800" />
          </div>
        </div>
      ) : settings?.artistId ? (
        <div className="flex items-center gap-3">
          {settings.artistImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.artistImageUrl}
              alt={settings.artistName ?? "Artist"}
              width={48}
              height={48}
              className="size-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-zinc-800">
              <Music className="size-5 text-zinc-400" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="truncate text-sm font-medium text-zinc-100">
              {settings.artistName}
            </p>
          </div>
          <Button
            variant="ghost-secondary"
            size="sm"
            onClick={() => clearArtist.mutate()}
            disabled={clearArtist.isPending}
          >
            <X className="size-3.5" />
            Remove
          </Button>
        </div>
      ) : (
        <p className="text-sm text-zinc-400">No artist connected yet</p>
      )}

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
          {settings?.artistId ? "Change artist" : "Search artist"}
        </p>
        <SpotifyArtistSearch onSelect={handleSelect} />
      </div>
    </div>
  );
}
