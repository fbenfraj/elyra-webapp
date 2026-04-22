"use client";

import { useActionState } from "react";
import { signIn, signInWithGoogle, type AuthResult } from "@/app/(auth)/actions";
import Link from "next/link";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState<AuthResult | null, FormData>(
    async (_prev, formData) => {
      return await signIn(formData);
    },
    null,
  );

  return (
    <div className="space-y-6">
      <div className="space-y-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Sign in
        </h1>
        <p className="text-sm text-foreground-muted">
          Enter your email to continue
        </p>
      </div>

      <form action={() => signInWithGoogle()}>
        <button
          type="submit"
          className="flex w-full items-center justify-center gap-2 rounded-[var(--radius-sm)] bg-accent px-4 py-2.5 text-base font-medium text-background transition-colors duration-[var(--duration-fast)] hover:bg-accent-hover"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </form>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-foreground-subtle">or</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-2">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            className="w-full rounded-[var(--radius-sm)] border border-border bg-background-elevated px-3 py-2.5 text-base text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="you@example.com"
          />
        </div>

        <div className="space-y-2">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            minLength={6}
            className="w-full rounded-[var(--radius-sm)] border border-border bg-background-elevated px-3 py-2.5 text-base text-foreground placeholder:text-foreground-subtle focus:outline-none focus:ring-2 focus:ring-ring"
            placeholder="At least 6 characters"
          />
        </div>

        {state?.error && (
          <p className="text-sm text-destructive">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-[var(--radius-sm)] border border-border bg-transparent px-4 py-2.5 text-base font-medium text-foreground transition-colors duration-[var(--duration-fast)] hover:bg-background-overlay disabled:opacity-50"
        >
          {pending ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <p className="text-center text-sm text-foreground-muted">
        No account yet?{" "}
        <Link href="/signup" className="text-foreground-muted underline hover:text-foreground">
          Sign up
        </Link>
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
      <path
        d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
