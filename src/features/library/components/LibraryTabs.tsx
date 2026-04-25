"use client";

import { useState } from "react";
import { LibraryGrid } from "@/features/library/components/LibraryGrid";
import { ReferenceGrid } from "@/features/library/components/ReferenceGrid";

type Tab = "generated" | "references";

export function LibraryTabs() {
  const [activeTab, setActiveTab] = useState<Tab>("generated");

  return (
    <div className="flex flex-col gap-6">
      {/* Header + tabs */}
      <div className="flex items-center gap-6">
        <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
        <div className="flex gap-1 rounded-lg border border-[var(--border)] bg-[var(--background-elevated)] p-1">
          <button
            onClick={() => setActiveTab("generated")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "generated"
                ? "bg-white text-[#09090b]"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            Generated
          </button>
          <button
            onClick={() => setActiveTab("references")}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              activeTab === "references"
                ? "bg-white text-[#09090b]"
                : "text-[var(--foreground-muted)] hover:text-[var(--foreground)]"
            }`}
          >
            References
          </button>
        </div>
      </div>

      {/* Tab content */}
      {activeTab === "generated" ? <LibraryGrid /> : <ReferenceGrid />}
    </div>
  );
}
