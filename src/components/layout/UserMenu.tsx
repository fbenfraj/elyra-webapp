"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { signOut } from "@/app/(auth)/actions";
import { useRouter } from "next/navigation";
import { LayoutDashboard, ImageIcon, Settings, LogOut } from "lucide-react";

export function UserMenu({ email }: { email: string }) {
  const initial = email.charAt(0).toUpperCase();
  const router = useRouter();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 w-9 items-center justify-center rounded-full bg-background-elevated text-sm font-medium text-foreground-muted transition-colors duration-[var(--duration-fast)] hover:bg-background-overlay focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Account menu"
      >
        {initial}
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        className="w-48 border-border bg-background-elevated"
      >
        <DropdownMenuItem onClick={() => router.push("/dashboard")}>
          <LayoutDashboard className="mr-2 size-4" />
          Dashboard
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/dashboard/library")}>
          <ImageIcon className="mr-2 size-4" />
          Library
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => router.push("/settings")}>
          <Settings className="mr-2 size-4" />
          Account settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            const form = document.createElement("form");
            form.method = "POST";
            form.action = "";
            document.body.appendChild(form);
            signOut();
          }}
          className="text-red-400 focus:text-red-300"
        >
          <LogOut className="mr-2 size-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
