"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { motion } from "motion/react";
import { Sparkles, Palette, Download, Plus, Music2, Disc3, ArrowRight } from "lucide-react";
import { MoodboardDashboardPrompt } from "@/features/moodboard/components/MoodboardDashboardPrompt";
import { MoodboardIdentityHero } from "@/features/moodboard/components/MoodboardIdentityHero";
import { Button } from "@/components/ui/button";
import { SessionCard } from "@/features/session/components/SessionCard";
import {
  AnimatedDashboardContainer,
  AnimatedDashboardItem,
  AnimatedCardItem,
} from "@/features/session/components/DashboardAnimations";

function SessionListSkeleton() {
  return (
    <motion.div
      className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="overflow-hidden rounded-xl border border-[var(--border)]">
          <div className="aspect-square animate-pulse bg-[var(--background-overlay)]" />
          <div className="flex items-center justify-between px-3 py-2">
            <div className="h-3 w-16 animate-pulse rounded bg-[var(--background-overlay)]" />
            <div className="h-3 w-10 animate-pulse rounded bg-[var(--background-overlay)]" />
          </div>
        </div>
      ))}
    </motion.div>
  );
}

function ArtistHero({
  artistName,
  artistImageUrl,
  artistGenres,
  sessionCount,
}: {
  artistName: string;
  artistImageUrl: string | null;
  artistGenres: string[] | null;
  sessionCount: number;
}) {
  return (
    <AnimatedDashboardItem>
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-[var(--border)]">
        {/* Background: blurred artist image or gradient */}
        <div className="absolute inset-0 -z-10">
          {artistImageUrl ? (
            <>
              <Image
                src={artistImageUrl}
                alt=""
                fill
                className="object-cover blur-2xl saturate-[0.6]"
                sizes="100vw"
              />
              <div className="absolute inset-0 bg-[#09090b]/70" />
            </>
          ) : (
            <div
              className="h-full w-full"
              style={{
                background:
                  "linear-gradient(135deg, #18181b 0%, #27272a 50%, #18181b 100%)",
              }}
            />
          )}
        </div>

        {/* Content */}
        <div className="flex items-center gap-6 px-8 py-8">
          {/* Artist profile image */}
          {artistImageUrl ? (
            <div className="relative size-20 shrink-0 overflow-hidden rounded-full border-2 border-white/10 shadow-2xl">
              <Image
                src={artistImageUrl}
                alt={artistName}
                fill
                className="object-cover"
                sizes="80px"
              />
            </div>
          ) : (
            <div className="flex size-20 shrink-0 items-center justify-center rounded-full border-2 border-white/10 bg-[var(--background-overlay)]">
              <Music2 className="size-8 text-[var(--foreground-subtle)]" />
            </div>
          )}

          {/* Text */}
          <div className="min-w-0 flex-1">
            <h1 className="text-2xl font-semibold tracking-tight text-white">
              {artistName}
            </h1>
            {artistGenres && artistGenres.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {artistGenres.slice(0, 3).map((genre) => (
                  <span
                    key={genre}
                    className="rounded-full bg-white/8 px-3 py-0.5 text-xs text-[var(--foreground-muted)]"
                  >
                    {genre}
                  </span>
                ))}
              </div>
            )}
            <p className="mt-2 text-sm text-[var(--foreground-subtle)]">
              {sessionCount} release{sessionCount !== 1 ? "s" : ""} created
            </p>
          </div>
        </div>
      </div>
    </AnimatedDashboardItem>
  );
}

function GeneratedWorkStrip() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data } = useQuery(
    trpc.library.list.queryOptions({ page: 1 })
  );

  if (!data || data.images.length === 0) return null;

  const preview = data.images.slice(0, 8);

  return (
    <AnimatedDashboardItem className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
          Generated work
        </h3>
        <button
          onClick={() => router.push("/dashboard/library")}
          className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
        >
          View all
          <ArrowRight className="size-3.5" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {preview.map((img) => (
          <div
            key={img.id}
            className="relative size-32 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] transition-all duration-300 hover:border-[#3f3f46]"
          >
            <img
              src={img.imageUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          </div>
        ))}
        {data.total > 8 && (
          <button
            onClick={() => router.push("/dashboard/library")}
            className="flex size-32 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] text-[var(--foreground-subtle)] transition-colors hover:border-[#3f3f46] hover:text-[var(--foreground-muted)]"
          >
            <span className="text-2xl font-light">+{data.total - 8}</span>
            <span className="text-[11px]">View all</span>
          </button>
        )}
      </div>
    </AnimatedDashboardItem>
  );
}

