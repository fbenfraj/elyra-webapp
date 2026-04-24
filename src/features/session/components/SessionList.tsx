"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
      <div className="space-y-1">
        {sessions.map((session) => (
          <SessionCard
            key={session.id}
            id={session.id}
            briefText={session.briefText}
            status={session.status}
            createdAt={new Date(session.createdAt)}
            selectMode={selectMode}
            isSelected={selected.has(session.id)}
            onToggleSelect={() => toggleSelect(session.id)}
          />
        ))}
      </div>
    </div>
  );
}
