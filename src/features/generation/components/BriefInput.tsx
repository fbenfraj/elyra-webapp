"use client";

import { useRef, useCallback, useState } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import { Wand2 } from "lucide-react";
import {
  AnimatedDashboardContainer,
  AnimatedDashboardItem,
} from "@/features/session/components/DashboardAnimations";

const MIN_HEIGHT = 120;
const MAX_HEIGHT = 200;

export function BriefInput({
  onSubmit,
  isSubmitting,
}: {
  onSubmit: (text: string) => void;
  isSubmitting: boolean;
}) {
  const [text, setText] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const trimmedText = text.trim();
  const canSubmit = trimmedText.length > 0 && !isSubmitting;

  const handleSubmit = useCallback(() => {
    if (trimmedText.length > 0 && !isSubmitting) {
      onSubmit(trimmedText);
    }
  }, [trimmedText, isSubmitting, onSubmit]);

  const handleInput = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    textarea.style.height = "auto";
    const scrollHeight = textarea.scrollHeight;

    if (scrollHeight <= MAX_HEIGHT) {
      textarea.style.height = `${Math.max(scrollHeight, MIN_HEIGHT)}px`;
      textarea.style.overflowY = "hidden";
    } else {
      textarea.style.height = `${MAX_HEIGHT}px`;
      textarea.style.overflowY = "auto";
    }
  }, []);

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
        {/* Radial vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 20%, #09090b 70%)",
          }}
        />
        {/* Top/bottom vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/70 via-transparent to-[#09090b]/80" />
      </motion.div>

      {/* Headline */}
      <AnimatedDashboardItem>
        <div className="space-y-2 text-center">
          <h1 className="text-3xl font-semibold tracking-tight text-white">
            Describe your vision
          </h1>
          <p className="text-sm text-[var(--foreground-muted)]">
            Tell us about the mood, genre, and aesthetic you're going for
          </p>
        </div>
      </AnimatedDashboardItem>

      {/* Input area */}
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
            placeholder="dark cinematic trap, nighttime city, moody blue tones..."
            rows={5}
            className="w-full resize-none rounded-[var(--radius-md)] border border-[var(--border)] bg-[var(--background-elevated)]/80 px-5 py-4 text-lg leading-relaxed text-[var(--foreground)] backdrop-blur-sm placeholder:text-[var(--foreground-subtle)] focus:border-[#52525b] focus:shadow-[0_0_0_3px_rgba(63,63,70,0.3)] focus:outline-none disabled:opacity-50"
            style={{
              minHeight: `${MIN_HEIGHT}px`,
              maxHeight: `${MAX_HEIGHT}px`,
              overflowY: "hidden",
            }}
          />
          <div className="mt-4 flex w-full justify-center">
            <motion.button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              whileHover={canSubmit ? { scale: 1.03 } : undefined}
              whileTap={canSubmit ? { scale: 0.97 } : undefined}
              className="flex items-center gap-2 rounded-[var(--radius-sm)] bg-white px-8 py-3 text-base font-semibold text-[#09090b] shadow-[0_0_20px_rgba(255,255,255,0.15)] transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(255,255,255,0.25)] disabled:opacity-40 disabled:shadow-none"
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
          <p className="mt-3 text-center text-xs text-[var(--foreground-subtle)]">
            Press{" "}
            <kbd className="rounded border border-[var(--border)] bg-[var(--background-overlay)] px-1.5 py-0.5 font-mono text-[10px]">
              Cmd + Enter
            </kbd>{" "}
            to submit
          </p>
        </div>
      </AnimatedDashboardItem>
    </AnimatedDashboardContainer>
  );
}
