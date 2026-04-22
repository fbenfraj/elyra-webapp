"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

export function StatusPoller({ sessionId }: { sessionId: string }) {
  const trpc = useTRPC();

  const { data } = useQuery(
    trpc.generation.getStatus.queryOptions(
      { sessionId },
      {
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          if (status === "complete" || status === "failed") return false;
          return 3000;
        },
      }
    )
  );

  return (
    <p className="mt-8 text-sm text-[var(--foreground-subtle)] transition-opacity duration-500">
      {data?.stepLabel ?? "Starting..."}
    </p>
  );
}
