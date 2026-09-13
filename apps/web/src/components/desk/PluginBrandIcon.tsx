"use client";

import { getMcpCatalogEntry } from "@squadrons/shared";

const FALLBACK_ACCENT = "#3f3f46";

/** Rounded brand mark for catalog / custom MCP plugins. */
export function PluginBrandIcon({
  catalogId,
  icon,
  accent,
  name,
  size = 40,
}: {
  catalogId?: string | null;
  icon?: string;
  accent?: string;
  name?: string;
  size?: number;
}) {
  const entry = catalogId ? getMcpCatalogEntry(catalogId) : undefined;
  const iconId = icon ?? entry?.icon ?? "custom";
  const bg = accent ?? entry?.accent ?? FALLBACK_ACCENT;
  const label = (name ?? entry?.name ?? "?").slice(0, 1).toUpperCase();

  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden rounded-[22%] text-white shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]"
      style={{ width: size, height: size, background: bg }}
      aria-hidden
    >
      <BrandGlyph iconId={iconId} label={label} size={size} />
    </span>
  );
}

function BrandGlyph({
  iconId,
  label,
  size,
}: {
  iconId: string;
  label: string;
  size: number;
}) {
  const s = Math.round(size * 0.55);
  if (iconId === "dune") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 6.5C4 5.12 5.12 4 6.5 4H12c4.42 0 8 3.58 8 8s-3.58 8-8 8H6.5C5.12 20 4 18.88 4 17.5V6.5Z"
          fill="#111"
          fillOpacity="0.85"
        />
        <path
          d="M8 8h4.2c2.98 0 5.4 2.42 5.4 5.4S15.18 18.8 12.2 18.8H8V8Z"
          fill="#F0B90B"
        />
      </svg>
    );
  }
  if (iconId === "nansen") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M5 19V5h3.2l7.2 10.4V5H19v14h-3.2L8.6 8.6V19H5Z"
          fill="white"
        />
      </svg>
    );
  }
  if (iconId === "backtest") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 16.5 9 11l3.5 3.5L20 7"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 20h16"
          stroke="white"
          strokeOpacity="0.45"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (iconId === "graph") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle cx="6" cy="12" r="2.25" fill="white" />
        <circle cx="12" cy="6" r="2.25" fill="white" />
        <circle cx="12" cy="18" r="2.25" fill="white" />
        <circle cx="18" cy="12" r="2.25" fill="white" />
        <path
          d="M8 11.2 10.2 7.8M8 12.8l2.2 3.4M14 7.8 16 11.2M14 16.2 16 12.8"
          stroke="white"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (iconId === "pipeline") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M4 7h6v3H4V7Zm10 0h6v3h-6V7ZM7 10v4h10v-4"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M4 14h6v3H4v-3Zm10 0h6v3h-6v-3Z"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (iconId === "custom") {
    return (
      <svg
        width={s}
        height={s}
        viewBox="0 0 24 24"
        fill="none"
        stroke="white"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 6v4m0 4v4M8 10h8" />
        <rect x="5" y="5" width="14" height="14" rx="3" />
      </svg>
    );
  }
  return (
    <span
      className="font-semibold leading-none"
      style={{ fontSize: Math.round(size * 0.42) }}
    >
      {label}
    </span>
  );
}
