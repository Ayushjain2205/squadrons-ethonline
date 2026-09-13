/**
 * Circle Swap Kit quotes for Arc (and other Circle-routed home chains).
 * Observe-only — never agent-facing calldata. Mirrors host circle-swap.ts.
 */

import { SwapKit } from "@circle-fin/swap-kit";
import { createViemAdapterFromPrivateKey } from "@circle-fin/adapter-viem-v2";
import { parseUnits } from "viem";
import {
  CHAIN_TOOL_CONFIGS,
  resolveQuoteStable,
  usesCircleSwapKit,
} from "./chains.js";

const MAX_TRADE_USD = 10;
const DEFAULT_SLIPPAGE_BPS = 50;

/** Ephemeral quote-only signer — never used to move user funds. */
const QUOTE_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

/** @type {Map<number, string>} */
const CIRCLE_CHAIN_NAME = new Map([[5042002, "Arc_Testnet"]]);

/**
 * @param {string | null | undefined} value
 * @returns {value is `0x${string}`}
 */
function isAddr(value) {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function getCircleApiKey() {
  return (
    process.env.CIRCLE_API_KEY?.trim() ||
    process.env.CIRCLE_SWAP_API_KEY?.trim() ||
    null
  );
}

export function isCircleSwapConfigured() {
  // Swap Kit allows permissionless estimates; key is recommended for volume.
  return true;
}

export function isCircleApiKeySet() {
  return Boolean(getCircleApiKey());
}

/**
 * Quotable FX / asset symbols on Circle-routed chains (excludes quote stable).
 * @param {number} chainId
 */
export function circleQuotableAssetSymbols(chainId) {
  const config = CHAIN_TOOL_CONFIGS[chainId];
  const stable = resolveQuoteStable(chainId);
  if (!config || !stable) return [];
  return Object.keys(config.tokens).filter(
    (sym) => sym !== stable.symbol && sym !== "USDC",
  );
}

/**
 * @param {number} chainId
 * @param {string} symbol
 */
function resolveCircleAsset(chainId, symbol) {
  const config = CHAIN_TOOL_CONFIGS[chainId];
  if (!config) return null;
  const upper = symbol.trim().toUpperCase();
  if (upper === "ETH" || upper === "NATIVE" || upper === "USDC") return null;
  if (config.tokens[upper]) return { ...config.tokens[upper] };
  return null;
}

/**
 * Convert USD notional to human-readable EURC amount via CoinGecko.
 * @param {number} amountUsd
 */
async function eurcAmountForUsd(amountUsd, signal) {
  const response = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=euro-coin&vs_currencies=usd",
    {
      headers: {
        Accept: "application/json",
        "User-Agent": "squadrons-host/0.1 (circle-quote; observe)",
      },
      signal,
    },
  );
  if (!response.ok) {
    // Soft fallback: treat EUR ≈ USD for indicative sizing only.
    return amountUsd.toFixed(6);
  }
  const payload = await response.json();
  const usd = payload?.["euro-coin"]?.usd;
  if (typeof usd !== "number" || !(usd > 0)) {
    return amountUsd.toFixed(6);
  }
  return (amountUsd / usd).toFixed(6);
}

/**
 * @param {{
 *   chainId: number,
 *   walletAddress: string,
 *   side: "buy" | "sell",
 *   symbol: string,
 *   amountUsd: number,
 *   slippageBps?: number,
 * }} plan
 * @param {AbortSignal} [signal]
 */
