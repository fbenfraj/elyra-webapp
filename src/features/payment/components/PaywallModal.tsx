"use client";

import { useRef, useCallback, useEffect } from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  Dialog,
  DialogPortal,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { X } from "lucide-react";
import { packConfig } from "@/config/pricing";

interface PaywallModalProps {
  open: boolean;
  onClose: () => void;
  onUnlock: () => void;
  isLoading?: boolean;
  error?: string | null;
}

export function PaywallModal({ open, onClose, onUnlock, isLoading = false, error = null }: PaywallModalProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const touchStartY = useRef<number | null>(null);

  // Capture the element that had focus when the modal opens
  useEffect(() => {
    if (open) {
      triggerRef.current = document.activeElement as HTMLElement | null;
    }
  }, [open]);

  // Restore focus to the triggering element when the modal closes
  useEffect(() => {
    if (!open && triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    touchStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (touchStartY.current === null) return;
      const deltaY = e.changedTouches[0].clientY - touchStartY.current;
      if (deltaY > 80) {
        onClose();
      }
      touchStartY.current = null;
    },
    [onClose]
  );

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogPortal>
        <DialogPrimitive.Backdrop
          className="fixed inset-0 z-50 bg-[var(--background)]/60 backdrop-blur-sm data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0"
        />
        <DialogPrimitive.Popup
          className="
            fixed z-50 w-full outline-none
            bg-[var(--background-elevated)] text-[var(--foreground)]
            border border-[var(--border)]
            p-6 duration-200

            top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            max-w-[480px] rounded-xl

            max-md:top-auto max-md:bottom-0 max-md:left-0 max-md:right-0
            max-md:translate-x-0 max-md:translate-y-0
            max-md:max-w-none max-md:max-h-[60dvh]
            max-md:rounded-t-xl max-md:rounded-b-none

            data-open:animate-in data-open:fade-in-0
            data-closed:animate-out data-closed:fade-out-0
            max-md:data-open:slide-in-from-bottom
            max-md:data-closed:slide-out-to-bottom
          "
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
        >
          <div className="flex flex-col gap-5">
            <div className="flex items-start justify-between">
              <DialogTitle className="text-2xl font-semibold tracking-[-0.02em] text-[var(--foreground)]">
                Unlock your release package
              </DialogTitle>
              <button
                type="button"
                onClick={onClose}
                className="flex size-8 shrink-0 items-center justify-center rounded-[var(--radius-sm)] text-[var(--foreground-muted)] transition-colors hover:bg-[var(--background-overlay)] hover:text-[var(--foreground)]"
                aria-label="Close"
              >
                <X className="size-4" />
              </button>
            </div>

            <DialogDescription className="sr-only">
              Purchase details for your release package
            </DialogDescription>

            <ul className="flex flex-col gap-2 text-sm text-[var(--foreground-muted)]">
              {packConfig.includes.map((item) => (
                <li key={item} className="flex items-start gap-2">
                  <span className="mt-0.5 text-[var(--foreground-muted)]">
                    &bull;
                  </span>
                  {item}
                </li>
              ))}
            </ul>

            <div>
              <p className="text-3xl font-semibold tracking-[-0.04em] text-[var(--foreground)]">
                {packConfig.priceDisplay}
              </p>
              <p className="mt-1 text-sm text-[var(--foreground-muted)]">
                Includes ~{packConfig.regenLimit} regenerations within this
                direction
              </p>
            </div>

            {error && (
              <p className="text-sm text-[var(--destructive)]">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={onUnlock}
              disabled={isLoading}
              className="h-10 w-full rounded-[var(--radius-sm)] bg-[var(--accent)] text-base font-medium text-[var(--background)] hover:bg-[var(--accent)]/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Processing..." : "Unlock"}
            </button>
          </div>
        </DialogPrimitive.Popup>
      </DialogPortal>
    </Dialog>
  );
}
