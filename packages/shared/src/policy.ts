/** v1 demo policy defaults (PRD §7). */
export const DEFAULT_POLICY = {
  maxTradeUsd: 10,
  maxSlippageBps: 50,
  defaultChainId: 8453,
} as const;

/** Supported home chains for agent create. */
export const SUPPORTED_CHAINS = [
  {
    chainId: 8453,
    name: "Base",
    shortName: "Base",
    /** Vendored CoinGecko asset-platform icon — see apps/web/public/chains/README.md */
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
    /** Arc Testnet — Circle L1; mainnet IDs land when published. */
    chainId: 5042002,
    name: "Arc Testnet",
    shortName: "Arc",
    logoUrl: "/chains/arc.png",
  },
] as const;

export type SupportedChainId = (typeof SUPPORTED_CHAINS)[number]["chainId"];

export type SupportedChain = (typeof SUPPORTED_CHAINS)[number];

export function isSupportedChainId(value: number): value is SupportedChainId {
  return SUPPORTED_CHAINS.some((chain) => chain.chainId === value);
}

export function getSupportedChain(
  chainId: number,
): SupportedChain | undefined {
  return SUPPORTED_CHAINS.find((chain) => chain.chainId === chainId);
}

export function chainLabel(chainId: number): string {
  return getSupportedChain(chainId)?.shortName ?? `Chain ${chainId}`;
}

/** Observe-mode on-chain / market read tools available per home chain. */
export const CHAIN_SCOPED_READ_TOOLS = [
  "get_wallet_balances",
  "get_spot_prices",
] as const;

/**
 * DEX quote tool (0x or Circle Swap Kit by chain).
 * Enabled when chainId ∈ DEX_QUOTE_CHAIN_IDS
 * (keep in sync with packages/squadrons-defi/chains.js + host swap-build).
 * How to add a chain: packages/squadrons-defi/README.md
 * Live broadcast uses the same allowlist (executor → supportsDexQuote).
 */
export const DEX_QUOTE_TOOLS = ["get_dex_quote"] as const;

/** @deprecated Use DEX_QUOTE_TOOLS */
export const BASE_DEX_QUOTE_TOOLS = DEX_QUOTE_TOOLS;

export type ChainScopedReadTool = (typeof CHAIN_SCOPED_READ_TOOLS)[number];
export type DexQuoteTool = (typeof DEX_QUOTE_TOOLS)[number];

/**
 * Chains with a swap quote provider.
 * Keep in sync with packages/squadrons-defi DEX_QUOTE_CHAIN_IDS.
 * Arc (5042002) uses Circle Swap Kit — not 0x.
 */
const DEX_QUOTE_CHAIN_IDS: readonly SupportedChainId[] = [
  8453, 1, 42161, 10, 130, 480, 5042002,
];

export function supportsDexQuote(chainId: number): boolean {
  return DEX_QUOTE_CHAIN_IDS.includes(chainId as SupportedChainId);
}

/** True when the home chain routes swaps via Circle Swap Kit (Arc). */
export function usesCircleSwapKit(chainId: number): boolean {
  return chainId === 5042002;
}

export function chainScopedReadTools(
  chainId: SupportedChainId,
): readonly (ChainScopedReadTool | DexQuoteTool)[] {
  if (supportsDexQuote(chainId)) {
    return [...CHAIN_SCOPED_READ_TOOLS, ...DEX_QUOTE_TOOLS];
  }
  return CHAIN_SCOPED_READ_TOOLS;
}

/**
 * Always-on scout tools (not chain-scoped).
 * search_x is a free keyless web facade (DDG → Bing → optional SearXNG) with site:x.com.
 */
export const SCOUT_TOOLS = ["search_x"] as const;

export type ScoutTool = (typeof SCOUT_TOOLS)[number];

/**
 * Market intel tools (DefiLlama + GeckoTerminal). Home-chain biased via env.
 * Tape/analytics only — not executable quotes.
 */
export const INTEL_TOOLS = [
  "get_trending_pools",
  "get_token_pools",
  "get_recent_trades",
  "get_stablecoin_market",
  "get_dex_volumes",
] as const;

export type IntelTool = (typeof INTEL_TOOLS)[number];

/** Tools the prompt should mention for strategy authorship. */
export const STRATEGY_TOOLS = [
  "propose_strategy",
  "update_strategy_params",
  "get_strategy",
] as const;
