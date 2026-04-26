"use client";

import { Music, X, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SpotifyArtistSearch } from "@/features/settings/components/SpotifyArtistSearch";
import { useRouter } from "next/navigation";

type SearchResult = { id: string; name: string; imageUrl: string | null };

export function SpotifyArtistSettings() {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const router = useRouter();

  const { data: settings, isLoading } = useQuery(
    trpc.user.settings.queryOptions()
  );

  const syncAndSelect = useMutation(
    trpc.user.syncArtist.mutationOptions({
      onSuccess: async (data) => {
        await selectArtist.mutateAsync({ artistId: data.id });
      },
      onError: () => {
        toast.error("Failed to sync artist from Spotify");
      },
    })
  );

  const selectArtist = useMutation(
    trpc.user.selectArtist.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.user.settings.queryKey(),
        });
        toast.success("Artist saved");
        const cached = queryClient.getQueryData(trpc.moodboard.active.queryKey());
        if (!cached) {
          router.push("/onboarding/moodboard");
        }
      },
    })
  );

  const clearArtist = useMutation(
    trpc.user.clearArtist.mutationOptions({
      onSuccess: async () => {
        await queryClient.invalidateQueries({
          queryKey: trpc.user.settings.queryKey(),
        });
        toast.success("Artist removed");
      },
    })
  );

  function handleSelect(artist: SearchResult) {
    syncAndSelect.mutate({ spotifyId: artist.id });
  }

  const isSyncing = syncAndSelect.isPending || selectArtist.isPending;

  return (
    <div className="rounded-xl border border-zinc-700/50 bg-zinc-900 p-6 space-y-5">
      <div>
        <h2 className="text-base font-semibold text-zinc-100">
          Spotify Artist
        </h2>
        <p className="mt-1 text-sm text-zinc-400">
          Link your Spotify artist profile to personalise your album cover
          generation.
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
            {settings.artistGenres && settings.artistGenres.length > 0 && (
              <p className="truncate text-xs text-zinc-500">
                {settings.artistGenres.join(" · ")}
              </p>
            )}
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

      {isSyncing && (
        <div className="flex items-center gap-2 text-sm text-zinc-400">
          <Loader2 className="size-4 animate-spin" />
          Syncing artist data from Spotify...
        </div>
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
