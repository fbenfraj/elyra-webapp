"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { motion } from "motion/react";
import {
  AnimatedDashboardContainer,
  AnimatedDashboardItem,
} from "@/features/session/components/DashboardAnimations";

/**
 * Atmospheric wrapper for all generation waiting screens.
 * Provides: generate-bg background with vignettes, staggered fade-in,
 * brief display card, and a slot for status content.
 */
export function GenerationWaiting({
  briefText,
  children,
}: {
  briefText: string;
  children: React.ReactNode;
}) {
  return (
    <AnimatedDashboardContainer className="relative flex flex-1 flex-col items-center justify-center gap-8 overflow-hidden">
      {/* Background image with atmospheric effects */}
      <motion.div
        className="pointer-events-none absolute inset-0 -z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1, scale: [1, 1.03, 1] }}
        transition={{
          opacity: { duration: 1.5, ease: "easeOut" },
          scale: {
            duration: 30,
            repeat: Infinity,
            ease: "easeInOut",
            delay: 1.5,
          },
        }}
      >
        <Image
          src="/assets/generate-bg.png"
          alt=""
          fill
          className="object-cover opacity-30"
          sizes="100vw"
        />
        {/* Radial vignette */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "radial-gradient(ellipse at center, transparent 15%, #09090b 65%)",
          }}
        />
        {/* Top/bottom vignette */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/80 via-transparent to-[#09090b]/90" />
      </motion.div>

      {/* Brief card */}
      <AnimatedDashboardItem className="w-full max-w-2xl px-4">
        <div className="rounded-[var(--radius-md)] border border-[var(--border)]/40 bg-[var(--background-elevated)]/60 px-6 py-5 backdrop-blur-sm">
          <p className="text-xs font-medium uppercase tracking-[0.08em] text-[var(--foreground-subtle)]">
            Your brief
          </p>
          <p className="mt-2 text-base leading-relaxed text-[var(--foreground)]">
            &ldquo;{briefText}&rdquo;
          </p>
        </div>
      </AnimatedDashboardItem>

      {/* Status content slot */}
      <AnimatedDashboardItem className="flex flex-col items-center gap-6">
        {children}
      </AnimatedDashboardItem>
    </AnimatedDashboardContainer>
  );
}

/**
 * Animated pulsing rings indicator for waiting states.
 */
export function PulseRings() {
  return (
    <div className="relative flex items-center justify-center">
      {/* Outer ring */}
      <motion.div
        className="absolute size-12 rounded-full border border-[var(--foreground-subtle)]/20"
        animate={{ scale: [1, 1.8, 1], opacity: [0.3, 0, 0.3] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeOut",
        }}
      />
      {/* Middle ring */}
      <motion.div
        className="absolute size-8 rounded-full border border-[var(--foreground-subtle)]/30"
        animate={{ scale: [1, 1.5, 1], opacity: [0.4, 0.1, 0.4] }}
        transition={{
          duration: 3,
          repeat: Infinity,
          ease: "easeOut",
          delay: 0.5,
        }}
      />
      {/* Center dot */}
      <motion.div
        className="size-2 rounded-full bg-[var(--foreground-subtle)]"
        animate={{ opacity: [0.6, 0.3, 0.6] }}
        transition={{
          duration: 2,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

/**
 * Cycling status text with smooth crossfade animation.
 */
export function CyclingStatus({ phrases }: { phrases: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setIndex((prev) => (prev + 1) % phrases.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [phrases.length]);

  return (
    <div className="relative h-7 overflow-hidden">
      {phrases.map((phrase, i) => (
        <motion.p
          key={phrase}
          className="absolute inset-0 text-center text-lg text-[var(--foreground-muted)]"
          initial={false}
          animate={{
            opacity: i === index ? 1 : 0,
            y: i === index ? 0 : 8,
          }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          {phrase}
        </motion.p>
      ))}
    </div>
  );
}
