"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Image from "next/image";
import { motion } from "motion/react";
import { Sparkles, Palette, Download, Plus } from "lucide-react";
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
      className="space-y-2"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {[1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-4 rounded-lg p-3">
          <div className="size-20 shrink-0 animate-pulse rounded-[var(--radius-md)] bg-[var(--background-overlay)]" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--background-overlay)]" />
            <div className="h-4 w-1/4 animate-pulse rounded bg-[var(--background-overlay)]" />
            <div className="h-3 w-1/6 animate-pulse rounded bg-[var(--background-overlay)]" />
          </div>
        </div>
      ))}
    </motion.div>
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
    return (
      <AnimatedDashboardContainer className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden">
        {/* Background image with auth-page effects */}
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
          {/* Radial vignette — fades edges into the dark background */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(ellipse at center, transparent 30%, #09090b 75%)",
            }}
          />
          {/* Top/bottom vignette */}
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

        {/* CTA */}
        <AnimatedDashboardItem>
          <motion.button
            onClick={() => router.push("/generate")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-white px-8 py-3 text-base font-semibold text-[#09090b] shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.25)]"
          >
            <Plus className="size-5" />
            Start your first release
          </motion.button>
        </AnimatedDashboardItem>
      </AnimatedDashboardContainer>
    );
  }

  return (
    <AnimatedDashboardContainer>
      <AnimatedDashboardItem>
        <div className="mb-4 flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
            Releases
          </h1>
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
                <Button
                  variant="ghost-secondary"
                  onClick={() => router.push("/generate")}
                >
                  New release
                </Button>
              </>
            )}
          </div>
        </div>
      </AnimatedDashboardItem>
      <div className="space-y-1">
        {sessions.map((session, index) => (
          <AnimatedCardItem key={session.id} index={index}>
            <SessionCard
              id={session.id}
              briefText={session.briefText}
              status={session.status}
              createdAt={new Date(session.createdAt)}
              assetType={session.assetType ?? undefined}
              selectMode={selectMode}
              isSelected={selected.has(session.id)}
              onToggleSelect={() => toggleSelect(session.id)}
            />
          </AnimatedCardItem>
        ))}
      </div>
    </AnimatedDashboardContainer>
  );
}
