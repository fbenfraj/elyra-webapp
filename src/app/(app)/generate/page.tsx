"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation, useQuery } from "@tanstack/react-query";
import { BriefInput } from "@/features/generation/components/BriefInput";
import type { AssetTypeId } from "@/config/asset-types";

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

  const { data: activeMoodboard } = useQuery(
    trpc.moodboard.active.queryOptions()
  );

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

  // Check for companion pre-fill from query params
  const companionType = searchParams.get("type") as AssetTypeId | null;
  const companionBrief = searchParams.get("brief");

  return (
    <div className="flex flex-1 flex-col">
      <BriefInput
        onSubmit={(assetType, text, referenceIds) =>
          createSession.mutate({ assetType, text, referenceIds })
        }
        isSubmitting={createSession.isPending}
        defaultAssetType={companionType ?? undefined}
        defaultText={companionBrief ?? undefined}
        hasMoodboard={!!activeMoodboard}
      />
    </div>
  );
}
