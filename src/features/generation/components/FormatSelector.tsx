"use client";

import { Check } from "lucide-react";
import {
  ASSET_TYPES,
  ASSET_CATEGORIES,
  SELECTABLE_ASSET_TYPE_IDS,
} from "@/config/asset-types";
import type { AssetTypeId, AssetCategory } from "@/config/asset-types";

type FormatSelectorProps = {
  selected: AssetTypeId;
  onSelect: (id: AssetTypeId) => void;
};

function AspectRatioIndicator({ w, h }: { w: number; h: number }) {
  const maxDim = 24;
  const scale = maxDim / Math.max(w, h);
  const width = Math.round(w * scale);
  const height = Math.round(h * scale);

  return (
    <div
      className="rounded-[3px] border border-current opacity-40"
      style={{ width, height }}
    />
  );
}

const SORTED_CATEGORIES: [AssetCategory, AssetTypeId[]][] = (() => {
  const grouped = new Map<AssetCategory, AssetTypeId[]>();
  for (const id of SELECTABLE_ASSET_TYPE_IDS) {
    const config = ASSET_TYPES[id];
    const list = grouped.get(config.category) ?? [];
    list.push(id);
    grouped.set(config.category, list);
  }
  return [...grouped.entries()].sort(
    ([a], [b]) => ASSET_CATEGORIES[a].order - ASSET_CATEGORIES[b].order
  );
})();

export function FormatSelector({ selected, onSelect }: FormatSelectorProps) {
  return (
    <div className="space-y-5">
      {SORTED_CATEGORIES.map(([category, typeIds]) => (
        <div key={category}>
          <p className="mb-2 text-[11px] font-medium uppercase tracking-widest text-[var(--foreground-subtle)]">
            {ASSET_CATEGORIES[category].label}
          </p>
          <div className="flex flex-wrap gap-2">
            {typeIds.map((typeId) => {
              const config = ASSET_TYPES[typeId];
              const isSelected = typeId === selected;
              return (
                <button
                  key={typeId}
                  type="button"
                  onClick={() => onSelect(typeId)}
                  className={`flex items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition-all ${
                    isSelected
                      ? "border-white bg-white text-[#09090b]"
                      : "border-[var(--border)] bg-[var(--background-elevated)]/60 text-[var(--foreground-muted)] hover:border-[#52525b] hover:text-[var(--foreground)]"
                  }`}
                >
                  <AspectRatioIndicator w={config.width} h={config.height} />
                  {config.label}
                  {isSelected && <Check className="size-3.5" />}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
