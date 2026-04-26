"use client";

import { useRouter } from "next/navigation";
import { ASSET_TYPES, SELECTABLE_ASSET_TYPE_IDS } from "@/config/asset-types";
import type { AssetTypeId } from "@/config/asset-types";

type CompanionSuggestionsProps = {
  currentAssetType: AssetTypeId;
  userBrief: string | null;
};

export function CompanionSuggestions({
  currentAssetType,
  userBrief,
}: CompanionSuggestionsProps) {
  const router = useRouter();

  const companionTypes = SELECTABLE_ASSET_TYPE_IDS.filter((id) => id !== currentAssetType);

  const handleCompanionClick = (typeId: AssetTypeId) => {
    const params = new URLSearchParams();
    params.set("type", typeId);
    if (userBrief) {
      params.set("brief", userBrief);
    }
    router.push(`/generate?${params.toString()}`);
  };

  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--background-elevated)] p-[var(--space-6)]">
      <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
        Create matching visuals
      </p>
      <p className="mt-[var(--space-1)] text-sm text-[var(--foreground-muted)]">
        Use the same creative direction for other formats
      </p>
      <div className="mt-[var(--space-4)] flex flex-wrap gap-[var(--space-2)]">
        {companionTypes.map((typeId) => {
          const config = ASSET_TYPES[typeId];
          return (
            <button
              key={typeId}
              type="button"
              onClick={() => handleCompanionClick(typeId)}
              className="rounded-full border border-[var(--border)] bg-[var(--background-overlay)] px-4 py-2 text-sm text-[var(--foreground-muted)] transition-colors hover:border-[var(--foreground-subtle)] hover:text-[var(--foreground)]"
            >
              {config.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
