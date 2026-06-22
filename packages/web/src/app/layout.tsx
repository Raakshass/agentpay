import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ClientProviders } from "./client-providers";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://conduit.dev";
const TITLE = "Conduit — The Payment Layer for Autonomous Agents";
const DESCRIPTION =
  "Permissionless state channel micropayments on Solana. AI agents pay for APIs, DePIN data, and other agents' services using USDC — no subscriptions, no credit cards.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: TITLE,
  description: DESCRIPTION,
  applicationName: "Conduit",
  keywords: [
    "Conduit",
    "Solana",
    "AI agents",
    "micropayments",
    "USDC",
    "state channels",
    "DePIN",
    "Web3 API",
  ],
  openGraph: {
    type: "website",
    siteName: "Conduit",
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
  },
  twitter: {
    card: "summary_large_image",
    title: TITLE,
    description: DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: "#070B14",
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
