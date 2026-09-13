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
          d="M4 18 9.2 11.8l3.3 3.4L20 7v11H4Z"
          fill="white"
          fillOpacity="0.22"
        />
        <path
          d="M4 18 9.2 11.8l3.3 3.4L20 7"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="20" cy="7" r="2" fill="white" />
        <path
          d="M4 20.25h16"
          stroke="white"
          strokeOpacity="0.35"
          strokeWidth="1.5"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (iconId === "graph") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <circle
          cx="10.25"
          cy="10.25"
          r="6.5"
          stroke="white"
          strokeWidth="2"
        />
        <path
          d="M15.1 15.1 20 20"
          stroke="white"
          strokeWidth="2.25"
          strokeLinecap="round"
        />
        <circle cx="8.1" cy="11.4" r="1.55" fill="white" />
        <circle cx="11.9" cy="7.7" r="1.55" fill="white" />
        <circle cx="13.15" cy="12.55" r="1.55" fill="white" />
        <path
          d="M9.2 10.5 11.1 8.6M12.7 9.1l.35 2"
          stroke="white"
          strokeWidth="1.35"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (iconId === "social") {
    return (
      <svg width={s} height={s} viewBox="0 0 24 24" fill="none">
        <path
          d="M5 8.5c0-1.66 1.34-3 3-3h5.5c1.66 0 3 1.34 3 3v3.2c0 1.66-1.34 3-3 3H10l-3.2 2.4V14.7H8c-1.66 0-3-1.34-3-3V8.5Z"
          fill="white"
        />
        <path
          d="M14.5 11.8h1c1.66 0 3 1.34 3 3v.9l2.2 1.65V15.8c0-1.66-1.34-3-3-3h-.7"
          stroke="white"
          strokeWidth="1.75"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
          opacity="0.55"
        />
        <circle cx="9.1" cy="9.85" r="1" fill="#1D9BF0" />
        <circle cx="12" cy="9.85" r="1" fill="#1D9BF0" />
        <circle cx="14.9" cy="9.85" r="1" fill="#1D9BF0" />
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
