"use client";

import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";
import { motion } from "motion/react";
import { STATUS_POLL_INTERVAL_MS } from "@/config/generation-timeouts";

export function StatusPoller({ sessionId }: { sessionId: string }) {
  const trpc = useTRPC();

  const { data } = useQuery(
    trpc.generation.getStatus.queryOptions(
      { sessionId },
      {
        refetchInterval: (query) => {
          const status = query.state.data?.status;
          if (status === "complete" || status === "failed") return false;
          return STATUS_POLL_INTERVAL_MS;
        },
      }
    )
  );

  return (
    <motion.p
      className="text-lg text-[var(--foreground-muted)]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {data?.stepLabel ?? "Interpreting your vision..."}
    </motion.p>
  );
}
