"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import { motion } from "motion/react";

export function AuthIllustration({ src }: { src: string }) {
  const [desktopContainer, setDesktopContainer] = useState<HTMLElement | null>(
    null,
  );
  const [mobileContainer, setMobileContainer] = useState<HTMLElement | null>(
    null,
  );

  useEffect(() => {
    setDesktopContainer(document.getElementById("auth-illustration-desktop"));
    setMobileContainer(document.getElementById("auth-illustration-mobile"));
  }, []);

  return (
    <>
      {desktopContainer &&
        createPortal(
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0, scale: 1.1 }}
            animate={{ opacity: 1, scale: [1, 1.05, 1] }}
            transition={{
              opacity: { duration: 1.2, ease: "easeOut" },
              scale: { duration: 25, repeat: Infinity, ease: "easeInOut", delay: 1.2 },
            }}
          >
            <Image
              src={src}
              alt=""
              fill
              className="object-cover"
              priority
              sizes="50vw"
            />
            {/* Gradient fade into form panel */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-transparent via-60% to-[#09090b]" />
            {/* Subtle top/bottom vignette */}
            <div className="absolute inset-0 bg-gradient-to-b from-[#09090b]/40 via-transparent to-[#09090b]/60" />
          </motion.div>,
          desktopContainer,
        )}

      {mobileContainer &&
        createPortal(
          <motion.div
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 1.4, ease: "easeOut" }}
          >
            <Image
              src={src}
              alt=""
              fill
              className="object-cover opacity-40"
              priority
              sizes="(max-width: 1024px) 100vw, 0px"
            />
            <div className="absolute inset-0 bg-[#09090b]/40" />
          </motion.div>,
          mobileContainer,
        )}
    </>
  );
}
