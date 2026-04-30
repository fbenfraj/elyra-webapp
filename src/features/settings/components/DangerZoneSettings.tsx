"use client";

import { useState } from "react";
import { AlertTriangle, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { signOut } from "@/app/(auth)/actions";

export function DangerZoneSettings() {
  const trpc = useTRPC();
  const [open, setOpen] = useState(false);

  const deleteAccount = useMutation(
    trpc.user.deleteAccount.mutationOptions({
      onSuccess: async () => {
        await signOut();
      },
      onError: (err) => {
        toast.error(err.message ?? "Failed to delete account");
        setOpen(false);
      },
    })
  );

  const isPending = deleteAccount.isPending;

  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-6 space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-destructive/10 ring-1 ring-destructive/30">
          <AlertTriangle className="size-4 text-destructive" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-semibold text-zinc-100">Danger zone</h2>
          <p className="mt-1 text-sm text-zinc-400">
            Deletes your account and every session, moodboard, and uploaded
            reference tied to it. This cannot be undone.
          </p>
        </div>
      </div>

      <Button
        variant="destructive"
        size="sm"
        onClick={() => setOpen(true)}
        disabled={isPending}
      >
        <Trash2 className="size-3.5" />
        Delete my account
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete your account?</DialogTitle>
            <DialogDescription>
              This permanently removes your account, all sessions, moodboards,
              uploaded references, and generated images. You will be signed out
              immediately.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setOpen(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => deleteAccount.mutate()}
              disabled={isPending}
            >
              {isPending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  Deleting…
                </>
              ) : (
                <>
                  <Trash2 className="size-3.5" />
                  Delete account
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
