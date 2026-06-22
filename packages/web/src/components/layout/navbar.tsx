"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Menu, X, Github } from "lucide-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { EASE_OUT } from "@/lib/motion";

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/catalog", label: "Catalog" },
  { href: "/providers", label: "Providers" },
  { href: "/demo", label: "Live Demo" },
  { href: "/docs", label: "Docs" },
];

export function Navbar() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  return (
    <header className="fixed top-0 left-0 right-0 z-50">
      <nav
        className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
        aria-label="Main navigation"
      >
        <div className="flex items-center justify-between h-16 border-b border-border bg-bg/80 backdrop-blur-xl">
          {/* Logo */}
          <Link
            href="/"
            className="flex items-center gap-2 text-text-primary font-semibold text-lg tracking-tight transition-[filter] duration-200 hover:brightness-110"
          >
            <div className="w-16 h-8 rounded-lg overflow-hidden flex items-center justify-center transition-shadow duration-300 hover:shadow-[0_0_16px_-4px_rgba(166,107,255,0.3)]">
              <img 
                src="/conduit_animated_logo.svg" 
                alt="Conduit Logo" 
                className="w-full h-full object-cover"
              />
            </div>
            Conduit
          </Link>

          {/* Desktop nav links */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={[
                    "relative px-4 py-2 text-sm font-medium rounded-full transition-colors duration-200",
                    isActive
                      ? "text-text-primary"
                      : "text-text-muted hover:text-text-primary",
                  ].join(" ")}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute inset-0 rounded-full bg-white/5 border border-border"
                      transition={{
                        type: "spring",
                        bounce: 0.15,
                        duration: 0.5,
                      }}
                    />
                  )}
                </Link>
              );
            })}
          </div>

          {/* GitHub + Wallet + mobile toggle */}
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/Raakshass/agentpay"
              target="_blank"
              rel="noopener noreferrer"
              aria-label="GitHub repository"
              className="hidden sm:flex w-9 h-9 items-center justify-center rounded-full border border-border text-text-muted hover:text-text-primary hover:border-border-hover transition-colors duration-200"
            >
              <Github className="w-4 h-4" />
            </a>
            <div className="hidden sm:block">
              <WalletMultiButton />
            </div>
            <button
              className="md:hidden p-2 text-text-muted hover:text-text-primary"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label={mobileOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileOpen}
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobileOpen && (
            <motion.div
              initial={prefersReducedMotion ? { opacity: 1 } : { opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? { opacity: 0 } : { opacity: 0, y: -10 }}
              transition={{ duration: 0.2, ease: EASE_OUT }}
              className="md:hidden border-b border-border bg-bg/95 backdrop-blur-xl"
            >
              <div className="px-4 py-4 space-y-1">
                {navLinks.map((link) => {
                  const isActive = pathname === link.href;
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setMobileOpen(false)}
                      className={[
                        "block px-4 py-2.5 text-sm font-medium rounded-lg transition-colors",
                        isActive
                          ? "text-text-primary bg-white/5"
                          : "text-text-muted hover:text-text-primary hover:bg-white/5",
                      ].join(" ")}
                    >
                      {link.label}
                    </Link>
                  );
                })}
                <div className="pt-3 sm:hidden">
                  <WalletMultiButton />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
    </header>
  );
}
