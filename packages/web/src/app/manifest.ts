import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Conduit — The Payment Layer for Autonomous Agents",
    short_name: "Conduit",
    description:
      "Permissionless state channel micropayments on Solana for autonomous AI agents.",
    start_url: "/",
    display: "standalone",
    background_color: "#070B14",
    theme_color: "#070B14",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "any",
        type: "image/x-icon",
      },
    ],
  };
}
