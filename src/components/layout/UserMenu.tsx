"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(auth)/actions";
import { useRouter } from "next/navigation";

export function UserMenu({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-8 w-8 items-center justify-center rounded-full bg-background-elevated text-sm font-medium text-foreground-muted transition-colors duration-[var(--duration-fast)] hover:bg-background-overlay focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Account menu"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 border-border bg-background-elevated"
      >
        <DropdownMenuItem onClick={() => router.push("/dashboard")}>
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          Account settings
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const form = document.createElement("form");
            form.method = "POST";
            form.action = "";
            document.body.appendChild(form);
            signOut();
          }}
        >
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
