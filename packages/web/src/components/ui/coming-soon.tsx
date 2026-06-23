import Link from "next/link";
import { PillLabel } from "@/components/ui/pill-label";

interface ComingSoonProps {
  /** Short uppercase label shown in the pill, e.g. "CATALOG". */
  pill: string;
  /** Serif-emphasised noun for the heading, e.g. "provider catalog". */
  title: string;
  /** Supporting copy describing what's coming. */
  description: string;
}

/**
 * Branded placeholder for routes that are temporarily disabled while their
 * data sources are still mock/placeholder. Keeps the route navigable (no 404)
 * and on-brand instead of exposing fake data.
 */
export function ComingSoon({ pill, title, description }: ComingSoonProps) {
  return (
    <div className="relative mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-28 md:py-40 text-center">
      <div className="absolute inset-0 pointer-events-none glow-bloom opacity-60" />
      <div className="relative flex flex-col items-center">
        <PillLabel icon="✦" label={pill} />
        <h1 className="mt-6 text-4xl md:text-5xl font-semibold tracking-tight leading-[1.1]">
          The <span className="heading-serif text-gradient">{title}</span>
          <br />
          is coming soon
        </h1>
        <p className="mt-5 text-text-muted text-base md:text-lg leading-relaxed max-w-lg">
          {description}
        </p>
        <Link
          href="/"
          className="mt-10 text-sm font-medium text-accent hover:brightness-110 transition-[filter] duration-200"
        >
          ← Back to home
        </Link>
      </div>
    </div>
  );
}
