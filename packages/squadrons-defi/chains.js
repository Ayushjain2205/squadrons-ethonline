import { defineChain } from "viem";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  unichain,
  worldchain,
} from "viem/chains";

/** @typedef {{ address: `0x${string}`, decimals: number, symbol: string }} Erc20Token */

/**
 * @typedef {{
 *   chainId: number,
 *   name: string,
 *   shortName: string,
 *   viemChain: import('viem').Chain,
 *   rpcEnvKeys: string[],
 *   defaultRpcUrl: string,
 *   nativeSymbol: string,
 *   tokens: Record<string, Erc20Token>,
 * }} ChainToolConfig
 */

const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
  blockExplorers: {
    default: {
      name: "Blockscout",
      url: "https://robinhoodchain.blockscout.com",
    },
  },
});

/** Arc Testnet — USDC is native gas (18 decimals); ERC-20 USDC interface is 6 decimals. */
const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://rpc.testnet.arc.io"],
      webSocket: ["wss://rpc.testnet.arc.io"],
    },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
});

/** @type {Record<number, ChainToolConfig>} */
export const CHAIN_TOOL_CONFIGS = {
  8453: {
    chainId: 8453,
    name: "Base",
    shortName: "Base",
    viemChain: base,
    rpcEnvKeys: ["BASE_RPC_URL", "SQUADRONS_BASE_RPC_URL"],
    defaultRpcUrl: "https://mainnet.base.org",
    nativeSymbol: "ETH",
    tokens: {
      USDC: {
        address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
        decimals: 6,
        symbol: "USDC",
      },
      WETH: {
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        symbol: "WETH",
      },
    },
  },
  1: {
    chainId: 1,
    name: "Ethereum",
    shortName: "Ethereum",
    viemChain: mainnet,
    rpcEnvKeys: ["ETHEREUM_RPC_URL", "ETH_RPC_URL", "SQUADRONS_ETH_RPC_URL"],
    defaultRpcUrl: "https://ethereum.publicnode.com",
    nativeSymbol: "ETH",
    tokens: {
      USDC: {
        address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48",
        decimals: 6,
        symbol: "USDC",
      },
      WETH: {
        address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2",
        decimals: 18,
        symbol: "WETH",
      },
    },
  },
  42161: {
    chainId: 42161,
    name: "Arbitrum One",
    shortName: "Arbitrum",
    viemChain: arbitrum,
    rpcEnvKeys: ["ARBITRUM_RPC_URL", "SQUADRONS_ARBITRUM_RPC_URL"],
    defaultRpcUrl: "https://arb1.arbitrum.io/rpc",
    nativeSymbol: "ETH",
    tokens: {
      USDC: {
        address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
        decimals: 6,
        symbol: "USDC",
      },
      WETH: {
        address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1",
        decimals: 18,
        symbol: "WETH",
      },
    },
  },
  10: {
    chainId: 10,
    name: "Optimism",
    shortName: "Optimism",
    viemChain: optimism,
    rpcEnvKeys: ["OPTIMISM_RPC_URL", "SQUADRONS_OPTIMISM_RPC_URL"],
    defaultRpcUrl: "https://mainnet.optimism.io",
    nativeSymbol: "ETH",
    tokens: {
      USDC: {
        address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85",
        decimals: 6,
        symbol: "USDC",
      },
      WETH: {
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        symbol: "WETH",
      },
    },
  },
  130: {
    chainId: 130,
    name: "Unichain",
    shortName: "Unichain",
    viemChain: unichain,
    rpcEnvKeys: ["UNICHAIN_RPC_URL", "SQUADRONS_UNICHAIN_RPC_URL"],
    defaultRpcUrl: "https://mainnet.unichain.org",
    nativeSymbol: "ETH",
    tokens: {
      USDC: {
        address: "0x078D782b760474a361dDA0AF3839290b0EF57AD6",
        decimals: 6,
        symbol: "USDC",
      },
      WETH: {
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        symbol: "WETH",
      },
    },
  },
  480: {
    chainId: 480,
    name: "World Chain",
    shortName: "World Chain",
    viemChain: worldchain,
    rpcEnvKeys: ["WORLDCHAIN_RPC_URL", "SQUADRONS_WORLDCHAIN_RPC_URL"],
    defaultRpcUrl: "https://worldchain-mainnet.g.alchemy.com/public",
    nativeSymbol: "ETH",
    tokens: {
      USDC: {
        address: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1",
        decimals: 6,
        symbol: "USDC",
      },
      WETH: {
        address: "0x4200000000000000000000000000000000000006",
        decimals: 18,
        symbol: "WETH",
      },
    },
  },
  4663: {
    chainId: 4663,
    name: "Robinhood Chain",
    shortName: "Robinhood",
    viemChain: robinhood,
    rpcEnvKeys: ["ROBINHOOD_RPC_URL", "SQUADRONS_ROBINHOOD_RPC_URL"],
    defaultRpcUrl: "https://rpc.mainnet.chain.robinhood.com",
    nativeSymbol: "ETH",
    tokens: {
      // No canonical USDC on Robinhood — USDG / USDe are the stable anchors.
      USDG: {
        address: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168",
        decimals: 6,
        symbol: "USDG",
      },
      WETH: {
        address: "0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73",
        decimals: 18,
        symbol: "WETH",
      },
    },
  },
  5042002: {
    chainId: 5042002,
    name: "Arc Testnet",
    shortName: "Arc",
    viemChain: arcTestnet,
    rpcEnvKeys: ["ARC_RPC_URL", "SQUADRONS_ARC_RPC_URL"],
    defaultRpcUrl: "https://rpc.testnet.arc.io",
    nativeSymbol: "USDC",
    tokens: {
      // ERC-20 interface for native USDC (shares balance; use for approvals / Swap Kit).
      USDC: {
        address: "0x3600000000000000000000000000000000000000",
        decimals: 6,
        symbol: "USDC",
      },
      EURC: {
        address: "0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a",
        decimals: 6,
        symbol: "EURC",
      },
    },
  },
};

