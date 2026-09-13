"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { AvatarId, OrbColorId } from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";

interface StepChain {
  chainId: number;
  name: string;
  shortName: string;
  logoUrl: string;
}

const STEP_CHAINS: StepChain[] = [
  {
    chainId: 8453,
    name: "Base",
    shortName: "Base",
    logoUrl: "/chains/base.png",
  },
  {
    chainId: 1,
    name: "Ethereum",
    shortName: "Ethereum",
    logoUrl: "/chains/ethereum.png",
  },
  {
    chainId: 42161,
    name: "Arbitrum One",
    shortName: "Arbitrum",
    logoUrl: "/chains/arbitrum.png",
  },
  {
    chainId: 10,
    name: "Optimism",
    shortName: "Optimism",
    logoUrl: "/chains/optimism.png",
  },
  {
    chainId: 130,
    name: "Unichain",
    shortName: "Unichain",
    logoUrl: "/chains/unichain.png",
  },
  {
    chainId: 480,
    name: "World Chain",
    shortName: "World Chain",
    logoUrl: "/chains/worldchain.png",
  },
  {
    chainId: 4663,
    name: "Robinhood Chain",
    shortName: "Robinhood",
    logoUrl: "/chains/robinhood.png",
  },
  {
    chainId: 5042002,
    name: "Arc Testnet",
    shortName: "Arc",
    logoUrl: "/chains/arc.png",
  },
];

interface AgentPreset {
  id: string;
  chainId: number;
  avatarId: AvatarId;
  colorId: OrbColorId;
  name: string;
}

const STEP_1_PRESETS: AgentPreset[] = [
  {
    id: "base-lp",
    chainId: 8453,
    avatarId: "03",
    colorId: "blue",
    name: "Base LP Scout",
  },
  {
    id: "eth-dip",
    chainId: 1,
    avatarId: "08",
    colorId: "orange",
    name: "ETH Dip Watch",
  },
  {
    id: "arb-sentinel",
    chainId: 42161,
    avatarId: "06",
    colorId: "red",
    name: "Arbitrum Flow Watch",
  },
  {
    id: "opt-pulse",
    chainId: 10,
    avatarId: "01",
    colorId: "green",
    name: "Optimism Scout",
  },
  {
    id: "uni-rebalance",
    chainId: 130,
    avatarId: "04",
    colorId: "yellow",
    name: "Unichain Rebalancer",
  },
  {
    id: "world-alpha",
    chainId: 480,
    avatarId: "07",
    colorId: "purple",
    name: "World Alpha Scout",
  },
  {
    id: "robinhood-spot",
    chainId: 4663,
    avatarId: "05",
    colorId: "pink",
    name: "Robinhood Sentinel",
  },
  {
    id: "arc-scout",
    chainId: 5042002,
    avatarId: "02",
    colorId: "blue",
    name: "Arc Liquidity Sentinel",
  },
];

// Y coordinates for each of the 8 chain rows in SVG space
const CHAIN_Y_COORDS = [16, 48, 80, 112, 144, 176, 208, 240];
const TARGET_Y = 128;

interface MarqueeItem {
  name: string;
  desc: string;
}

const SKILLS_LIST: MarqueeItem[] = [
  { name: "market-analyser", desc: "Trending pools, flow & operator brief" },
  { name: "wallet-pulse", desc: "Balances, gas headroom & desk readiness" },
  { name: "dex-radar", desc: "Real-time liquidity depth & volume spikes" },
  { name: "arbitrage-hunter", desc: "Cross-DEX routing & price divergence" },
  { name: "lp-scout", desc: "Fee APY, tick density & IL risk analysis" },
  { name: "momentum-tracker", desc: "Breakout volume, RSI velocity & MACD turns" },
  { name: "funding-rate-monitor", desc: "Perp funding skews & basis yields" },
  { name: "token-screener", desc: "Smart money inflow & holder distribution" },
  { name: "yield-optimizer", desc: "Vault compounding & rebalance loops" },
  { name: "whale-watch", desc: "Large wallet transfers & accumulation zones" },
  { name: "gas-tracker", desc: "Base fee forecasting & priority spikes" },
];

