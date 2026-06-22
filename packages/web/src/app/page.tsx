import { HeroSection } from "@/components/landing/hero-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { HowItWorksSection } from "@/components/landing/how-it-works-section";
import { DifferentiationSection } from "@/components/landing/differentiation-section";
import { StatsSection } from "@/components/landing/stats-section";
import { CtaSection } from "@/components/landing/cta-section";

export default function LandingPage() {
  return (
    <>
      <HeroSection />
      <ProblemSection />
      <HowItWorksSection />
      <DifferentiationSection />
      {/* <StatsSection /> */}
      <CtaSection />
    </>
  );
}
