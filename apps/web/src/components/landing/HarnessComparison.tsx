"use client";

import { useState } from "react";
import Image from "next/image";
import { AgentOrb } from "@/components/AgentOrb";

interface PrimitiveData {
  id: string;
  legacyTitle: string;
  legacyTag: string;
  legacyDesc: string;
  cryptoTitle: string;
  cryptoTag: string;
  cryptoDesc: string;
}

const PRIMITIVES: PrimitiveData[] = [
  {
    id: "search",
    legacyTitle: "Web Search",
    legacyTag: "Google / Bing",
    legacyDesc: "Scrapes SEO blogs & outdated articles; hallucinates token contracts.",
    cryptoTitle: "Onchain Search",
    cryptoTag: "@search",
    cryptoDesc: "Direct node & subgraph queries for real-time pool reserves and TVL.",
  },
  {
    id: "docs",
    legacyTitle: "Docs Search",
    legacyTag: "StackOverflow / MD",
    legacyDesc: "Queries static API references and generic programming docs.",
    cryptoTitle: "X & CT Pulse",
    cryptoTag: "@pulse",
    cryptoDesc: "Live sentiment, ticker mindshare, and real-time whale chatter.",
  },
  {
    id: "validation",
    legacyTitle: "Linter & Compiler",
    legacyTag: "Syntax / Typecheck",
    legacyDesc: "Checks code syntax and type errors; blind to market liquidity.",
    cryptoTitle: "DEX Radar & Sim",
    cryptoTag: "@backtest",
    cryptoDesc: "Slippage calculations, price impact matrices, and 90-day backtests.",
  },
  {
    id: "execution",
    legacyTitle: "Terminal Sandbox",
    legacyTag: "Bash / File Edits",
    legacyDesc: "Runs local CLI commands and edits source files on disk.",
    cryptoTitle: "Armed Loops",
    cryptoTag: "@arm",
    cryptoDesc: "Compiles reasoning into scheduled host loops with zero tick drift.",
  },
  {
    id: "security",
    legacyTitle: "Git Pull Requests",
    legacyTag: "Code Reviews / Diff",
    legacyDesc: "Branch merges and code reviews; no concept of onchain capital risk.",
    cryptoTitle: "Safety Ladder",
    cryptoTag: "@safety",
    cryptoDesc: "Observe → Paper → Live progression with strict $10 fail-closed spend caps.",
  },
];

