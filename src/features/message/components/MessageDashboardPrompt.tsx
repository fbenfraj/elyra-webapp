"use client";

import { useRouter } from "next/navigation";
import { motion } from "motion/react";
import { Sparkles, ArrowRight } from "lucide-react";
import { AnimatedDashboardItem } from "@/features/session/components/DashboardAnimations";

const FLOATING_COLORS = [
  "#6366f1",
  "#0ea5e9",
  "#22d3ee",
  "#f59e0b",
  "#fb7185",
];

function FloatingOrbs() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {FLOATING_COLORS.map((color, i) => (
        <motion.div
          key={color}
          className="absolute rounded-full opacity-[0.10] blur-2xl"
          style={{
            backgroundColor: color,
            width: 80 + i * 16,
            height: 80 + i * 16,
            right: 80 + i * 70,
            top: "50%",
          }}
          initial={{ y: "-50%", scale: 0.7, opacity: 0 }}
          animate={{
            y: ["-55%", "-45%", "-55%"],
            scale: 1,
            opacity: 0.10,
          }}
          transition={{
            y: { duration: 5 + i * 0.7, repeat: Infinity, ease: "easeInOut" },
            scale: { duration: 0.9, delay: 0.1 * i },
            opacity: { duration: 0.9, delay: 0.1 * i },
          }}
        />
      ))}
    </div>
  );
}

export function MessageDashboardPrompt() {
  const router = useRouter();

  return (
    <AnimatedDashboardItem>
      <div className="relative mb-8 overflow-hidden rounded-2xl border border-indigo-500/20">
        <div
          className="absolute inset-0 -z-10"
          style={{
            background: [
              "radial-gradient(ellipse at 20% 50%, rgba(99,102,241,0.14) 0%, transparent 60%)",
              "radial-gradient(ellipse at 80% 30%, rgba(14,165,233,0.10) 0%, transparent 50%)",
              "radial-gradient(ellipse at 60% 80%, rgba(251,113,133,0.06) 0%, transparent 50%)",
              "linear-gradient(135deg, #18181b 0%, #09090b 100%)",
            ].join(", "),
          }}
        />

        <FloatingOrbs />

        <div className="relative flex items-center gap-6 px-8 py-10">
          <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-indigo-500/10 ring-1 ring-indigo-500/20">
            <Sparkles className="size-7 text-indigo-300" />
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-indigo-300/80">
              Next step
            </p>
            <h3 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
              Discover your message
            </h3>
            <p className="mt-1.5 text-sm text-[var(--foreground-muted)]">
              Answer a few playful questions about your music and identity.
              We&apos;ll turn your answers into the foundation for every visual we generate.
            </p>
          </div>

          <motion.button
            onClick={() => router.push("/onboarding/message")}
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.97 }}
            className="flex shrink-0 items-center gap-2 rounded-full bg-indigo-500 px-6 py-2.5 text-sm font-semibold text-white shadow-[0_0_20px_rgba(99,102,241,0.2)] transition-shadow duration-300 hover:shadow-[0_0_30px_rgba(99,102,241,0.35)]"
          >
            Start
            <ArrowRight className="size-3.5" />
          </motion.button>
        </div>
      </div>
    </AnimatedDashboardItem>
  );
}