function ReferencesStrip() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: references } = useQuery(
    trpc.reference.list.queryOptions()
  );

  if (!references || references.length === 0) return null;

  const preview = references.slice(0, 8);

  return (
    <AnimatedDashboardItem className="mt-10">
      <div className="mb-4 flex items-center justify-between">
        <h3 className="text-lg font-semibold tracking-tight text-[var(--foreground)]">
          Style references
        </h3>
        <button
          onClick={() => router.push("/dashboard/library")}
          className="flex items-center gap-1 text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
        >
          View all
          <ArrowRight className="size-3.5" />
        </button>
      </div>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {preview.map((ref) => (
          <div
            key={ref.id}
            className="relative size-28 shrink-0 overflow-hidden rounded-xl border border-[var(--border)] transition-all duration-300 hover:border-[#3f3f46]"
          >
            <img
              src={ref.imageUrl}
              alt={ref.originalFilename ?? "Reference"}
              className="h-full w-full object-cover"
            />
            {/* Source badge */}
            <span className="absolute bottom-1.5 left-1.5 rounded-full bg-black/60 px-2 py-0.5 text-[9px] font-medium text-white/80 backdrop-blur-sm">
              {ref.source.startsWith("spotify") ? "Spotify" : "Upload"}
            </span>
          </div>
        ))}
        {references.length > 8 && (
          <button
            onClick={() => router.push("/dashboard/library")}
            className="flex size-28 shrink-0 flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] text-[var(--foreground-subtle)] transition-colors hover:border-[#3f3f46] hover:text-[var(--foreground-muted)]"
          >
            <span className="text-2xl font-light">+{references.length - 8}</span>
            <span className="text-[11px]">View all</span>
          </button>
        )}
      </div>
    </AnimatedDashboardItem>
  );
}

