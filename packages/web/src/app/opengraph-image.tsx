import { ImageResponse } from "next/og";

export const alt = "Conduit — The Payment Layer for Autonomous Agents";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// Branded OG image: midnight background, violet→cyan signature gradient wordmark.
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background:
            "radial-gradient(ellipse 45% 60% at 30% 40%, rgba(166,107,255,0.22) 0%, transparent 70%)," +
            "radial-gradient(ellipse 45% 60% at 72% 60%, rgba(95,224,255,0.22) 0%, transparent 70%)," +
            "#070B14",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            fontSize: 140,
            fontWeight: 700,
            letterSpacing: "0.12em",
            backgroundImage: "linear-gradient(90deg, #A66BFF 0%, #5FE0FF 100%)",
            backgroundClip: "text",
            color: "transparent",
          }}
        >
          CONDUIT
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 38,
            color: "#9DB2D4",
          }}
        >
          The Payment Layer for Autonomous Agents
        </div>
      </div>
    ),
    { ...size },
  );
}
