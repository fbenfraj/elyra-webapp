"use client";

import { useActionState } from "react";
import { signUp, signInWithGoogle, type AuthResult } from "@/app/(auth)/actions";
import Link from "next/link";
import { motion } from "motion/react";
import { AuthIllustration } from "@/app/(auth)/AuthIllustration";
import { AnimatedAuthForm, AnimatedItem, GlowInput } from "@/app/(auth)/AuthAnimations";
import { GoogleIcon } from "@/app/(auth)/GoogleIcon";

export default function SignupPage() {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    async (_prev, formData) => {
      return await signUp(formData);
    },
    null,
  );

  return (
    <AnimatedAuthForm>
      <AuthIllustration src="/assets/signup-bg.png" />

      <AnimatedItem>
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Create an account
          </h1>
          <p className="text-sm text-foreground-muted">
            Get started with your first release
          </p>
        </div>
      </AnimatedItem>

      <AnimatedItem>
        <form action={() => signInWithGoogle()}>
          <motion.button
            type="submit"
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.98 }}
            className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-accent px-4 py-3 text-base font-medium text-background transition-colors duration-[var(--duration-fast)] hover:bg-accent-hover"
          >
            <GoogleIcon />
            Continue with Google
          </motion.button>
        </form>
      </AnimatedItem>

      <AnimatedItem>
        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-border" />
          <span className="text-xs text-foreground-subtle">or</span>
          <div className="h-px flex-1 bg-border" />
        </div>
      </AnimatedItem>

      <form action={formAction} className="space-y-4">
        <AnimatedItem>
          <div className="space-y-2">
            <label htmlFor="email" className="text-sm font-medium text-foreground">
              Email
            </label>
            <GlowInput
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="you@example.com"
            />
          </div>
        </AnimatedItem>

        <AnimatedItem>
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm font-medium text-foreground">
              Password
            </label>
            <GlowInput
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="At least 6 characters"
            />
          </div>
        </AnimatedItem>

        <AnimatedItem>
          <div className="space-y-2">
            <label htmlFor="confirmPassword" className="text-sm font-medium text-foreground">
              Confirm password
            </label>
            <GlowInput
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              required
              minLength={6}
              placeholder="Re-enter your password"
            />
          </div>
        </AnimatedItem>

        {state?.error && (
          <AnimatedItem>
            <p className="text-sm text-destructive">{state.error}</p>
          </AnimatedItem>
        )}

        <AnimatedItem>
          <motion.button
            type="submit"
            disabled={pending}
            whileTap={{ scale: 0.97 }}
            className="w-full rounded-[var(--radius-sm)] border border-border bg-transparent px-4 py-2.5 text-base font-medium text-foreground transition-colors duration-[var(--duration-fast)] hover:bg-background-overlay disabled:opacity-50"
          >
            {pending ? "Creating account..." : "Create account"}
          </motion.button>
        </AnimatedItem>
      </form>

      <AnimatedItem>
        <p className="text-center text-sm text-foreground-muted">
          Already have an account?{" "}
          <Link href="/login" className="text-foreground-muted underline hover:text-foreground">
            Sign in
          </Link>
        </p>
      </AnimatedItem>
    </AnimatedAuthForm>
  );
}
