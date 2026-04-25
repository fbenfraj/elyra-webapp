"use client";

import { useEffect, useCallback } from "react";
import { X, Download, Star, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "motion/react";

type Props = {
  image: {
    id: string;
    imageUrl: string;
    sessionBrief: string;
    favorited: boolean;
    createdAt: Date;
  } | null;
  onClose: () => void;
  onToggleFavorite: (id: string) => void;
  onDelete: (id: string) => void;
  onDownload: (id: string) => void;
};

export function ImageLightbox({
  image,
  onClose,
  onToggleFavorite,
  onDelete,
  onDownload,
}: Props) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  return (
    <AnimatePresence>
      {image && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4"
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="relative flex max-h-[90vh] max-w-4xl flex-col overflow-hidden rounded-xl bg-background-elevated"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Top bar */}
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <p className="max-w-md truncate text-sm text-foreground-muted">
                {image.sessionBrief}
              </p>
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onToggleFavorite(image.id)}
                  className="h-8 w-8 p-0"
                >
                  <Star
                    className={`size-4 ${image.favorited ? "fill-current text-yellow-500" : ""}`}
                  />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDownload(image.id)}
                  className="h-8 w-8 p-0"
                >
                  <Download className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (window.confirm("Delete this image permanently?")) {
                      onDelete(image.id);
                    }
                  }}
                  className="h-8 w-8 p-0 text-red-400 hover:text-red-300"
                >
                  <Trash2 className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-8 w-8 p-0"
                >
                  <X className="size-4" />
                </Button>
              </div>
            </div>

            {/* Image */}
            <div className="flex items-center justify-center p-4">
              <img
                src={image.imageUrl}
                alt={image.sessionBrief}
                className="max-h-[75vh] rounded-lg object-contain"
              />
            </div>

            {/* Footer */}
            <div className="border-t border-border px-4 py-2 text-xs text-foreground-subtle">
              {new Date(image.createdAt).toLocaleDateString("en-US", {
                year: "numeric",
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
