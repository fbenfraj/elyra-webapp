import Image from "next/image";
import Link from "next/link";
import { UserMenu } from "@/components/layout/UserMenu";

export function Header({ email }: { email: string }) {
  return (
    <header className="flex h-16 items-center justify-between border-b border-[var(--border)] px-4 md:px-8">
      <Link
        href="/dashboard"
        className="flex items-center gap-2.5 text-base font-semibold uppercase tracking-[0.1em] text-foreground"
      >
        <Image
          src="/elyra-logo-no-bg.png"
          alt="Elyra"
          width={32}
          height={32}
          className="rounded-sm"
        />
        elyra
      </Link>
      <UserMenu email={email} />
    </header>
  );
}
