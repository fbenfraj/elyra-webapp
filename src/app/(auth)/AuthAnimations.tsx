"use client";

import { type ComponentPropsWithoutRef, forwardRef } from "react";
import { motion } from "motion/react";

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.15,
      delayChildren: 0.3,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.7,
      ease: [0.16, 1, 0.3, 1] as [number, number, number, number],
    },
  },
};

export function AnimatedAuthForm({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {children}
    </motion.div>
  );
}

export function AnimatedItem({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <motion.div variants={itemVariants} className={className}>
      {children}
    </motion.div>
  );
}

export const GlowInput = forwardRef<
  HTMLInputElement,
  ComponentPropsWithoutRef<"input">
>(function GlowInput({ className, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={`w-full rounded-[var(--radius-sm)] border border-border bg-background-elevated px-3 py-2.5 text-base text-foreground placeholder:text-foreground-subtle transition-[border-color,box-shadow] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] focus:border-[#52525b] focus:shadow-[0_0_0_3px_rgba(63,63,70,0.3)] focus:outline-none ${className ?? ""}`}
      {...props}
    />
  );
});
