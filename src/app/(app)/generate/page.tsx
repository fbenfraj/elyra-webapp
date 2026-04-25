"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { BriefInput } from "@/features/generation/components/BriefInput";

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Handle legacy ?resume= links by redirecting to /generate/[sessionId]
  useEffect(() => {
    const resumeId = searchParams.get("resume");
    if (resumeId) {
      router.replace(`/generate/${resumeId}`);
      return;
    }

    // Handle legacy payment return links
    const paymentStatus = searchParams.get("payment");
    const sessionId = searchParams.get("session_id");
    if (paymentStatus && sessionId) {
      router.replace(`/generate/${sessionId}?payment=${paymentStatus}`);
    }
  }, [searchParams, router]);

  const trpc = useTRPC();

  const createSession = useMutation(
    trpc.session.create.mutationOptions({
      onSuccess: (data) => {
        router.replace(`/generate/${data.id}`);
      },
    })
  );

  // If there are redirect params, show nothing while redirecting
  if (searchParams.get("resume") || searchParams.get("payment")) {
    return null;
  }

  return (
    <div className="flex flex-1 flex-col">
      <BriefInput
        onSubmit={(text) => createSession.mutate({ text })}
        isSubmitting={createSession.isPending}
      />
    </div>
  );
}