export function HarnessComparison() {
  const [transformed, setTransformed] = useState<Record<string, boolean>>({
    search: true,
    docs: true,
    validation: true,
    execution: true,
    security: true,
  });

  const toggleCard = (id: string) => {
    setTransformed((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const transformAll = (state: boolean) => {
    setTransformed({
      search: state,
      docs: state,
      validation: state,
      execution: state,
      security: state,
    });
  };

  const allActive = Object.values(transformed).every(Boolean);

  return (
    <section
      id="harness"
      className="relative flex min-h-screen flex-col justify-center border-t border-[#1f1f1f] bg-[#000000] px-6 py-24 md:py-32 text-[#f4f4f5]"
    >
      {/* Background ambient lighting */}
      <div className="pointer-events-none absolute left-1/2 top-1/3 h-[600px] w-[1100px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(93,206,160,0.1)_0%,rgba(168,85,247,0.06)_40%,transparent_70%)] blur-3xl" />

      <div className="relative z-10 mx-auto w-full max-w-7xl">
        {/* Section Header with Accent Colored Title */}
        <div className="mb-16 flex flex-col items-center justify-between gap-8 md:flex-row md:items-end">
          <div className="text-center md:text-left">
            <h2 className="font-[family-name:var(--font-hero)] text-4xl font-bold tracking-[-0.035em] text-[#f4f4f5] sm:text-6xl md:text-7xl leading-[1.08]">
              Why a <span className="text-[#5dcea0] drop-shadow-[0_0_24px_rgba(93,206,160,0.35)]">DeFi Harness</span>?
            </h2>
          </div>

          {/* Master Switcher with Cursor, Claude Code, and Squadrons Logos */}
          <div className="flex items-center gap-2 rounded-full border border-[#262626] bg-[#0a0a0d] p-2 shadow-2xl">
            {/* Toggle: Current Harnesses */}
            <button
              type="button"
              onClick={() => transformAll(false)}
              className={`flex items-center gap-3 rounded-full px-5 py-2.5 transition-all cursor-pointer ${
                !allActive
                  ? "bg-[#181a20] text-[#f4f4f5] font-semibold shadow-sm ring-1 ring-white/10"
                  : "text-[#71717a] hover:text-[#a1a1aa]"
              }`}
            >
              {/* Cursor + Claude Code Logos */}
              <div className="flex items-center -space-x-1.5">
                <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-black ring-1 ring-white/20 p-0.5 overflow-hidden">
                  <Image
                    src="/cursor.png"
                    alt="Cursor"
                    width={18}
                    height={18}
                    className="object-contain"
                  />
                </div>
                <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-black ring-1 ring-white/20 p-0.5 overflow-hidden">
                  <Image
                    src="/claude-code.png"
                    alt="Claude Code"
                    width={18}
                    height={18}
                    className="object-contain"
                  />
                </div>
              </div>
              <span className="font-mono text-xs">Current Harnesses</span>
            </button>

            {/* Toggle: Squadrons */}
            <button
              type="button"
              onClick={() => transformAll(true)}
              className={`flex items-center gap-2.5 rounded-full px-5 py-2 transition-all cursor-pointer ${
                allActive
                  ? "bg-[#181a20] ring-1 ring-[#5dcea0]/50 shadow-[0_0_25px_rgba(93,206,160,0.3)]"
                  : "text-[#71717a] hover:text-[#a1a1aa]"
              }`}
            >
              <AgentOrb id="03" colorId="yellow" size={22} animate={allActive} />
              <span className="type-brand text-lg tracking-wide text-[#f4f4f5] pt-0.5">
                Squadrons
              </span>
            </button>
          </div>
        </div>

        {/* The 5 Boxes Grid with Generous Height and Padding */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-5">
          {PRIMITIVES.map((item) => {
            const isDeFi = !!transformed[item.id];

            return (
              <div
                key={item.id}
                onClick={() => toggleCard(item.id)}
                className={`group relative flex min-h-[290px] cursor-pointer flex-col justify-between rounded-3xl border p-6 transition-all duration-300 select-none ${
                  isDeFi
                    ? "border-[#5dcea0]/40 bg-[#0d1311] shadow-[0_10px_35px_rgba(93,206,160,0.12)] hover:border-[#5dcea0] hover:scale-[1.02]"
                    : "border-[#262626] bg-[#0c0d10] hover:border-[#3f3f46] hover:bg-[#111318]"
                }`}
              >
                {/* Top Badge & Status Pip */}
                <div className="flex items-center justify-between">
                  <span
                    className={`font-mono text-[11px] font-semibold uppercase tracking-wider px-2.5 py-1 rounded-md ${
                      isDeFi
                        ? "bg-[#5dcea0]/15 text-[#5dcea0]"
                        : "bg-[#1f1f24] text-[#71717a]"
                    }`}
                  >
                    {isDeFi ? item.cryptoTag : item.legacyTag}
                  </span>

                  <span
                    className={`h-2.5 w-2.5 rounded-full transition-all ${
                      isDeFi
                        ? "bg-[#5dcea0] shadow-[0_0_10px_#5dcea0]"
                        : "bg-[#71717a]"
                    }`}
                  />
                </div>

                {/* Main Content Area */}
                <div className="my-auto py-3">
                  {isDeFi ? (
                    <div className="space-y-2.5">
                      <div className="flex items-center gap-2 font-mono text-xs text-[#71717a]">
                        <span className="text-[#e07a7a] font-bold">✕</span>
                        <span className="line-through decoration-[#e07a7a]/70">
                          {item.legacyTitle}
                        </span>
                      </div>

                      <h3 className="font-sans text-xl font-bold tracking-tight text-[#f4f4f5]">
                        {item.cryptoTitle}
                      </h3>

                      <p className="text-xs sm:text-[13px] text-[#a1a1aa] leading-relaxed">
                        {item.cryptoDesc}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      <h3 className="font-mono text-lg font-bold tracking-tight text-[#a1a1aa]">
                        {item.legacyTitle}
                      </h3>

                      <p className="text-xs sm:text-[13px] text-[#71717a] leading-relaxed">
                        {item.legacyDesc}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
