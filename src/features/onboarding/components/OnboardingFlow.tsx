"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Music, Loader2, AlertCircle, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SpotifyArtistSearch } from "@/features/settings/components/SpotifyArtistSearch";

type SearchResult = { id: string; name: string; imageUrl: string | null };

type SyncedArtist = {
  id: string;
  name: string;
  profileImageUrl: string | null;
  genres: string[] | null;
  popularity: number | null;
  followerCount: number | null;
  albums: Array<{
    id: string;
    name: string;
    releaseDate: string;
    albumType: string;
    coverImageUrl: string | null;
  }>;
};

export function OnboardingFlow() {
  const trpc = useTRPC();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [syncedArtist, setSyncedArtist] = useState<SyncedArtist | null>(null);
  const [syncError, setSyncError] = useState(false);

  const syncArtist = useMutation(
    trpc.user.syncArtist.mutationOptions({
      onSuccess: (data) => {
        setSyncedArtist(data);
        setSyncError(false);
      },
      onError: () => {
        setSyncError(true);
      },
    })
  );

  const completeOnboarding = useMutation(
    trpc.user.completeOnboarding.mutationOptions({
      onSuccess: async () => {
        await Promise.all([
          queryClient.invalidateQueries({
            queryKey: trpc.user.onboardingStatus.queryKey(),
          }),
          queryClient.invalidateQueries({
            queryKey: trpc.user.settings.queryKey(),
          }),
        ]);
        toast.success("Welcome to Elyra!");
        if (syncedArtist) {
          router.push("/onboarding/message");
        } else {
          router.push("/dashboard");
        }
      },
    })
  );

  function handleSelect(artist: SearchResult) {
    setSyncedArtist(null);
    setSyncError(false);
    syncArtist.mutate({ spotifyId: artist.id });
  }

  function handleContinue() {
    if (!syncedArtist) return;
    completeOnboarding.mutate({ artistId: syncedArtist.id });
  }

  function handleSkip() {
    completeOnboarding.mutate({});
  }

  const isSubmitting = completeOnboarding.isPending;

  return (
    <div className="w-full space-y-8 text-center">
      <div>
        <h1 className="text-2xl font-semibold text-zinc-100">
          Welcome to Elyra
        </h1>
        <p className="mt-2 text-sm text-zinc-400">
          Link your Spotify artist to personalise your album cover generation.
        </p>
      </div>

      <div className="mx-auto max-w-md">
        <SpotifyArtistSearch onSelect={handleSelect} />
      </div>

      {syncArtist.isPending && (
        <div className="flex items-center justify-center gap-2 text-sm text-zinc-400">
          <Loader2 className="size-4 animate-spin" />
          Fetching artist data from Spotify...
        </div>
      )}

      {syncError && (
        <div className="mx-auto max-w-md rounded-lg border border-red-800/50 bg-red-950/30 p-4">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle className="size-4 shrink-0" />
            Failed to fetch artist data. Spotify may be temporarily unavailable.
          </div>
          <Button
            variant="ghost-secondary"
            size="sm"
            className="mt-2"
            onClick={() => {
              if (syncArtist.variables) {
                syncArtist.mutate(syncArtist.variables);
              }
            }}
          >
            <RefreshCw className="size-3.5" />
            Retry
          </Button>
        </div>
      )}

      {syncedArtist && (
        <div className="mx-auto max-w-md rounded-xl border border-zinc-700/50 bg-zinc-900 p-6 text-left">
          <div className="mb-5 flex items-center gap-4">
            {syncedArtist.profileImageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={syncedArtist.profileImageUrl}
                alt={syncedArtist.name}
                width={64}
                height={64}
                className="size-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-zinc-800">
                <Music className="size-6 text-zinc-400" />
              </div>
            )}
            <div>
              <p className="text-lg font-semibold text-zinc-100">
                {syncedArtist.name}
              </p>
              {syncedArtist.genres && syncedArtist.genres.length > 0 && (
                <p className="text-xs text-zinc-500">
                  {syncedArtist.genres.join(" · ")}
                </p>
              )}
              {syncedArtist.followerCount !== null && (
                <p className="text-xs text-zinc-600">
                  {new Intl.NumberFormat().format(syncedArtist.followerCount)}{" "}
                  followers
                </p>
              )}
            </div>
          </div>

          {syncedArtist.albums.length > 0 && (
            <div>
              <p className="mb-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
                Album Covers ({syncedArtist.albums.length})
              </p>
              <div className="grid grid-cols-4 gap-2">
                {syncedArtist.albums.slice(0, 8).map((album) =>
                  album.coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={album.id}
                      src={album.coverImageUrl}
                      alt={album.name}
                      width={80}
                      height={80}
                      className="aspect-square rounded-md object-cover"
                      title={`${album.name} (${album.releaseDate})`}
                    />
                  ) : (
                    <div
                      key={album.id}
                      className="flex aspect-square items-center justify-center rounded-md bg-zinc-800"
                    >
                      <Music className="size-4 text-zinc-600" />
                    </div>
                  )
                )}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mx-auto flex max-w-md items-center justify-end gap-3">
        <Button
          variant="ghost-secondary"
          onClick={handleSkip}
          disabled={isSubmitting}
        >
          Skip for now
        </Button>
        <Button
          onClick={handleContinue}
          disabled={!syncedArtist || isSubmitting}
        >
          {isSubmitting && <Loader2 className="size-4 animate-spin" />}
          Continue
        </Button>
      </div>
    </div>
  );
}
