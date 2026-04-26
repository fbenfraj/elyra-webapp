"use client";

import { useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Check } from "lucide-react";

type ImageLightboxProps = {
  src: string | null;
  alt?: string;
  isSelected?: boolean;
  onToggleSelect?: () => void;
  onClose: () => void;
};

export function ImageLightbox({
  src,
  alt = "Reference image",
  isSelected,
  onToggleSelect,
  onClose,
}: ImageLightboxProps) {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (!src) return;
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [src, handleKeyDown]);

  return (
    <AnimatePresence>
      {src && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          <div
            className="absolute inset-0 bg-black/70"
            onClick={onClose}
          />

          <motion.div
            className="relative z-10 flex flex-col items-center gap-4"
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <button
              onClick={onClose}
              className="absolute -right-2 -top-2 z-20 flex size-8 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur-sm transition-colors hover:bg-white/20"
            >
              <X className="size-4" />
            </button>

            <img
              src={src}
              alt={alt}
              className="max-h-[80vh] max-w-[80vw] rounded-lg object-contain"
            />

            {onToggleSelect && (
              <button
                onClick={onToggleSelect}
                className={`flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                  isSelected
                    ? "bg-white text-[#09090b]"
                    : "bg-white/10 text-white hover:bg-white/20"
                }`}
              >
                <Check className="size-4" />
                {isSelected ? "Selected" : "Select as reference"}
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
