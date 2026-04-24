"use client";

import { useState } from "react";
import { useTRPC } from "@/lib/trpc/client";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

type DownloadActionsProps = {
  sessionId: string;
};

export function DownloadActions({ sessionId }: DownloadActionsProps) {
  const trpc = useTRPC();
  const [downloaded, setDownloaded] = useState(false);
  const [shareUrl, setShareUrl] = useState<string | null>(null);

  const downloadBundle = useMutation(
    trpc.package.downloadBundle.mutationOptions({
      onSuccess: (data) => {
        const a = document.createElement("a");
        a.href = data.url;
        a.download = `elyra-package.zip`;
        a.click();
        toast.success("Download started", { duration: 4000 });
        setDownloaded(true);
        setTimeout(() => setDownloaded(false), 3000);
      },
      onError: () => {
        toast.error("Download failed. Try downloading individual files instead.", {
          duration: 5000,
        });
      },
    })
  );

  const createShareLink = useMutation(
    trpc.package.createShareLink.mutationOptions({
      onSuccess: async (data) => {
        setShareUrl(data.shareUrl);
        try {
          await navigator.clipboard.writeText(data.shareUrl);
          toast.success("Link copied to clipboard", { duration: 4000 });
        } catch {
          toast.success("Share link created", { duration: 4000 });
        }
      },
      onError: () => {
        toast.error("Could not create share link. Try again.", {
          duration: 4000,
        });
      },
    })
  );

  const handleDownload = () => {
    downloadBundle.mutate({ sessionId });
  };

  const handleShare = () => {
    createShareLink.mutate({ sessionId });
  };

  return (
    <div className="flex flex-col items-center gap-[var(--space-3)]">
      <Button
        variant="default"
        onClick={handleDownload}
        disabled={downloadBundle.isPending}
        className="w-full max-w-[320px] bg-[var(--foreground)] text-[var(--background)] hover:bg-[var(--accent)]"
      >
        {downloadBundle.isPending
          ? "Preparing..."
          : downloaded
            ? "\u2713 Downloaded"
            : "Download package"}
      </Button>

      {shareUrl ? (
        <p className="text-sm text-[var(--foreground-muted)]">
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="underline-offset-4 hover:underline"
          >
            {shareUrl}
          </a>
        </p>
      ) : (
        <button
          type="button"
          onClick={handleShare}
          disabled={createShareLink.isPending}
          className="text-sm text-[var(--foreground-muted)] underline-offset-4 hover:text-[var(--foreground)] hover:underline disabled:opacity-50"
        >
          {createShareLink.isPending ? "Creating link..." : "Share direction"}
        </button>
      )}
    </div>
  );
}
