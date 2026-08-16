"use client";

import { CreditCard, Clock, Lock } from "lucide-react";
import { SectionHeading } from "@/components/ui/section-heading";
import { PillLabel } from "@/components/ui/pill-label";
import { Card } from "@/components/ui/card";
import { FadeInView, fadeInUp } from "@/components/ui/fade-in-view";
import { motion } from "framer-motion";

const problems = [
  {
    icon: CreditCard,
    title: "No credit cards",
    description:
      "Autonomous agents don't have identities, bank accounts, or credit cards. Traditional payment rails are built for humans.",
  },
  {
    icon: Clock,
    title: "Subscriptions don't fit",
    description:
      "Agents spin up, make 3 API calls, and shut down. Monthly subscriptions waste money on idle capacity.",
  },
  {
    icon: Lock,
    title: "Walled gardens",
    description:
      "Closed platforms lock agents into specific providers. There's no open marketplace where any agent can pay any API.",
  },
];

export function ProblemSection() {
  return (
    <section className="py-16 sm:py-24 bg-bg-lifted" aria-label="Problem">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          pill={<PillLabel icon="◆" label="THE PROBLEM" />}
          before="Agents can't hold"
          emphasis="credit cards."
          subtitle="The entire payments stack was built for humans with identities and bank accounts. Autonomous software needs something fundamentally different."
        />

        <FadeInView stagger className="mt-16 grid grid-cols-1 md:grid-cols-3 gap-6">
          {problems.map((problem) => (
            <motion.div
              key={problem.title}
              variants={fadeInUp}
              whileHover={{ y: -4 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <Card hoverable={false} className="group p-8 h-full">
                <div className="w-12 h-12 rounded-xl bg-white/5 border border-border flex items-center justify-center mb-6 transition-all duration-300 ease-out group-hover:bg-accent/10 group-hover:border-accent/25 group-hover:scale-110 group-hover:-rotate-3">
                  <problem.icon className="w-5 h-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-3">
                  {problem.title}
                </h3>
                <p className="text-sm text-text-muted leading-relaxed">
                  {problem.description}
                </p>
              </Card>
            </motion.div>
          ))}
        </FadeInView>
      </div>
    </section>
  );
}
