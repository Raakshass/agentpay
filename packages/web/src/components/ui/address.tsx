"use client";

import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import { truncateAddress } from "@/lib/format";

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
    <button
      onClick={handleCopy}
      className={[
        "inline-flex items-center gap-1.5 group",
        "font-mono text-sm text-text-muted",
        "hover:text-text-primary transition-colors duration-200",
        className,
      ].join(" ")}
      title={`${address} — Click to copy`}
      aria-label={`Copy address ${truncateAddress(address, startChars, endChars)}`}
    >
      <span>{truncateAddress(address, startChars, endChars)}</span>
      {showCopyButton && (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity duration-200">
          {copied ? (
            <Check className="w-3 h-3 text-success" />
          ) : (
            <Copy className="w-3 h-3" />
          )}
        </span>
      )}
    </button>
  );
}
