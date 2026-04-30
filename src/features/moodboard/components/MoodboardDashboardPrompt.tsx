"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Palette, ArrowRight } from "lucide-react";
import { AnimatedDashboardItem } from "@/features/session/components/DashboardAnimations";

const SWATCH_COLORS = [
  "#6d28d9",
  "#2563eb",
  "#0d9488",
  "#d97706",
  "#e11d48",
];

function FloatingSwatches() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {SWATCH_COLORS.map((color, i) => (
        <motion.div
          key={color}
          className="absolute rounded-lg opacity-[0.12]"
          style={{
            backgroundColor: color,
            width: 48 + i * 8,
            height: 48 + i * 8,
            right: 40 + i * 56,
            top: "50%",
          }}
          initial={{ y: "-50%", rotate: -12 + i * 8, scale: 0.8, opacity: 0 }}
          animate={{
            y: ["-50%", "-55%", "-50%"],
            rotate: [-12 + i * 8, -8 + i * 8, -12 + i * 8],
            scale: 1,
            opacity: 0.12,
          }}
          transition={{
            y: { duration: 4 + i * 0.6, repeat: Infinity, ease: "easeInOut" },
            rotate: {
              duration: 5 + i * 0.8,
              repeat: Infinity,
              ease: "easeInOut",
            },
            scale: { duration: 0.8, delay: 0.1 * i },
            opacity: { duration: 0.8, delay: 0.1 * i },
          }}
        />
      ))}
    </div>
  );
}

export function MoodboardDashboardPrompt() {
  const router = useRouter();

  return (
    <AnimatedDashboardItem>
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-violet-500/20">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: [
              "radial-gradient(ellipse at 20% 50%, rgba(109,40,217,0.12) 0%, transparent 60%)",
              "radial-gradient(ellipse at 80% 30%, rgba(37,99,235,0.08) 0%, transparent 50%)",
              "radial-gradient(ellipse at 60% 80%, rgba(225,29,72,0.06) 0%, transparent 50%)",
              "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
            ].join(", "),
          }}
        />

        <FloatingSwatches />

        <div className="relative flex items-center gap-6 px-8 py-10">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-violet-500/10 ring-1 ring-violet-500/20">
            <Palette className="size-7 text-violet-400" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-violet-400/80">
              Next step
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              Define your visual identity
            </h3>
            <p className="mt-1.5 text-sm text-[var(--foreground-muted)]">
              We&apos;ll generate visual directions from your music. Pick the ones
              that resonate to shape every future generation.
            </p>
          </div>

          <motion.button
            onClick={() => router.push("/dashboard/moodboard")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex shrink-0 items-center gap-2 rounded-full bg-violet-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(139,92,246,0.2)] transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(139,92,246,0.35)]"
          >
            Create moodboard
            <ArrowRight className="size-3.5" />
          </motion.button>
        </div>
      </div>
    </AnimatedDashboardItem>
  );
}
