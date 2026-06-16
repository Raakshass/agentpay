import type { Metadata } from "next";
import "./globals.css";
import { ClientProviders } from "./client-providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

export const metadata: Metadata = {
  title: "AgentPay — The Payment Layer for Autonomous Agents",
  description:
    "Permissionless state channel micropayments on Solana. AI agents pay for APIs, DePIN data, and other agents' services using USDC — no subscriptions, no credit cards.",
  keywords: [
    "AgentPay",
    "Solana",
    "AI agents",
    "micropayments",
    "USDC",
    "state channels",
    "DePIN",
    "Web3 API",
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="noise-overlay">
        <ClientProviders>
          <Navbar />
          <main className="min-h-screen pt-16">{children}</main>
          <Footer />
        </ClientProviders>
      </body>
    </html>
  );
}