function SpotifySetupPrompt() {
  const router = useRouter();

  return (
    <AnimatedDashboardItem>
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-dashed border-[#3f3f46]">
        {/* Subtle gradient background */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(135deg, rgba(30,215,96,0.06) 0%, #18181b 40%, #18181b 60%, rgba(30,215,96,0.04) 100%)",
          }}
        />

        <div className="flex items-center gap-6 px-8 py-8">
          {/* Spotify-green accent circle */}
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-[#1ed760]/10 ring-1 ring-[#1ed760]/20">
            <Disc3 className="size-7 text-[#1ed760]" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--foreground)]">
              Connect your Spotify artist profile
            </h3>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              Link your artist to get personalized style references from your album covers and profile.
            </p>
          </div>

          <motion.button
            onClick={() => router.push("/settings")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="shrink-0 rounded-full bg-[#1ed760] px-5 py-2 text-sm font-semibold text-[#09090b] shadow-[0_0_15px_rgba(30,215,96,0.15)] transition-shadow duration-300 hover:shadow-[0_0_25px_rgba(30,215,96,0.25)]"
          >
            Set up
          </motion.button>
        </div>
      </div>
    </AnimatedDashboardItem>
  );
}

export function SessionList() {
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectMode, setSelectMode] = useState(false);

  const { data: sessions, isLoading } = useQuery(
    trpc.session.list.queryOptions()
  );

  const { data: userSettings } = useQuery(
    trpc.user.settings.queryOptions()
  );

  const { data: activeMoodboard } = useQuery(
    trpc.moodboard.active.queryOptions()
  );

  const deleteSession = useMutation(
    trpc.session.delete.mutationOptions({
      onSuccess: () => {
        setSelected(new Set());
        setSelectMode(false);
        queryClient.invalidateQueries({ queryKey: trpc.session.list.queryKey() });
      },
    })
  );

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <SessionListSkeleton />;
  }

  if (!sessions || sessions.length === 0) {
    const needsSpotify = userSettings && !userSettings.artistId;
    const needsMoodboard = userSettings?.artistId && !activeMoodboard;

    return (
      <AnimatedDashboardContainer className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden">
        {/* Background image with atmospheric effects */}
        <motion.div
          className="pointer-events-none absolute inset-0 -z-10"
          initial={{ opacity: 0, scale: 1.1 }}
          animate={{ opacity: 1, scale: [1, 1.05, 1] }}
          transition={{
            opacity: { duration: 1.2, ease: "easeOut" },
            scale: { duration: 25, repeat: Infinity, ease: "easeInOut", delay: 1.2 },
          }}
        >
          <Image
            src="/assets/dashboard-bg.png"
            alt=""
            fill
            className="object-cover opacity-50"
            priority
            sizes="100vw"
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 30%, #09090b 75%)",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/60 via-transparent to-[#09090b]/80" />
        </motion.div>

        {/* Headline */}
        <AnimatedDashboardItem>
          <h2 className="text-center text-3xl font-semibold tracking-tight text-white">
            Your creative journey starts here
          </h2>
        </AnimatedDashboardItem>

        {/* Value propositions */}
        <AnimatedDashboardItem>
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-3">
              <Sparkles className="size-4 shrink-0 text-[var(--foreground-muted)]" />
              <span className="text-sm text-[var(--foreground)]">
                Describe your vision in plain language
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Palette className="size-4 shrink-0 text-[var(--foreground-muted)]" />
              <span className="text-sm text-[var(--foreground)]">
                Get multiple creative directions to choose from
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Download className="size-4 shrink-0 text-[var(--foreground-muted)]" />
              <span className="text-sm text-[var(--foreground)]">
                Download ready-to-use release packages
              </span>
            </div>
          </div>
        </AnimatedDashboardItem>

        {/* Setup prompts — Spotify first, then moodboard as hero */}
        {needsSpotify && (
          <AnimatedDashboardItem>
            <button
              onClick={() => router.push("/settings")}
              className="flex items-center gap-4 rounded-xl border border-dashed border-[#3f3f46] bg-white/[0.02] px-6 py-4 text-left transition-colors hover:border-[#1ed760]/40 hover:bg-[#1ed760]/[0.03]"
            >
              <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[#1ed760]/10">
                <Disc3 className="size-5 text-[#1ed760]" />
              </div>
              <div>
                <p className="text-sm font-medium text-[var(--foreground)]">
                  Connect your Spotify artist profile
                </p>
                <p className="text-xs text-[var(--foreground-subtle)]">
                  Get personalized style references from your music
                </p>
              </div>
            </button>
          </AnimatedDashboardItem>
        )}

        {needsMoodboard && (
          <MoodboardDashboardPrompt />
        )}

        {/* CTA — deprioritized when moodboard is missing */}
        <AnimatedDashboardItem>
          {needsMoodboard ? (
            <button
              onClick={() => router.push("/generate")}
              className="flex items-center gap-2 text-sm text-[var(--foreground-subtle)] transition-colors hover:text-[var(--foreground-muted)]"
            >
              <Plus className="size-4" />
              Skip and start generating
            </button>
          ) : (
            <motion.button
              onClick={() => router.push("/generate")}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="flex items-center gap-2 rounded-full bg-white px-8 py-3 text-base font-semibold text-[#09090b] shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.25)]"
            >
              <Plus className="size-5" />
              Start your first release
            </motion.button>
          )}
        </AnimatedDashboardItem>
      </AnimatedDashboardContainer>
    );
  }

  return (
    <AnimatedDashboardContainer>
      {/* Artist hero section — or setup prompt if no artist linked */}
      {(() => {
        if (!userSettings) return null;
        if (!userSettings.artistId) return <SpotifySetupPrompt />;
        if (!activeMoodboard) return <MoodboardDashboardPrompt />;
        if (activeMoodboard.spec) {
          return (
            <MoodboardIdentityHero
              artistName={userSettings.artistName!}
              artistImageUrl={userSettings.artistImageUrl}
              artistGenres={userSettings.artistGenres}
              sessionCount={sessions.length}
              spec={activeMoodboard.spec}
            />
          );
        }
        return (
          <ArtistHero
            artistName={userSettings.artistName!}
            artistImageUrl={userSettings.artistImageUrl}
            artistGenres={userSettings.artistGenres}
            sessionCount={sessions.length}
          />
        );
      })()}

      {/* Header with actions */}
      <AnimatedDashboardItem>
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-xl font-semibold tracking-tight text-[var(--foreground)]">
            Releases
          </h2>
          <div className="flex items-center gap-2">
            {selectMode ? (
              <>
                <Button
                  variant="ghost-secondary"
                  onClick={() => {
                    if (sessions && selected.size < sessions.length) {
                      setSelected(new Set(sessions.map((s) => s.id)));
                    } else {
                      setSelected(new Set());
                    }
                  }}
                >
                  {sessions && selected.size === sessions.length ? "Deselect all" : "Select all"}
                </Button>
                <Button
                  variant="ghost-secondary"
                  onClick={() => {
                    setSelectMode(false);
                    setSelected(new Set());
                  }}
                >
                  Cancel
                </Button>
                <Button
                  variant="ghost-secondary"
                  disabled={selected.size === 0 || deleteSession.isPending}
                  onClick={() =>
                    deleteSession.mutate({ sessionIds: [...selected] })
                  }
                  className="text-red-400 hover:text-red-300"
                >
                  {deleteSession.isPending
                    ? "Deleting..."
                    : `Delete${selected.size > 0 ? ` (${selected.size})` : ""}`}
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="ghost-secondary"
                  onClick={() => setSelectMode(true)}
                >
                  Select
                </Button>
                <motion.button
                  onClick={() => router.push("/generate")}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-sm font-semibold text-[#09090b] shadow-[0_0_15px_rgba(255,255,255,0.1)] transition-shadow duration-300 hover:shadow-[0_0_25px_rgba(255,255,255,0.2)]"
                >
                  <Plus className="size-4" />
                  New release
                </motion.button>
              </>
            )}
          </div>
        </div>
      </AnimatedDashboardItem>

      {/* Session grid */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {sessions.map((session, index) => (
          <AnimatedCardItem key={session.id} index={index}>
            <SessionCard
              id={session.id}
              briefText={session.briefText}
              status={session.status}
              createdAt={new Date(session.createdAt)}
              assetType={session.assetType ?? undefined}
              previewImageUrl={session.previewImageUrl}
              selectMode={selectMode}
              isSelected={selected.has(session.id)}
              onToggleSelect={() => toggleSelect(session.id)}
            />
          </AnimatedCardItem>
        ))}
      </div>

      {/* Generated work strip */}
      <GeneratedWorkStrip />

      {/* References strip */}
      <ReferencesStrip />
    </AnimatedDashboardContainer>
  );
}
