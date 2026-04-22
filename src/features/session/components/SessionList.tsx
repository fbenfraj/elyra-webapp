"use client";

import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { SessionCard } from "@/features/session/components/SessionCard";

function SessionListSkeleton() {
  return (
    <div className="space-y-2">
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
    </div>
  );
}

export function SessionList() {
  const router = useRouter();
  const trpc = useTRPC();
  const { data: sessions, isLoading } = useQuery(
    trpc.session.list.queryOptions()
  );

  if (isLoading) {
    return <SessionListSkeleton />;
  }

  if (!sessions || sessions.length === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <p className="text-sm text-[var(--foreground-muted)]">
          No releases yet. Start your first one.
        </p>
        <Button
          variant="ghost-secondary"
          onClick={() => router.push("/generate")}
        >
          New release
        </Button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight text-[var(--foreground)]">
          Releases
        </h1>
        <Button
          variant="ghost-secondary"
          onClick={() => router.push("/generate")}
        >
          New release
        </Button>
      </div>
      <div className="space-y-1">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            id={session.id}
            briefText={session.briefText}
            status={session.status}
            createdAt={new Date(session.createdAt)}
          />
        ))}
      </div>
    </div>
  );
}
