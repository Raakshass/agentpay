"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Copy } from "lucide-react";
import { truncateAddress } from "@/lib/format";
import { EASE_OUT } from "@/lib/motion";

interface AddressProps {
  address: string;
  startChars?: number;
  endChars?: number;
  className?: string;
  showCopyButton?: boolean;
}

export function Address({
  address,
  startChars = 4,
  endChars = 4,
  className = "",
  showCopyButton = true,
}: AddressProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API not available
    }
  }, [address]);

  return (
    <motion.button
      onClick={handleCopy}
      className={[
        "inline-flex items-center gap-1.5 group",
        "font-mono text-sm text-text-muted",
        "hover:text-text-primary transition-colors duration-200",
        className,
      ].join(" ")}
      title={`${address} — Click to copy`}
      aria-label={`Copy address ${truncateAddress(address, startChars, endChars)}`}
      whileTap={{ scale: 0.97 }}
      /* Flash overlay on copy */
      animate={
        copied
          ? {
              backgroundColor: [
                "rgba(95,224,255,0.12)",
                "rgba(95,224,255,0)",
              ],
            }
          : {}
      }
      transition={{ duration: 0.4, ease: EASE_OUT }}
    >
      <span>{truncateAddress(address, startChars, endChars)}</span>
      {showCopyButton && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          <AnimatePresence mode="wait" initial={false}>
            {copied ? (
              <motion.span
                key="check"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              >
                <Check className="w-3 h-3 text-success" />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                initial={{ opacity: 0, scale: 0.6 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.6 }}
                transition={{ duration: 0.15, ease: EASE_OUT }}
              >
                <Copy className="w-3 h-3" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      )}
    </motion.button>
  );
}
