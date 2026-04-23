"use client";

import { use } from "react";
import { PackageReveal } from "@/features/generation/components/PackageReveal";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default function PackagePage({ params }: Props) {
  const { sessionId } = use(params);

  return (
    <PackageReveal sessionId={sessionId} briefText="" />
  );
}
