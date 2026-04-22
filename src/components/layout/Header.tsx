import Link from "next/link";
import { UserMenu } from "@/components/layout/UserMenu";

export function Header({ email }: { email: string }) {
  return (
    <header className="flex h-12 items-center justify-between px-4 md:px-8">
      <Link
        href="/dashboard"
        className="text-sm font-semibold uppercase tracking-[0.08em] text-foreground"
      >
        elyra
      </Link>
      <UserMenu email={email} />
    </header>
  );
}
