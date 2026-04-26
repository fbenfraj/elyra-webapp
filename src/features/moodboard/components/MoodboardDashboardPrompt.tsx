"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Palette } from "lucide-react";
import {
  AnimatedDashboardItem,
} from "@/features/session/components/DashboardAnimations";

export function MoodboardDashboardPrompt({ compact }: { compact?: boolean }) {
  const router = useRouter();

  if (compact) {
    return (
      <button
        onClick={() => router.push("/onboarding/moodboard")}
        className="flex items-center gap-4 rounded-xl border border-dashed border-[#3f3f46] bg-white/[0.02] px-6 py-4 text-left transition-colors hover:border-violet-500/40 hover:bg-violet-500/[0.03]"
      >
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-violet-500/10">
          <Palette className="size-5 text-violet-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-[var(--foreground)]">
            Define your visual identity
          </p>
          <p className="text-xs text-[var(--foreground-subtle)]">
            Explore visual directions based on your sound
          </p>
        </div>
      </button>
    );
  }

  return (
    <AnimatedDashboardItem>
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-dashed border-[#3f3f46]">
        {/* Subtle purple gradient */}
        <div
          className="absolute inset-0 -z-10"
          style={{
            background:
              "linear-gradient(135deg, rgba(139,92,246,0.06) 0%, #18181b 40%, #18181b 60%, rgba(139,92,246,0.04) 100%)",
          }}
        />

        <div className="flex items-center gap-6 px-8 py-8">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-full bg-violet-500/10 ring-1 ring-violet-500/20">
            <Palette className="size-7 text-violet-400" />
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="text-base font-semibold text-[var(--foreground)]">
              Define your visual identity
            </h3>
            <p className="mt-1 text-sm text-[var(--foreground-muted)]">
              Explore AI-generated visual directions based on your sound and lock in your style.
            </p>
          </div>

          <motion.button
            onClick={() => router.push("/onboarding/moodboard")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="shrink-0 rounded-full bg-violet-500 px-5 py-2 text-sm font-semibold text-white shadow-[0_0_15px_rgba(139,92,246,0.15)] transition-shadow duration-300 hover:shadow-[0_0_25px_rgba(139,92,246,0.25)]"
          >
            Create moodboard
          </motion.button>
        </div>
      </div>
    </AnimatedDashboardItem>
  );
}