/**
 * Agent home chain for this dsh process. Host sets SQUADRONS_AGENT_CHAIN_ID
 * per turn. Smoke / unset defaults to Base.
 * @returns {ChainToolConfig}
 */
export function resolveAgentChainConfig() {
  const raw = process.env.SQUADRONS_AGENT_CHAIN_ID;
  const chainId =
    raw === undefined || raw === ""
      ? 8453
      : Number(raw);

  if (!Number.isFinite(chainId) || !CHAIN_TOOL_CONFIGS[chainId]) {
    throw new Error(
      `Unsupported or missing agent chainId for tools: ${raw ?? "(unset)"}`,
    );
  }

  return CHAIN_TOOL_CONFIGS[chainId];
}

/**
 * @param {ChainToolConfig} config
 */
export function resolveRpcUrl(config) {
  for (const key of config.rpcEnvKeys) {
    const value = process.env[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return config.defaultRpcUrl;
}

/**
 * Default token symbols shown in tool docs for a chain.
 * @param {ChainToolConfig} config
 */
export function defaultTokenSymbols(config) {
  return [config.nativeSymbol, ...Object.keys(config.tokens)];
}

/**
 * Chains where get_dex_quote / swap builds are enabled.
 * Keep in sync with packages/shared policy + apps/host swap-build.
 * How to add a chain: see ./README.md
 * Robinhood (4663) omitted until 0x + USDG routing are verified.
 * Arc (5042002) uses Circle Swap Kit (not 0x).
 */
export const DEX_QUOTE_CHAIN_IDS = [8453, 1, 42161, 10, 130, 480, 5042002];

/** @typedef {"0x" | "circle-swap-kit"} SwapProvider */

/**
 * @param {number} chainId
 * @returns {SwapProvider | null}
 */
export function swapProviderForChain(chainId) {
  if (chainId === 5042002) return "circle-swap-kit";
  if (DEX_QUOTE_CHAIN_IDS.includes(chainId) && chainId !== 5042002) {
    return "0x";
  }
  return null;
}

/**
 * @param {number} chainId
 */
export function supportsDexQuote(chainId) {
  return swapProviderForChain(chainId) != null;
}

/**
 * @param {number} chainId
 */
export function usesCircleSwapKit(chainId) {
  return swapProviderForChain(chainId) === "circle-swap-kit";
}

/**
 * Quote currency for USD-notional swaps on a chain (USDC preferred, else USDG).
 * @param {number} chainId
 * @returns {Erc20Token | null}
 */
export function resolveQuoteStable(chainId) {
  const config = CHAIN_TOOL_CONFIGS[chainId];
  if (!config) return null;
  if (config.tokens.USDC) return { ...config.tokens.USDC };
  if (config.tokens.USDG) return { ...config.tokens.USDG };
  return null;
}
