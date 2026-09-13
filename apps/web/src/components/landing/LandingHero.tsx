"use client";

import { useRef } from "react";
import { BrandMark } from "@/components/BrandMark";
import { LoginCrew } from "@/components/LoginCrew";
import { DeskSimulation } from "./DeskSimulation";

export interface LandingHeroProps {
  onLogin: () => void;
  onExploreClick?: () => void;
}

export function LandingHero({ onLogin, onExploreClick }: LandingHeroProps) {
  const containerRef = useRef<HTMLElement>(null);

  const handlePointerMove = (e: React.PointerEvent<HTMLElement>) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    containerRef.current.style.setProperty("--mouse-x", `${x}px`);
    containerRef.current.style.setProperty("--mouse-y", `${y}px`);
  };

  return (
    <section
      ref={containerRef}
      onPointerMove={handlePointerMove}
      className="relative min-h-screen overflow-hidden bg-[#030407] text-[var(--ink)]"
      style={
        {
          "--mouse-x": "50%",
          "--mouse-y": "30%",
        } as React.CSSProperties
      }
    >
      {/* Vivid Organic Aurora & Interactive Cursor Glow */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        {/* Deep Horizon Vibrant Plasma Wash */}
        <div className="absolute left-1/2 -top-48 h-[750px] w-[1250px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(93,206,160,0.22)_0%,rgba(139,92,246,0.25)_35%,rgba(59,130,246,0.15)_65%,transparent_80%)] blur-[90px]" />

        {/* Ambient Floating Blob 1: Left Mint Bloom */}
        <div
          className="absolute -left-32 top-[5%] h-[600px] w-[600px] rounded-full bg-[radial-gradient(circle,rgba(93,206,160,0.3)_0%,rgba(16,185,129,0.08)_50%,transparent_75%)] blur-[90px] animate-pulse"
          style={{ animationDuration: "7s" }}
        />

        {/* Ambient Floating Blob 2: Right Violet Bloom */}
        <div
          className="absolute -right-32 top-[10%] h-[650px] w-[650px] rounded-full bg-[radial-gradient(circle,rgba(168,85,247,0.32)_0%,rgba(99,102,241,0.1)_50%,transparent_75%)] blur-[100px] animate-pulse"
          style={{ animationDuration: "9s" }}
        />

        {/* High-Energy Cursor-Tracking Fluid Spotlight */}
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            background: `radial-gradient(650px circle at var(--mouse-x, 50%) var(--mouse-y, 30%), rgba(93, 206, 160, 0.35) 0%, rgba(139, 92, 246, 0.25) 30%, rgba(59, 130, 246, 0.12) 55%, transparent 75%)`,
            filter: "blur(50px)",
          }}
        />

        {/* Dynamic Core Glow */}
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(280px circle at var(--mouse-x, 50%) var(--mouse-y, 30%), rgba(255, 255, 255, 0.15) 0%, rgba(93, 206, 160, 0.2) 40%, transparent 80%)`,
            filter: "blur(25px)",
          }}
        />

        {/* Subtle Bottom Ground Vignette */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_30%,#030407_90%)]" />
      </div>

      {/* Top Navbar matching Squadrons desk theme */}
      <header className="relative z-20 border-b border-[#1f2430]/70 bg-[#06080e]/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
          <BrandMark
            className="pt-0 cursor-pointer"
            textClassName="text-[1.3rem] font-medium tracking-tight"
            orbSize={26}
          />

          {/* Monospace uppercase nav — mirrors landing sections */}
          <nav className="hidden items-center gap-8 font-mono text-[11px] uppercase tracking-widest text-[#8a8f9d] md:flex">
            <a
              href="#harness"
              className="transition hover:text-[#f4f4f5] border-b border-transparent hover:border-[#5dcea0] pb-0.5"
            >
              Harness
            </a>
            <a
              href="#workflow"
              className="transition hover:text-[#f4f4f5] border-b border-transparent hover:border-[#5dcea0] pb-0.5"
            >
              Workflow
            </a>
            <a
              href="#recipes"
              className="transition hover:text-[#f4f4f5] border-b border-transparent hover:border-[#5dcea0] pb-0.5"
            >
              Recipes
            </a>
          </nav>

          <button
            type="button"
            onClick={onLogin}
            className="type-ui inline-flex cursor-pointer items-center rounded-full bg-[var(--ink)] px-4 py-1.5 text-xs font-semibold text-[var(--canvas)] shadow-sm transition hover:opacity-90 active:scale-95"
          >
            Open Desk
          </button>
        </div>
      </header>

      {/* Hero Content Section */}
      <div className="relative z-10 mx-auto max-w-5xl px-6 pt-16 pb-12 text-center">
        {/* Centered Avatar Crew Showcase */}
        <div className="mb-6 flex justify-center">
          <LoginCrew />
        </div>

        {/* Main Headline */}
        <h1 className="font-[family-name:var(--font-hero)] text-5xl font-bold tracking-[-0.035em] text-[var(--ink)] sm:text-7xl md:text-8xl lg:text-[5.75rem] leading-[1.04]">
          The Agent Harness for <span className="text-[#5dcea0] drop-shadow-[0_0_24px_rgba(93,206,160,0.35)]">DeFi</span>
        </h1>

        {/* Scaled & Legible Subheading */}
        <p className="mx-auto mt-6 max-w-2xl text-lg sm:text-xl md:text-2xl text-[#d4d4d8] leading-relaxed font-normal antialiased">
          Equip crypto agents with live onchain search, social sentiment, and safety-capped execution loops.
        </p>

        {/* Action Button */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <button
            type="button"
            onClick={onLogin}
            className="type-ui inline-flex cursor-pointer items-center gap-2 rounded-full bg-[var(--ink)] px-8 py-3.5 text-base font-bold text-[var(--canvas)] shadow-[0_0_35px_rgba(255,255,255,0.25)] transition hover:bg-white hover:scale-105 active:scale-95"
          >
            Open Your Desk →
          </button>
          {onExploreClick && (
            <button
              type="button"
              onClick={onExploreClick}
              className="type-ui inline-flex cursor-pointer items-center rounded-full border border-[#2d3446] bg-[#101420]/80 px-6 py-3.5 text-sm font-semibold text-[var(--ink)] transition hover:border-[#8a8f9d] hover:bg-[#161c2c]"
            >
              See Architecture
            </button>
          )}
        </div>

        {/* Clean Inline Highlights */}
        <div className="mt-7 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-mono text-xs text-[#a1a1aa]">
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#5dcea0] shadow-[0_0_8px_#5dcea0]" />
            <span className="font-medium text-[#f4f4f5]">Crypto-native tooling</span>
          </div>
          <span className="hidden text-[#3f3f46] sm:inline">·</span>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#60a5fa] shadow-[0_0_8px_#60a5fa]" />
            <span className="font-medium text-[#f4f4f5]">Self-improving agents</span>
          </div>
          <span className="hidden text-[#3f3f46] sm:inline">·</span>
          <div className="flex items-center gap-2">
            <span className="h-1.5 w-1.5 rounded-full bg-[#e0b35a] shadow-[0_0_8px_#e0b35a]" />
            <span className="font-medium text-[#f4f4f5]">Armed strategy loops</span>
          </div>
        </div>
      </div>

      {/* The Desk Screen Simulation */}
      <div className="relative z-10 mx-auto mt-4 w-full max-w-[1140px] px-4 pb-24">
        <DeskSimulation />
      </div>
    </section>
  );
}
