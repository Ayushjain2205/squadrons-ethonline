"use client";

import Image from "next/image";
import type { AvatarId, OrbColorId } from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";

interface AgentArchetype {
  id: string;
  name: string;
  chainName: string;
  chainLogo: string;
  avatarId: AvatarId;
  colorId: OrbColorId;
  mandate: string;
  gridSpan: string;
  accentBorderHover: string;
  glowColor: string;
}

const ARCHETYPES: AgentArchetype[] = [
  {
    id: "base-lp",
    name: "Base LP Harvester",
    chainName: "Base",
    chainLogo: "/chains/base.png",
    avatarId: "03",
    colorId: "blue",
    mandate:
      "Active tick-range manager on Aerodrome. Shifts liquidity bounds and auto-compounds fee yield.",
    gridSpan: "lg:col-span-2",
    accentBorderHover: "hover:border-[#60a5fa]/60",
    glowColor: "rgba(96,165,250,0.15)",
  },
  {
    id: "arb-scout",
    name: "Arbitrum Arb Scout",
    chainName: "Arbitrum",
    chainLogo: "/chains/arbitrum.png",
    avatarId: "06",
    colorId: "red",
    mandate:
      "Monitors tick discrepancies between Camelot and Uniswap v3 with zero inventory risk.",
    gridSpan: "lg:col-span-1",
    accentBorderHover: "hover:border-[#e07a7a]/60",
    glowColor: "rgba(224,122,122,0.15)",
  },
  {
    id: "eth-alpha",
    name: "CT Alpha Sentinel",
    chainName: "Ethereum",
    chainLogo: "/chains/ethereum.png",
    avatarId: "08",
    colorId: "orange",
    mandate:
      "Scans Crypto Twitter velocity and correlates social alpha with smart-money DEX accumulation.",
    gridSpan: "lg:col-span-1",
    accentBorderHover: "hover:border-[#e0b35a]/60",
    glowColor: "rgba(224,179,90,0.15)",
  },
  {
    id: "perp-basis",
    name: "Delta-Neutral Basis Sentinel",
    chainName: "Optimism",
    chainLogo: "/chains/optimism.png",
    avatarId: "04",
    colorId: "yellow",
    mandate:
      "Harvests perpetual funding rate skews while maintaining automated spot delta hedges.",
    gridSpan: "lg:col-span-1",
    accentBorderHover: "hover:border-[#e0b35a]/60",
    glowColor: "rgba(224,179,90,0.15)",
  },
  {
    id: "uni-rebalance",
    name: "Unichain Rebalancer",
    chainName: "Unichain",
    chainLogo: "/chains/unichain.png",
    avatarId: "01",
    colorId: "green",
    mandate:
      "Automated cross-pool inventory rebalancing and single-block atomic settlement routing.",
    gridSpan: "lg:col-span-2",
    accentBorderHover: "hover:border-[#5dcea0]/60",
    glowColor: "rgba(93,206,160,0.15)",
  },
  {
    id: "world-alpha",
    name: "World Chain Sentinel",
    chainName: "World Chain",
    chainLogo: "/chains/worldchain.png",
    avatarId: "07",
    colorId: "purple",
    mandate:
      "Tracks verified human liquidity pools and executes safe algorithmic DCA rebalance schedules.",
    gridSpan: "lg:col-span-1",
    accentBorderHover: "hover:border-[#a855f7]/60",
    glowColor: "rgba(168,85,247,0.15)",
  },
  {
    id: "robinhood-spot",
    name: "Robinhood Spot Sentinel",
    chainName: "Robinhood",
    chainLogo: "/chains/robinhood.png",
    avatarId: "05",
    colorId: "pink",
    mandate:
      "High-frequency DEX swap router and momentum breakout monitor across wrapped asset pools.",
    gridSpan: "lg:col-span-2",
    accentBorderHover: "hover:border-[#f472b6]/60",
    glowColor: "rgba(244,114,182,0.15)",
  },
  {
    id: "arc-liquidity",
    name: "Arc Liquidity Sentinel",
    chainName: "Arc",
    chainLogo: "/chains/arc.png",
    avatarId: "02",
    colorId: "blue",
    mandate:
      "USDC↔EURC FX on Arc via Circle Swap Kit — stablecoin-native quotes and capped desk execution.",
    gridSpan: "lg:col-span-2",
    accentBorderHover: "hover:border-[#60a5fa]/60",
    glowColor: "rgba(96,165,250,0.15)",
  },
];

export function AgentRosterBento() {
  return (
    <section className="relative min-h-screen flex flex-col justify-center items-center border-t border-[#1f1f1f] bg-[#000000] px-6 py-24 md:py-32 text-[#f4f4f5]">
      {/* Ambient background glow */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(93,206,160,0.07)_0%,rgba(96,165,250,0.05)_40%,transparent_70%)] blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-6xl space-y-12">
        {/* Section Header */}
        <div className="text-center">
          <h2 className="font-[family-name:var(--font-hero)] text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl md:text-6xl leading-tight">
            Deploy battle-tested recipes
          </h2>
        </div>

        {/* Dynamic 8-Card Asymmetrical Bento Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {ARCHETYPES.map((agent) => (
            <div
              key={agent.id}
              className={`group relative rounded-3xl border border-[#262626] bg-[#090a0d] p-6 sm:p-7 shadow-2xl transition-all duration-300 ${agent.gridSpan} ${agent.accentBorderHover} flex flex-col justify-between overflow-hidden`}
            >
              {/* Subtle dynamic hover background glow */}
              <div
                className="pointer-events-none absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-3xl"
                style={{
                  background: `radial-gradient(400px circle at top right, ${agent.glowColor}, transparent 70%)`,
                }}
              />

              {/* Top Bar: Chain & Avatar */}
              <div className="relative z-10 flex items-center justify-between mb-5">
                <div className="flex items-center gap-2 rounded-full border border-[#22232b] bg-[#101117] px-3 py-1">
                  <div className="relative h-4 w-4 overflow-hidden rounded-md">
                    <Image
                      src={agent.chainLogo}
                      alt={agent.chainName}
                      width={16}
                      height={16}
                      className="object-cover"
                    />
                  </div>
                  <span className="font-mono text-xs font-semibold text-[#a1a1aa]">
                    {agent.chainName}
                  </span>
                </div>

                <div className="shrink-0 group-hover:scale-105 transition-transform duration-300">
                  <AgentOrb
                    id={agent.avatarId}
                    colorId={agent.colorId}
                    size={52}
                    animate={true}
                  />
                </div>
              </div>

              {/* Identity & Mandate */}
              <div className="relative z-10 space-y-2">
                <h3 className="text-xl sm:text-2xl font-bold text-[#f4f4f5] tracking-tight">
                  {agent.name}
                </h3>
                <p className="text-xs text-[#8a8a93] leading-relaxed line-clamp-3">
                  {agent.mandate}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