export async function fetchCircleDexQuote(plan, signal) {
  const config = CHAIN_TOOL_CONFIGS[plan.chainId];
  if (!config || !usesCircleSwapKit(plan.chainId)) {
    throw new Error(
      `Circle Swap Kit is not enabled for chainId ${plan.chainId}`,
    );
  }

  const circleChain = CIRCLE_CHAIN_NAME.get(plan.chainId);
  if (!circleChain) {
    throw new Error(`No Circle chain name for chainId ${plan.chainId}`);
  }

  const stable = resolveQuoteStable(plan.chainId);
  if (!stable) {
    throw new Error(`No quote stable configured for ${config.shortName}`);
  }

  if (!isAddr(plan.walletAddress)) {
    throw new Error(
      "Valid wallet address required (sign in, or pass address) for a Circle quote",
    );
  }

  if (plan.side !== "buy" && plan.side !== "sell") {
    throw new Error("side must be buy or sell");
  }

  if (
    typeof plan.amountUsd !== "number" ||
    !Number.isFinite(plan.amountUsd) ||
    plan.amountUsd <= 0
  ) {
    throw new Error("amountUsd must be a positive number");
  }
  if (plan.amountUsd > MAX_TRADE_USD) {
    throw new Error(
      `amountUsd exceeds desk maxTradeUsd (${MAX_TRADE_USD}). Pass a smaller size.`,
    );
  }

  const slippageBps =
    plan.slippageBps === undefined || plan.slippageBps === null
      ? DEFAULT_SLIPPAGE_BPS
      : Number(plan.slippageBps);
  if (
    !Number.isInteger(slippageBps) ||
    slippageBps < 1 ||
    slippageBps > 500
  ) {
    throw new Error("slippageBps must be an integer from 1 to 500");
  }

  const asset = resolveCircleAsset(plan.chainId, plan.symbol);
  if (!asset) {
    const known = circleQuotableAssetSymbols(plan.chainId).join(", ");
    throw new Error(
      `Unsupported symbol ${plan.symbol} on ${config.shortName}. Known: ${known}`,
    );
  }

  /** @type {string} */
  let tokenIn;
  /** @type {string} */
  let tokenOut;
  /** @type {string} */
  let amountIn;

  if (plan.side === "buy") {
    tokenIn = stable.symbol;
    tokenOut = asset.symbol;
    amountIn = plan.amountUsd.toFixed(2);
  } else {
    tokenIn = asset.symbol;
    tokenOut = stable.symbol;
    if (asset.symbol === "EURC") {
      amountIn = await eurcAmountForUsd(plan.amountUsd, signal);
    } else {
      amountIn = plan.amountUsd.toFixed(6);
    }
  }

  const apiKey = getCircleApiKey();
  const adapter = createViemAdapterFromPrivateKey({
    privateKey: QUOTE_PRIVATE_KEY,
  });
  const kit = new SwapKit();

  let estimate;
  try {
    estimate = await kit.estimate({
      from: { adapter, chain: circleChain },
      tokenIn,
      tokenOut,
      amountIn,
      config: {
        slippageBps,
        allowanceStrategy: "approve",
        ...(apiKey ? { apiKey } : {}),
      },
    });
  } catch (error) {
    throw new Error(
      `Circle Swap Kit estimate failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const sellAmountHuman = amountIn;
  const buyAmountHuman =
    typeof estimate.estimatedOutput?.amount === "string"
      ? estimate.estimatedOutput.amount
      : null;
  const minBuyHuman =
    typeof estimate.stopLimit?.amount === "string"
      ? estimate.stopLimit.amount
      : null;

  const sellDecimals = plan.side === "buy" ? stable.decimals : asset.decimals;
  const buyDecimals = plan.side === "buy" ? asset.decimals : stable.decimals;

  let sellRaw = null;
  let buyRaw = null;
  let minBuyRaw = null;
  try {
    sellRaw = parseUnits(sellAmountHuman, sellDecimals).toString();
  } catch {
    /* ignore */
  }
  try {
    if (buyAmountHuman) {
      buyRaw = parseUnits(buyAmountHuman, buyDecimals).toString();
    }
  } catch {
    /* ignore */
  }
  try {
    if (minBuyHuman) {
      minBuyRaw = parseUnits(minBuyHuman, buyDecimals).toString();
    }
  } catch {
    /* ignore */
  }

  const sellTokenAddr =
    plan.side === "buy" ? stable.address : asset.address;
  const buyTokenAddr =
    plan.side === "buy" ? asset.address : stable.address;

  return {
    source: "circle-swap-kit",
    kind: "dex_quote",
    chainId: plan.chainId,
    chain: config.name,
    quoteStable: stable.symbol,
    side: plan.side,
    symbol: asset.symbol,
    amountUsd: plan.amountUsd,
    slippageBps,
    taker: plan.walletAddress,
    sell: {
      token: tokenIn,
      address: sellTokenAddr,
      amount: sellAmountHuman,
      raw: sellRaw,
    },
    buy: {
      token: tokenOut,
      address: buyTokenAddr,
      amount: buyAmountHuman,
      raw: buyRaw,
      minAmount: minBuyHuman,
      minRaw: minBuyRaw,
    },
    allowanceTarget: null,
    needsAllowance: true,
    gasEstimate: null,
    zid: null,
    fees: estimate.fees ?? null,
    asOf: new Date().toISOString(),
    note: `Indicative Circle Swap Kit quote on ${config.shortName} (${stable.symbol}↔${asset.symbol}). Observe-only — does not execute. Arc uses Circle App Kit / Swap Kit, not 0x.`,
  };
}

export { MAX_TRADE_USD, DEFAULT_SLIPPAGE_BPS };
