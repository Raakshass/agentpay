/**
 * PortalScene — the hero visual.
 *
 * Two "Minecraft portal" nodes (AI Agent on the left in violet, DePIN Provider
 * on the right in cyan) connected by an animated violet→cyan data stream,
 * expressing value flowing between agents. Pass `isAccelerated` to speed up the
 * animations (e.g. on interaction / demo mode).
 *
 * The artwork is authored at a fixed 800×400 stage and scaled down responsively
 * so it never overflows narrow viewports.
 */
interface PortalSceneProps {
  isAccelerated?: boolean;
}

export function PortalScene({ isAccelerated = false }: PortalSceneProps) {
  const pulseSpeed = isAccelerated ? "0.5s" : "3s";

  return (
    <div className="relative w-full overflow-hidden h-[200px] sm:h-[280px] md:h-[360px] lg:h-[440px]">
      <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 scale-[0.4] sm:scale-[0.6] md:scale-[0.85] lg:scale-100">
        <div className="relative z-10 flex flex-col items-center group cursor-pointer">
          <div className="relative w-[800px] h-[400px] flex items-center justify-between px-[80px]" style={{ perspective: '1200px' }}>

            {/* Bridge / Data Stream */}
            <svg className="absolute inset-0 w-full h-full z-10 pointer-events-none" viewBox="0 0 800 400">
              <defs>
                <linearGradient id="streamGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#9333EA" />
                  <stop offset="50%" stopColor="#818CF8" />
                  <stop offset="100%" stopColor="#06B6D4" />
                </linearGradient>
                <filter id="bridgeGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="8" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {/* MASK: Fades the stream edges so they emerge from INSIDE the deep voids */}
                <linearGradient id="voidMaskFade" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="20.5%" stopColor="black" />
                  <stop offset="25%" stopColor="white" />
                  <stop offset="75%" stopColor="white" />
                  <stop offset="79.5%" stopColor="black" />
                </linearGradient>
                <mask id="voidMask">
                  <rect x="0" y="0" width="800" height="400" fill="url(#voidMaskFade)" />
                </mask>

                <style>
                  {`
                    /* Irregular burst lengths for pseudo-random data packets */
                    @keyframes flowBurst1 { from { stroke-dashoffset: 710; } to { stroke-dashoffset: 0; } }
                    @keyframes flowBurst2 { from { stroke-dashoffset: 535; } to { stroke-dashoffset: 0; } }
                    @keyframes flowBurstRev { from { stroke-dashoffset: 0; } to { stroke-dashoffset: 695; } }

                    @keyframes pulseGlow { 0% { opacity: 0.6; stroke-width: 2px; } 100% { opacity: 1; stroke-width: 3px; } }
                    @keyframes voidThrob { 0% { opacity: 0.4; } 100% { opacity: 0.85; } }

                    /* Out-of-phase animation timings to eliminate repeating patterns */
                    .stream-burst-1 { animation: flowBurst1 ${isAccelerated ? "1.2s" : "4s"} linear infinite; }
                    .stream-burst-2 { animation: flowBurst2 ${isAccelerated ? "0.8s" : "3.1s"} linear infinite; }
                    .stream-burst-rev { animation: flowBurstRev ${isAccelerated ? "1.5s" : "4.7s"} linear infinite; }

                    .portal-pulse { animation: pulseGlow ${pulseSpeed} ease-in-out infinite alternate; }
                    .void-core { animation: voidThrob ${pulseSpeed} ease-in-out infinite alternate; }

                    @media (prefers-reduced-motion: reduce) {
                      .stream-burst-1, .stream-burst-2, .stream-burst-rev,
                      .portal-pulse, .void-core { animation: none !important; }
                    }
                  `}
                </style>
              </defs>

              {/* Group masked to fade out at the exact coordinates of the 3D void boundaries */}
              <g mask="url(#voidMask)">
                {/* Core faint energy connection */}
                <path d="M 170 200 L 630 200" fill="none" stroke="url(#streamGradient)" strokeWidth="2" opacity="0.1" filter="url(#bridgeGlow)" />

                {/* Random Packet Burst 1 (Lower Arc) */}
                <path d="M 170 200 Q 400 240 630 200" fill="none" stroke="url(#streamGradient)" strokeWidth="3.5" strokeDasharray="15 200 5 150 40 300" strokeLinecap="round" className="stream-burst-1" filter="url(#bridgeGlow)" />

                {/* Random Packet Burst 2 (Center Arc) */}
                <path d="M 170 200 Q 400 210 630 200" fill="none" stroke="url(#streamGradient)" strokeWidth="2" strokeDasharray="5 100 20 250 10 150" strokeLinecap="round" opacity="0.8" className="stream-burst-2" filter="url(#bridgeGlow)" />

                {/* Random Packet Return (Upper Arc) */}
                <path d="M 170 200 Q 400 160 630 200" fill="none" stroke="url(#streamGradient)" strokeWidth="2.5" strokeDasharray="25 150 5 300 15 200" strokeLinecap="round" opacity="0.7" className="stream-burst-rev" filter="url(#bridgeGlow)" />
              </g>
            </svg>

            {/* LEFT PORTAL (AI Agent Node) */}
            <div className="z-20 relative transition-transform duration-700 ease-out group-hover:translate-x-2 group-hover:scale-105" style={{ transform: 'rotateY(35deg) translateZ(20px)' }}>
              <svg width="180" height="320" viewBox="0 0 140 260" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="neonGlowLeft" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="blur1" />
                    <feGaussianBlur stdDeviation="16" result="blur2" />
                    <feMerge><feMergeNode in="blur2" /><feMergeNode in="blur1" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="deepShadowLeft"><feDropShadow dx="0" dy="15" stdDeviation="15" floodColor="#000000" floodOpacity="0.8"/></filter>
                  <radialGradient id="voidGlowLeft" cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="#C084FC" stopOpacity="0.9" />
                    <stop offset="40%" stopColor="#7E22CE" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#02040A" stopOpacity="0" />
                  </radialGradient>
                  <pattern id="minecraftPortalLeft" width="32" height="32" patternUnits="userSpaceOnUse">
                    <rect width="32" height="32" fill="#2E1065" />
                    <g opacity="0.6">
                      <path d="M8,0 v8 h-8 m32,0 h-8 v8 h8 m-8,8 v8 h-8 m-16,-8 h8 v-8" fill="none" stroke="#7E22CE" strokeWidth="4"/>
                      <rect x="12" y="12" width="8" height="8" fill="#A855F7" />
                      <rect x="4" y="20" width="4" height="4" fill="#C084FC" opacity="0.8"/>
                      <rect x="24" y="8" width="4" height="4" fill="#D8B4FE" opacity="0.6"/>
                    </g>
                    <animateTransform attributeName="patternTransform" type="translate" from="0 32" to="0 0" dur={isAccelerated ? "1s" : "4s"} repeatCount="indefinite" />
                  </pattern>
                </defs>
                <g filter="url(#deepShadowLeft)">
                  <path d="M20 20 L40 40 L40 220 L20 240 Z" fill="#171236" stroke="#3B1C73" strokeWidth="1"/>
                  <path d="M120 20 L100 40 L100 220 L120 240 Z" fill="#171236" stroke="#3B1C73" strokeWidth="1"/>
                  <path d="M20 20 L120 20 L100 40 L40 40 Z" fill="#241452" stroke="#3B1C73" strokeWidth="1"/>
                  <path d="M20 240 L120 240 L100 220 L40 220 Z" fill="#0A0F1E" stroke="#3B1C73" strokeWidth="1"/>
                </g>
                <rect x="40" y="40" width="60" height="180" fill="#02040A" />
                <rect x="40" y="40" width="60" height="180" fill="url(#minecraftPortalLeft)" />
                <rect x="40" y="40" width="60" height="180" fill="url(#voidGlowLeft)" className="void-core" style={{mixBlendMode: 'screen'}} />
                <rect x="40" y="40" width="60" height="180" fill="none" stroke="#9333EA" className="portal-pulse" filter="url(#neonGlowLeft)" />
              </svg>
            </div>

            {/* RIGHT PORTAL (DePIN Provider Node) */}
            <div className="z-20 relative transition-transform duration-700 ease-out group-hover:-translate-x-2 group-hover:scale-105" style={{ transform: 'rotateY(-35deg) translateZ(20px)' }}>
              <svg width="180" height="320" viewBox="0 0 140 260" fill="none" xmlns="http://www.w3.org/2000/svg">
                <defs>
                  <filter id="neonGlowRight" x="-50%" y="-50%" width="200%" height="200%">
                    <feGaussianBlur stdDeviation="6" result="blur1" />
                    <feGaussianBlur stdDeviation="16" result="blur2" />
                    <feMerge><feMergeNode in="blur2" /><feMergeNode in="blur1" /><feMergeNode in="SourceGraphic" /></feMerge>
                  </filter>
                  <filter id="deepShadowRight"><feDropShadow dx="0" dy="15" stdDeviation="15" floodColor="#000000" floodOpacity="0.8"/></filter>
                  <radialGradient id="voidGlowRight" cx="50%" cy="50%" r="60%">
                    <stop offset="0%" stopColor="#22D3EE" stopOpacity="0.9" />
                    <stop offset="40%" stopColor="#0891B2" stopOpacity="0.5" />
                    <stop offset="100%" stopColor="#02040A" stopOpacity="0" />
                  </radialGradient>
                  <pattern id="minecraftPortalRight" width="32" height="32" patternUnits="userSpaceOnUse">
                    <rect width="32" height="32" fill="#083344" />
                    <g opacity="0.6">
                      <path d="M8,0 v8 h-8 m32,0 h-8 v8 h8 m-8,8 v8 h-8 m-16,-8 h8 v-8" fill="none" stroke="#0284C7" strokeWidth="4"/>
                      <rect x="12" y="12" width="8" height="8" fill="#06B6D4" />
                      <rect x="4" y="20" width="4" height="4" fill="#67E8F9" opacity="0.8"/>
                      <rect x="24" y="8" width="4" height="4" fill="#A5F3FC" opacity="0.6"/>
                    </g>
                    <animateTransform attributeName="patternTransform" type="translate" from="0 32" to="0 0" dur={isAccelerated ? "1s" : "4s"} repeatCount="indefinite" />
                  </pattern>
                </defs>
                <g filter="url(#deepShadowRight)">
                  <path d="M20 20 L40 40 L40 220 L20 240 Z" fill="#08202A" stroke="#0C4A6E" strokeWidth="1"/>
                  <path d="M120 20 L100 40 L100 220 L120 240 Z" fill="#08202A" stroke="#0C4A6E" strokeWidth="1"/>
                  <path d="M20 20 L120 20 L100 40 L40 40 Z" fill="#10364A" stroke="#0C4A6E" strokeWidth="1"/>
                  <path d="M20 240 L120 240 L100 220 L40 220 Z" fill="#030E14" stroke="#0C4A6E" strokeWidth="1"/>
                </g>
                <rect x="40" y="40" width="60" height="180" fill="#02040A" />
                <rect x="40" y="40" width="60" height="180" fill="url(#minecraftPortalRight)" />
                <rect x="40" y="40" width="60" height="180" fill="url(#voidGlowRight)" className="void-core" style={{mixBlendMode: 'screen'}} />
                <rect x="40" y="40" width="60" height="180" fill="none" stroke="#06B6D4" className="portal-pulse" filter="url(#neonGlowRight)" />
              </svg>
            </div>
          </div>

          <div className="mt-2 text-center flex flex-col items-center">
            <h2 className="text-4xl tracking-[0.35em] font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-200 via-indigo-100 to-cyan-200 ml-3 drop-shadow-lg">
              CONDUIT
            </h2>
            <div className="w-16 h-px bg-gradient-to-r from-transparent via-indigo-500 to-transparent mt-4 opacity-50"></div>
          </div>
        </div>
      </div>
    </div>
  );
}
