"use client";

import { useRef, useCallback, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Wand2 } from "lucide-react";
import {
  AnimatedDashboardContainer,
  AnimatedDashboardItem,
} from "@/features/session/components/DashboardAnimations";
import type { AssetTypeId } from "@/config/asset-types";
import { ASSET_TYPES } from "@/config/asset-types";
import { FormatSelector } from "@/features/generation/components/FormatSelector";
import { ReferencePicker } from "@/features/generation/components/ReferencePicker";

const COMPACT_MAX_HEIGHT = 120;
const FULL_MAX_HEIGHT = 200;

export function BriefInput({
  onSubmit,
  isSubmitting,
  defaultAssetType,
  defaultText,
  hasMoodboard,
}: {
  onSubmit: (assetType: AssetTypeId, text?: string, referenceIds?: string[]) => void;
  isSubmitting: boolean;
  defaultAssetType?: AssetTypeId;
  defaultText?: string;
  hasMoodboard?: boolean;
}) {
  const [text, setText] = useState(defaultText ?? "");
  const [selectedType, setSelectedType] = useState<AssetTypeId>(
    defaultAssetType ?? "album_cover"
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [selectedReferenceIds, setSelectedReferenceIds] = useState<string[]>([]);

  const config = ASSET_TYPES[selectedType];
  const maxHeight = hasMoodboard ? COMPACT_MAX_HEIGHT : FULL_MAX_HEIGHT;

  const handleSubmit = useCallback(() => {
    if (isSubmitting) return;
    const trimmed = text.trim();
    onSubmit(
      selectedType,
      trimmed.length > 0 ? trimmed : undefined,
      selectedReferenceIds.length > 0 ? selectedReferenceIds : undefined
    );
  }, [text, isSubmitting, onSubmit, selectedType, selectedReferenceIds]);

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;

    if (scrollHeight <= maxHeight) {
      textarea.style.height = `${scrollHeight}px`;
      textarea.style.overflowY = "hidden";
    } else {
      textarea.style.height = `${maxHeight}px`;
      textarea.style.overflowY = "auto";
    }
  }, [maxHeight]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  return (
    <AnimatedDashboardContainer className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden">
      {/* Background image with atmospheric effects */}
      <motion.div
        className="pointer-events-none absolute inset-0 -z-10"
        initial={{ opacity: 0, scale: 1.1 }}
        animate={{ opacity: 1, scale: [1, 1.05, 1] }}
        transition={{
          opacity: { duration: 1.2, ease: "easeOut" },
          scale: {
            duration: 25,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.2,
          },
        }}
      >
        <Image
          src="/assets/generate-bg.png"
          alt=""
          fill
          className="object-cover opacity-40"
          priority
          sizes="100vw"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 20%, #09090b 70%)",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/70 via-transparent to-[#09090b]/80" />
      </motion.div>

      {/* Headline */}
      <AnimatedDashboardItem>
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            {hasMoodboard ? "What are you creating?" : "Describe your vision"}
          </h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            {hasMoodboard
              ? "Pick a format and tell us what it's about"
              : "Tell us about the mood, genre, and aesthetic you're going for"}
          </p>
        </div>
      </AnimatedDashboardItem>

      {/* Format selector */}
      <AnimatedDashboardItem>
        <div className="px-4">
          <FormatSelector
            selected={selectedType}
            onSelect={setSelectedType}
          />
        </div>
      </AnimatedDashboardItem>

      {/* Context input area */}
      <AnimatedDashboardItem className="w-full">
        <div className="mx-auto w-full max-w-5xl px-4">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              handleInput();
            }}
            onKeyDown={handleKeyDown}
            disabled={isSubmitting}
            placeholder={
              hasMoodboard
                ? "What's this release about? (optional)"
                : config.placeholder
            }
            rows={hasMoodboard ? 2 : 5}
            className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-elevated)]/80 px-5 py-4 text-lg leading-relaxed text-[var(--foreground)] backdrop-blur-sm placeholder:text-[var(--foreground-subtle)] focus:border-[#52525b] focus:shadow-[0_0_0_3px_rgba(63,63,70,0.3)] focus:outline-none disabled:opacity-50"
            style={{
              maxHeight: `${maxHeight}px`,
              overflowY: "hidden",
            }}
          />
          <p className="mt-2 text-center text-xs text-[var(--foreground-subtle)]">
            {hasMoodboard
              ? "Optional — style is handled by your visual identity"
              : "Optional — we'll use your artist profile"}
          </p>
          <div className="mt-4">
            <ReferencePicker
              selectedIds={selectedReferenceIds}
              onSelectionChange={setSelectedReferenceIds}
            />
          </div>
          <div className="mt-4 flex w-full justify-center">
            <motion.button
              type="button"
              disabled={isSubmitting}
              onClick={handleSubmit}
              whileHover={!isSubmitting ? { scale: 1.03 } : undefined}
              whileTap={!isSubmitting ? { scale: 0.97 } : undefined}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-white px-8 py-3 text-base font-semibold text-[#09090b] shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] disabled:opacity-40 disabled:shadow-none"
              title="Cmd + Enter to submit"
            >
              {isSubmitting ? (
                <>
                  <span className="size-4 animate-spin rounded-full border-2 border-[#09090b] border-t-transparent" />
                  Creating...
                </>
              ) : (
                <>
                  <Wand2 className="size-4" />
                  Create directions
                </>
              )}
            </motion.button>
          </div>
        </div>
      </AnimatedDashboardItem>
    </AnimatedDashboardContainer>
  );
}