const TOOLS_LIST: MarqueeItem[] = [
  { name: "search", desc: "Onchain subgraph & pool liquidity query" },
  { name: "pulse", desc: "Crypto Twitter & CT social sentiment stream" },
  { name: "backtest", desc: "90-day vector DEX simulation engine" },
  { name: "quote", desc: "Multi-DEX aggregator route & price impact" },
  { name: "safety", desc: "Dynamic gas limits & $10 spend cap ladder" },
  { name: "arm", desc: "Deterministic trigger loop compilation" },
  { name: "mempool", desc: "Pending block transaction & MEV radar" },
  { name: "contract", desc: "Decompiled ABI, events & bytecode verification" },
  { name: "balance", desc: "Multi-token wallet reserves & allowance audit" },
  { name: "order", desc: "Atomic swap & order placement router" },
];

const PLUGINS_LIST: MarqueeItem[] = [
  { name: "Uniswap v3", desc: "Concentrated liquidity AMM protocol" },
  { name: "Aerodrome", desc: "Base native liquidity & veAERO engine" },
  { name: "Camelot DEX", desc: "Arbitrum ecosystem AMM hub" },
  { name: "CoinGecko API", desc: "Real-time price feeds & market data" },
  { name: "Hyperliquid", desc: "Onchain perpetual DEX orderbook" },
  { name: "DefiLlama", desc: "Protocol TVL, volume & yield intelligence" },
  { name: "Twitter / X API", desc: "Live social alpha & sentiment streamer" },
  { name: "Aave v3", desc: "Money market supply & borrow rates" },
  { name: "The Graph", desc: "Decentralized subgraph indexing network" },
  { name: "Birdeye", desc: "DEX token analytics & trade streams" },
  { name: "1inch", desc: "Aggregated swap routing protocol" },
  { name: "Alchemy", desc: "High-throughput RPC node infrastructure" },
  { name: "Curve Finance", desc: "Deep stableswap & pegged pools" },
];

