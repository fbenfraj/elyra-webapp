"use client";

import { use } from "react";
import Link from "next/link";
import { PackageReveal } from "@/features/generation/components/PackageReveal";

type Props = {
  params: Promise<{ sessionId: string }>;
};

export default function PackagePage({ params }: Props) {
  const { sessionId } = use(params);

  return (
    <div>
      <div className="px-6 pt-4">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-[var(--foreground-muted)] transition-colors hover:text-[var(--foreground)]"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to releases
        </Link>
      </div>
      <PackageReveal sessionId={sessionId} briefText="" />
    </div>
  );
}
