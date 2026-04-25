"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useQuery } from "@tanstack/react-query";

export function OnboardingGate({ children }: { children: React.ReactNode }) {
  const trpc = useTRPC();
  const pathname = usePathname();
  const router = useRouter();

  const { data, isLoading } = useQuery({
    ...trpc.user.onboardingStatus.queryOptions(),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (isLoading) return;
    if (data && !data.completed && pathname !== "/onboarding") {
      router.replace("/onboarding");
    }
  }, [data, isLoading, pathname, router]);

  // Don't block rendering while checking — the redirect happens async
  return <>{children}</>;
}