export function WorkflowSteps() {
  const [activePresetIndex, setActivePresetIndex] = useState(1); // ETH Dip Watch
  const [isFlickering, setIsFlickering] = useState(false);
  const [step3Stage, setStep3Stage] = useState(0);
  const [step4Corner, setStep4Corner] = useState(0);

  // Auto-cycle through the presets every 2.4s with smooth transition
  useEffect(() => {
    const interval = setInterval(() => {
      setIsFlickering(true);
      setTimeout(() => {
        setActivePresetIndex((prev) => (prev + 1) % STEP_1_PRESETS.length);
        setIsFlickering(false);
      }, 140);
    }, 2400);

    return () => clearInterval(interval);
  }, []);

  // Auto-cycle through the 3 strategy stages (0 -> 1 -> 2)
  useEffect(() => {
    const interval = setInterval(() => {
      setStep3Stage((prev) => (prev + 1) % 3);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  // Auto-cycle through the 3 triangle corners for Step 4 (0 -> 1 -> 2)
  useEffect(() => {
    const interval = setInterval(() => {
      setStep4Corner((prev) => (prev + 1) % 3);
    }, 2600);

    return () => clearInterval(interval);
  }, []);

  const currentPreset = STEP_1_PRESETS[activePresetIndex];
  const activeChainIndex = STEP_CHAINS.findIndex(
    (c) => c.chainId === currentPreset.chainId
  );

  return (
    <>
      {/* =========================================================================
          STEP 1: Choose chain, create agent
          ========================================================================= */}
      <section
        id="workflow"
        className="relative min-h-screen flex flex-col justify-center items-center border-t border-[#1f1f1f] bg-[#000000] px-6 py-24 md:py-32 text-[#f4f4f5]"
      >
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute left-1/3 top-1/4 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(93,206,160,0.08)_0%,transparent_70%)] blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-5xl flex flex-col items-center gap-10">
          {/* Header on Top */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#5dcea0]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5dcea0]/20 text-[10px]">
                01
              </span>
              <span>Step 1</span>
            </div>

            <h3 className="font-[family-name:var(--font-hero)] text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl md:text-6xl leading-tight">
              Choose chain, create agent
            </h3>
          </div>

          {/* Branching visual container centered below */}
          <div className="w-full">
            <div className="relative flex items-center justify-between gap-4 sm:gap-8 rounded-3xl border border-[#262626] bg-[#090a0d] p-6 sm:p-9 shadow-2xl overflow-hidden">
              {/* 1. All Supported Chains (Left) */}
              <div className="flex flex-col gap-2 w-44 sm:w-52 shrink-0">
                {STEP_CHAINS.map((chain, index) => {
                  const isActive = index === activeChainIndex;
                  return (
                    <div
                      key={chain.chainId}
                      onClick={() => {
                        const idx = STEP_1_PRESETS.findIndex((p) => p.chainId === chain.chainId);
                        if (idx !== -1) setActivePresetIndex(idx);
                      }}
                      className={`flex items-center justify-between rounded-xl border px-3.5 py-2 transition-all duration-300 cursor-pointer select-none ${
                        isActive
                          ? "border-[#5dcea0] bg-[#121c17] shadow-[0_0_15px_rgba(93,206,160,0.2)] ring-1 ring-[#5dcea0]/40"
                          : "border-[#262626] bg-[#0e0f14] hover:border-[#3f3f46] hover:bg-[#14151c]"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="relative h-4.5 w-4.5 overflow-hidden rounded-md bg-[#181a20]">
                          <Image
                            src={chain.logoUrl}
                            alt={chain.name}
                            width={18}
                            height={18}
                            className="object-cover"
                          />
                        </div>
                        <span
                          className={`text-xs font-semibold transition-colors ${
                            isActive ? "text-[#f4f4f5]" : "text-[#a1a1aa]"
                          }`}
                        >
                          {chain.shortName}
                        </span>
                      </div>
                      {isActive && (
                        <span className="h-1.5 w-1.5 rounded-full bg-[#5dcea0] shadow-[0_0_6px_#5dcea0]" />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 2. Dynamic SVG Branching Connector (Center) */}
              <div className="hidden sm:flex shrink-0 w-32 items-center justify-center">
                <svg viewBox="0 0 100 256" className="h-64 w-full">
                  <defs>
                    <linearGradient id="activeBranchGrad" x1="0" y1="0" x2="1" y2="0">
                      <stop offset="0%" stopColor="#5dcea0" stopOpacity="0.6" />
                      <stop offset="100%" stopColor="#5dcea0" stopOpacity="1" />
                    </linearGradient>
                  </defs>

                  {/* Background inactive dotted branch curves */}
                  {CHAIN_Y_COORDS.map((startY, i) => {
                    const isActive = i === activeChainIndex;
                    if (isActive) return null;
                    return (
                      <path
                        key={`inactive-${i}`}
                        d={`M 0 ${startY} C 50 ${startY}, 50 ${TARGET_Y}, 100 ${TARGET_Y}`}
                        fill="none"
                        stroke="#262626"
                        strokeWidth="1.2"
                        strokeDasharray="3 3"
                        className="transition-all duration-300"
                      />
                    );
                  })}

                  {/* Active Highlighted Branch Curve */}
                  {activeChainIndex >= 0 && (
                    <path
                      d={`M 0 ${CHAIN_Y_COORDS[activeChainIndex]} C 55 ${CHAIN_Y_COORDS[activeChainIndex]}, 45 ${TARGET_Y}, 100 ${TARGET_Y}`}
                      fill="none"
                      stroke="url(#activeBranchGrad)"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      className="drop-shadow-[0_0_8px_rgba(93,206,160,0.8)] transition-all duration-300"
                    />
                  )}

                  {/* Convergence endpoint dot */}
                  <circle cx="100" cy={TARGET_Y} r="3.5" fill="#5dcea0" className="shadow-[0_0_8px_#5dcea0]" />
                </svg>
              </div>

              {/* 3. Pure Avatar + Name (Spacious right container) */}
              <div className="flex flex-1 min-w-0 items-center justify-start pl-2 sm:pl-4">
                <div
                  className={`flex items-center gap-4 transition-all duration-200 select-none min-w-0 ${
                    isFlickering ? "opacity-30 scale-95" : "opacity-100 scale-100"
                  }`}
                >
                  {/* Avatar Orb */}
                  <div className="shrink-0">
                    <AgentOrb
                      id={currentPreset.avatarId}
                      colorId={currentPreset.colorId}
                      size={60}
                      animate={true}
                    />
                  </div>

                  {/* Agent Name */}
                  <h4 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#f4f4f5] whitespace-nowrap">
                    {currentPreset.name}
                  </h4>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          STEP 2: Research with skills, tools and plugins
          ========================================================================= */}
      <section className="relative min-h-screen flex flex-col justify-center items-center border-t border-[#1f1f1f] bg-[#000000] px-6 py-24 md:py-32 text-[#f4f4f5]">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(96,165,250,0.06)_0%,transparent_70%)] blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-5xl flex flex-col items-center gap-10">
          {/* Header on Top */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#5dcea0]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5dcea0]/20 text-[10px]">
                02
              </span>
              <span>Step 2</span>
            </div>

            <h3 className="font-[family-name:var(--font-hero)] text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl md:text-6xl leading-tight">
              Research with skills, tools and plugins
            </h3>
          </div>

          {/* Marquee Container with edge fade masks */}
          <div className="w-full overflow-hidden space-y-4 py-2 [mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)] [-webkit-mask-image:linear-gradient(to_right,transparent,black_6%,black_94%,transparent)]">
            {/* ROW 1: SKILLS (Scrolls Left) */}
            <div className="relative flex overflow-hidden">
              <div className="animate-marquee-left flex gap-3.5 items-center">
                {[...SKILLS_LIST, ...SKILLS_LIST, ...SKILLS_LIST].map((skill, idx) => (
                  <div
                    key={`skill-${skill.name}-${idx}`}
                    className="group flex items-center gap-3.5 rounded-xl border border-[#22232b] bg-[#0c0d12] px-4 py-2.5 transition-all duration-300 hover:border-[#5dcea0]/60 hover:bg-[#11141a] hover:shadow-[0_0_20px_rgba(93,206,160,0.15)] shrink-0 select-none cursor-default"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#5dcea0]/15 font-mono text-xs font-bold text-[#5dcea0] group-hover:bg-[#5dcea0]/25 transition-colors">
                      /
                    </span>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-semibold text-[#f4f4f5] tracking-tight group-hover:text-[#5dcea0] transition-colors">
                        {skill.name}
                      </span>
                      <span className="text-[11px] text-[#8a8a93] line-clamp-1">
                        {skill.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ROW 2: TOOLS (Scrolls Right) */}
            <div className="relative flex overflow-hidden">
              <div className="animate-marquee-right flex gap-3.5 items-center">
                {[...TOOLS_LIST, ...TOOLS_LIST, ...TOOLS_LIST].map((tool, idx) => (
                  <div
                    key={`tool-${tool.name}-${idx}`}
                    className="group flex items-center gap-3.5 rounded-xl border border-[#22232b] bg-[#0c0d12] px-4 py-2.5 transition-all duration-300 hover:border-[#e0b35a]/60 hover:bg-[#161410] hover:shadow-[0_0_20px_rgba(224,179,90,0.15)] shrink-0 select-none cursor-default"
                  >
                    <span className="flex h-6 w-6 items-center justify-center rounded-md bg-[#e0b35a]/15 font-mono text-xs font-bold text-[#e0b35a] group-hover:bg-[#e0b35a]/25 transition-colors">
                      @
                    </span>
                    <div className="flex flex-col">
                      <span className="font-mono text-xs font-semibold text-[#f4f4f5] tracking-tight group-hover:text-[#e0b35a] transition-colors">
                        {tool.name}
                      </span>
                      <span className="text-[11px] text-[#8a8a93] line-clamp-1">
                        {tool.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ROW 3: PLUGINS (Scrolls Left) */}
            <div className="relative flex overflow-hidden">
              <div className="animate-marquee-left flex gap-3.5 items-center">
                {[...PLUGINS_LIST, ...PLUGINS_LIST, ...PLUGINS_LIST].map((plugin, idx) => (
                  <div
                    key={`plugin-${plugin.name}-${idx}`}
                    className="group flex items-center gap-3.5 rounded-xl border border-[#22232b] bg-[#0c0d12] px-4 py-2.5 transition-all duration-300 hover:border-[#60a5fa]/60 hover:bg-[#0e131d] hover:shadow-[0_0_20px_rgba(96,165,250,0.15)] shrink-0 select-none cursor-default"
                  >
                    <span className="flex h-6 items-center justify-center rounded-md bg-[#60a5fa]/15 px-2 font-mono text-[10px] font-bold uppercase tracking-wider text-[#60a5fa] group-hover:bg-[#60a5fa]/25 transition-colors">
                      MCP
                    </span>
                    <div className="flex flex-col">
                      <span className="text-xs font-semibold text-[#f4f4f5] tracking-tight group-hover:text-[#60a5fa] transition-colors">
                        {plugin.name}
                      </span>
                      <span className="text-[11px] text-[#8a8a93] line-clamp-1">
                        {plugin.desc}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          STEP 3: Simulate in paper mode, graduate to live
          ========================================================================= */}
      <section className="relative min-h-screen flex flex-col justify-center items-center border-t border-[#1f1f1f] bg-[#000000] px-6 py-24 md:py-32 text-[#f4f4f5]">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(224,179,90,0.06)_0%,transparent_70%)] blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-5xl flex flex-col items-center gap-10">
          {/* Header on Top */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#5dcea0]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5dcea0]/20 text-[10px]">
                03
              </span>
              <span>Step 3</span>
            </div>

            <h3 className="font-[family-name:var(--font-hero)] text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl md:text-6xl leading-tight">
              Simulate in paper mode, graduate to live
            </h3>
          </div>

          {/* 3 Branched Stage Boxes */}
          <div className="w-full">
            <div className="flex flex-col md:flex-row items-stretch justify-between gap-3 sm:gap-4">
              {/* STAGE 1: Strategy Logic */}
              <div
                onClick={() => setStep3Stage(0)}
                className={`relative flex-1 w-full rounded-2xl border p-6 transition-all duration-500 cursor-pointer select-none flex flex-col justify-between ${
                  step3Stage === 0
                    ? "border-[#5dcea0] bg-[#0d1411] shadow-[0_0_25px_rgba(93,206,160,0.18)] scale-[1.02]"
                    : "border-[#262626] bg-[#090a0d] hover:border-[#3f3f46] hover:bg-[#0e0f14]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xl font-bold text-[#f4f4f5] tracking-tight">
                      Strategy Logic
                    </h4>
                    <span
                      className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                        step3Stage === 0
                          ? "bg-[#5dcea0] shadow-[0_0_8px_#5dcea0]"
                          : "bg-[#262626]"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-[#8a8a93] leading-relaxed mb-5">
                    Define pool triggers, RSI thresholds, and atomic swap conditions.
                  </p>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#1f1f23] bg-[#141418] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#a1a1aa]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5dcea0]" />
                    Compiled Recipe
                  </div>
                </div>
              </div>

              {/* Branch Connector 1 -> 2 */}
              <div className="hidden md:flex flex-col items-center justify-center w-8 shrink-0">
                <svg viewBox="0 0 32 16" className="w-8 h-4 overflow-visible">
                  <path
                    d="M 0 8 L 26 8"
                    fill="none"
                    stroke={step3Stage >= 1 ? "#e0b35a" : step3Stage === 0 ? "#5dcea0" : "#262626"}
                    strokeWidth="2"
                    strokeDasharray={step3Stage === 0 ? "3 3" : "none"}
                    className="transition-colors duration-500"
                  />
                  <polygon
                    points="24,4 32,8 24,12"
                    fill={step3Stage >= 1 ? "#e0b35a" : step3Stage === 0 ? "#5dcea0" : "#262626"}
                    className="transition-colors duration-500"
                  />
                </svg>
              </div>

              {/* STAGE 2: Paper Mode */}
              <div
                onClick={() => setStep3Stage(1)}
                className={`relative flex-1 w-full rounded-2xl border p-6 transition-all duration-500 cursor-pointer select-none flex flex-col justify-between ${
                  step3Stage === 1
                    ? "border-[#e0b35a] bg-[#161410] shadow-[0_0_25px_rgba(224,179,90,0.18)] scale-[1.02]"
                    : "border-[#262626] bg-[#090a0d] hover:border-[#3f3f46] hover:bg-[#0e0f14]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xl font-bold text-[#f4f4f5] tracking-tight">
                      Paper Mode
                    </h4>
                    <span
                      className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                        step3Stage === 1
                          ? "bg-[#e0b35a] shadow-[0_0_8px_#e0b35a]"
                          : "bg-[#262626]"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-[#8a8a93] leading-relaxed mb-5">
                    Simulate fills in real-time, quote DEX prices, and verify edge with zero risk.
                  </p>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#1f1f23] bg-[#141418] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#e0b35a]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#e0b35a]" />
                    Virtual Fills · Zero Risk
                  </div>
                </div>
              </div>

              {/* Branch Connector 2 -> 3 */}
              <div className="hidden md:flex flex-col items-center justify-center w-8 shrink-0">
                <svg viewBox="0 0 32 16" className="w-8 h-4 overflow-visible">
                  <path
                    d="M 0 8 L 26 8"
                    fill="none"
                    stroke={step3Stage === 2 ? "#5dcea0" : step3Stage === 1 ? "#e0b35a" : "#262626"}
                    strokeWidth="2"
                    strokeDasharray={step3Stage <= 1 ? "3 3" : "none"}
                    className="transition-colors duration-500"
                  />
                  <polygon
                    points="24,4 32,8 24,12"
                    fill={step3Stage === 2 ? "#5dcea0" : step3Stage === 1 ? "#e0b35a" : "#262626"}
                    className="transition-colors duration-500"
                  />
                </svg>
              </div>

              {/* STAGE 3: Live Mode */}
              <div
                onClick={() => setStep3Stage(2)}
                className={`relative flex-1 w-full rounded-2xl border p-6 transition-all duration-500 cursor-pointer select-none flex flex-col justify-between ${
                  step3Stage === 2
                    ? "border-[#5dcea0] bg-[#0d1411] shadow-[0_0_25px_rgba(93,206,160,0.18)] scale-[1.02]"
                    : "border-[#262626] bg-[#090a0d] hover:border-[#3f3f46] hover:bg-[#0e0f14]"
                }`}
              >
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xl font-bold text-[#f4f4f5] tracking-tight">
                      Live Execution
                    </h4>
                    <span
                      className={`h-2 w-2 rounded-full transition-colors duration-500 ${
                        step3Stage === 2
                          ? "bg-[#5dcea0] shadow-[0_0_8px_#5dcea0]"
                          : "bg-[#262626]"
                      }`}
                    />
                  </div>
                  <p className="text-xs text-[#8a8a93] leading-relaxed mb-5">
                    Graduate the loop onchain with strict gas ceilings, slippage guardrails, and $10 spend caps.
                  </p>
                </div>
                <div>
                  <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#1f1f23] bg-[#141418] px-2.5 py-1 font-mono text-[11px] font-semibold text-[#5dcea0]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[#5dcea0]" />
                    Safety Capped Execution
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================================
          STEP 4: Continuous Autonomous Self-Improvement
          ========================================================================= */}
      <section className="relative min-h-screen flex flex-col justify-center items-center border-t border-[#1f1f1f] bg-[#000000] px-6 py-24 md:py-32 text-[#f4f4f5]">
        {/* Ambient background glow */}
        <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[1000px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(93,206,160,0.08)_0%,transparent_70%)] blur-3xl" />

        <div className="relative z-10 mx-auto w-full max-w-5xl flex flex-col items-center gap-10">
          {/* Header on Top */}
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 font-mono text-xs font-semibold uppercase tracking-widest text-[#5dcea0]">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#5dcea0]/20 text-[10px]">
                04
              </span>
              <span>Step 4</span>
            </div>

            <h3 className="font-[family-name:var(--font-hero)] text-4xl font-bold tracking-tight text-[#f4f4f5] sm:text-5xl md:text-6xl leading-tight">
              Autonomous self-improvement
            </h3>
          </div>

          {/* Dotted Triangle Cycling Illustration */}
          <div className="w-full max-w-xl">
            <div className="relative rounded-3xl border border-[#262626] bg-[#090a0d] p-8 sm:p-12 shadow-2xl flex flex-col items-center justify-center overflow-hidden">
              {/* Center Ambient Radial Glow */}
              <div className="pointer-events-none absolute h-72 w-72 rounded-full bg-[radial-gradient(circle,rgba(93,206,160,0.1)_0%,transparent_70%)] blur-2xl" />

              {/* Triangle Canvas Container */}
              <div className="relative h-[310px] w-[340px] sm:h-[340px] sm:w-[380px] flex items-center justify-center select-none">
                {/* SVG Dotted Triangle & Traveling Laser Lines */}
                <svg viewBox="0 0 360 320" className="absolute inset-0 h-full w-full overflow-visible">
                  <defs>
                    <linearGradient id="laser0to1" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#5dcea0" />
                      <stop offset="100%" stopColor="#e0b35a" />
                    </linearGradient>
                    <linearGradient id="laser1to2" x1="100%" y1="0%" x2="0%" y2="0%">
                      <stop offset="0%" stopColor="#e0b35a" />
                      <stop offset="100%" stopColor="#60a5fa" />
                    </linearGradient>
                    <linearGradient id="laser2to0" x1="0%" y1="100%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#60a5fa" />
                      <stop offset="100%" stopColor="#5dcea0" />
                    </linearGradient>
                  </defs>

                  {/* 1. Base Inactive Dotted Triangle Sides */}
                  {/* Side 0 -> 1 (Top to Bottom-Right) */}
                  <line
                    x1="180"
                    y1="46"
                    x2="310"
                    y2="260"
                    stroke="#22232b"
                    strokeWidth="1.8"
                    strokeDasharray="5 5"
                  />
                  {/* Side 1 -> 2 (Bottom-Right to Bottom-Left) */}
                  <line
                    x1="310"
                    y1="260"
                    x2="50"
                    y2="260"
                    stroke="#22232b"
                    strokeWidth="1.8"
                    strokeDasharray="5 5"
                  />
                  {/* Side 2 -> 0 (Bottom-Left to Top) */}
                  <line
                    x1="50"
                    y1="260"
                    x2="180"
                    y2="46"
                    stroke="#22232b"
                    strokeWidth="1.8"
                    strokeDasharray="5 5"
                  />

                  {/* 2. Directional Flow Arrows at Midpoints */}
                  {/* Midpoint 0 -> 1: (245, 153) rotated ~58 deg */}
                  <polygon
                    points="241,148 249,153 241,158"
                    transform="rotate(58 245 153)"
                    fill={step4Corner === 0 ? "#5dcea0" : "#2a2b36"}
                    className="transition-colors duration-300"
                  />
                  {/* Midpoint 1 -> 2: (180, 260) pointing left (180 deg) */}
                  <polygon
                    points="184,256 176,260 184,264"
                    fill={step4Corner === 1 ? "#e0b35a" : "#2a2b36"}
                    className="transition-colors duration-300"
                  />
                  {/* Midpoint 2 -> 0: (115, 153) rotated ~302 deg */}
                  <polygon
                    points="111,148 119,153 111,158"
                    transform="rotate(-58 115 153)"
                    fill={step4Corner === 2 ? "#60a5fa" : "#2a2b36"}
                    className="transition-colors duration-300"
                  />

                  {/* 3. Traveling Energy Comet Particles Along Active Edge */}
                  {step4Corner === 0 && (
                    <g key="travel-0-1">
                      <circle r="4" fill="#5dcea0" className="drop-shadow-[0_0_10px_#5dcea0]">
                        <animateMotion
                          path="M 180 46 L 310 260"
                          dur="1.8s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </g>
                  )}
                  {step4Corner === 1 && (
                    <g key="travel-1-2">
                      <circle r="4" fill="#e0b35a" className="drop-shadow-[0_0_10px_#e0b35a]">
                        <animateMotion
                          path="M 310 260 L 50 260"
                          dur="1.8s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </g>
                  )}
                  {step4Corner === 2 && (
                    <g key="travel-2-0">
                      <circle r="4" fill="#60a5fa" className="drop-shadow-[0_0_10px_#60a5fa]">
                        <animateMotion
                          path="M 50 260 L 180 46"
                          dur="1.8s"
                          repeatCount="indefinite"
                        />
                      </circle>
                    </g>
                  )}

                  {/* Corner Anchor Vertex Dots */}
                  <circle
                    cx="180"
                    cy="46"
                    r={step4Corner === 0 ? "5" : "3"}
                    fill={step4Corner === 0 ? "#5dcea0" : "#262626"}
                    className="transition-all duration-300 drop-shadow-[0_0_6px_#5dcea0]"
                  />
                  <circle
                    cx="310"
                    cy="260"
                    r={step4Corner === 1 ? "5" : "3"}
                    fill={step4Corner === 1 ? "#e0b35a" : "#262626"}
                    className="transition-all duration-300 drop-shadow-[0_0_6px_#e0b35a]"
                  />
                  <circle
                    cx="50"
                    cy="260"
                    r={step4Corner === 2 ? "5" : "3"}
                    fill={step4Corner === 2 ? "#60a5fa" : "#262626"}
                    className="transition-all duration-300 drop-shadow-[0_0_6px_#60a5fa]"
                  />
                </svg>


                {/* Center Centroid: Active Agent Avatar */}
                <div className="absolute left-1/2 top-[58%] -translate-x-1/2 -translate-y-1/2 z-10">
                  <AgentOrb
                    id={currentPreset.avatarId}
                    colorId={currentPreset.colorId}
                    size={68}
                    animate={true}
                  />
                </div>

                {/* Corner 0: Execute & Monitor (Top) */}
                <div
                  onClick={() => setStep4Corner(0)}
                  className={`absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/3 flex items-center gap-2 rounded-xl border px-3.5 py-1.5 shadow-xl transition-all duration-500 cursor-pointer ${
                    step4Corner === 0
                      ? "border-[#5dcea0] bg-[#0d1411] shadow-[0_0_20px_rgba(93,206,160,0.25)] scale-105"
                      : "border-[#22232b] bg-[#0e0f14] hover:border-[#3f3f46]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full transition-colors ${
                      step4Corner === 0
                        ? "bg-[#5dcea0] shadow-[0_0_8px_#5dcea0]"
                        : "bg-[#262626]"
                    }`}
                  />
                  <span
                    className={`font-mono text-xs font-semibold transition-colors ${
                      step4Corner === 0 ? "text-[#f4f4f5]" : "text-[#8a8a93]"
                    }`}
                  >
                    Execute &amp; Monitor
                  </span>
                </div>

                {/* Corner 1: Analyze Edge (Bottom-Right) */}
                <div
                  onClick={() => setStep4Corner(1)}
                  className={`absolute bottom-0 right-0 translate-x-3 translate-y-1/3 flex items-center gap-2 rounded-xl border px-3.5 py-1.5 shadow-xl transition-all duration-500 cursor-pointer ${
                    step4Corner === 1
                      ? "border-[#e0b35a] bg-[#161410] shadow-[0_0_20px_rgba(224,179,90,0.25)] scale-105"
                      : "border-[#22232b] bg-[#0e0f14] hover:border-[#3f3f46]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full transition-colors ${
                      step4Corner === 1
                        ? "bg-[#e0b35a] shadow-[0_0_8px_#e0b35a]"
                        : "bg-[#262626]"
                    }`}
                  />
                  <span
                    className={`font-mono text-xs font-semibold transition-colors ${
                      step4Corner === 1 ? "text-[#f4f4f5]" : "text-[#8a8a93]"
                    }`}
                  >
                    Analyze Edge
                  </span>
                </div>

                {/* Corner 2: Auto-Tune Params (Bottom-Left) */}
                <div
                  onClick={() => setStep4Corner(2)}
                  className={`absolute bottom-0 left-0 -translate-x-3 translate-y-1/3 flex items-center gap-2 rounded-xl border px-3.5 py-1.5 shadow-xl transition-all duration-500 cursor-pointer ${
                    step4Corner === 2
                      ? "border-[#60a5fa] bg-[#0e131d] shadow-[0_0_20px_rgba(96,165,250,0.25)] scale-105"
                      : "border-[#22232b] bg-[#0e0f14] hover:border-[#3f3f46]"
                  }`}
                >
                  <span
                    className={`h-2 w-2 rounded-full transition-colors ${
                      step4Corner === 2
                        ? "bg-[#60a5fa] shadow-[0_0_8px_#60a5fa]"
                        : "bg-[#262626]"
                    }`}
                  />
                  <span
                    className={`font-mono text-xs font-semibold transition-colors ${
                      step4Corner === 2 ? "text-[#f4f4f5]" : "text-[#8a8a93]"
                    }`}
                  >
                    Auto-Tune Params
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

    </>
  );
}



