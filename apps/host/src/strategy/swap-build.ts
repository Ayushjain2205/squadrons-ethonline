import { DEFAULT_POLICY, usesCircleSwapKit } from "@squadrons/shared";
import { resolveKnownToken } from "./recipes/tokens.js";
import {
  buildCircleSwapFromPlan,
  isCircleSwapConfigured,
} from "./circle-swap.js";

/** 0x native ETH sentinel (not WETH). */
export const ZEROEX_NATIVE_TOKEN =
  "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE" as const;

/** Chains where 0x AllowanceHolder quotes / swap builds are enabled.
 * Keep in sync with packages/squadrons-defi/chains.js + shared policy.
 * How to add a chain: packages/squadrons-defi/README.md
 * Arc (5042002) is Circle Swap Kit — see DEX_QUOTE_CHAIN_IDS + usesCircleSwapKit.
 */
export const ZEROEX_QUOTE_CHAIN_IDS = [
  DEFAULT_POLICY.defaultChainId,
  1,
  42161,
  10,
  130,
  480,
] as const;

/** All swap-enabled home chains (0x + Circle). */
export const DEX_QUOTE_CHAIN_IDS = [
  ...ZEROEX_QUOTE_CHAIN_IDS,
  5042002,
] as const;

export function supportsDexQuote(chainId: number): boolean {
  return (DEX_QUOTE_CHAIN_IDS as readonly number[]).includes(chainId);
}

export type TradePlan = {
  chainId: number;
  walletAddress: string | null;
  amountUsd: number;
  symbol: string | null;
  side: "buy" | "sell" | null;
  maxSlippageBps: number;
};

export type BuiltSwapTx = {
  to: `0x${string}`;
  data: `0x${string}`;
  value: `0x${string}`;
  gas?: string;
  gasPrice?: string;
};

export type BuiltSwap = {
  provider: "0x" | "circle-swap-kit";
  chainId: number;
  sellToken: string;
  buyToken: string;
  sellAmount: string | null;
  buyAmount: string | null;
  minBuyAmount: string | null;
  allowanceTarget: string | null;
  needsAllowance: boolean;
  transaction: BuiltSwapTx;
  zid: string | null;
};

export type BuildSwapResult =
  | { ok: true; swap: BuiltSwap }
  | { ok: false; reason: string };

function getZeroExApiKey(): string | null {
  return process.env.ZEROEX_API_KEY?.trim() || null;
}

function isAddress(value: string | null | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function stableAmountUnits(amountUsd: number, decimals: number): string {
  const scale = 10 ** decimals;
  const units = Math.round(amountUsd * scale);
  if (!(units > 0)) throw new Error("Stable amount rounds to zero");
  return String(units);
}

function resolveAssetToken(
  chainId: number,
  symbol: string | null,
): { address: string; symbol: string } | null {
  if (!symbol) return null;
  const upper = symbol.trim().toUpperCase();
  if (upper === "ETH" || upper === "NATIVE") {
    return { address: ZEROEX_NATIVE_TOKEN, symbol: "ETH" };
  }
  const known = resolveKnownToken(chainId, upper);
  if (!known) return null;
  return { address: known.address, symbol: known.symbol };
}

/** Quote stable for USD notional (USDC preferred, else USDG). */
function resolveQuoteStable(
  chainId: number,
): { address: string; symbol: string; decimals: number } | null {
  const usdc = resolveKnownToken(chainId, "USDC");
  if (usdc) return usdc;
  const usdg = resolveKnownToken(chainId, "USDG");
  if (usdg) return usdg;
  return null;
}

/**
 * Map a capped USD trade plan to a swap quote (0x or Circle Swap Kit).
 * buy  → sell stable for asset (exact-in stable)
 * sell → sell asset for stable (exact-out stable on 0x; exact-in FX on Circle)
 */
export async function buildSwapFromPlan(
  plan: TradePlan,
): Promise<BuildSwapResult> {
  if (usesCircleSwapKit(plan.chainId)) {
    if (!isCircleSwapConfigured()) {
      return { ok: false, reason: "Circle Swap Kit is unavailable" };
    }
    return buildCircleSwapFromPlan(plan);
  }

  const apiKey = getZeroExApiKey();
  if (!apiKey) {
    return { ok: false, reason: "ZEROEX_API_KEY is not set" };
  }

  if (!(ZEROEX_QUOTE_CHAIN_IDS as readonly number[]).includes(plan.chainId)) {
    return {
      ok: false,
      reason: `Swap builder does not support chain ${plan.chainId} (enabled: Base, Ethereum, Arc via Circle)`,
    };
  }

  if (!isAddress(plan.walletAddress)) {
    return { ok: false, reason: "Valid wallet address required for swap quote" };
  }

  if (!plan.side || (plan.side !== "buy" && plan.side !== "sell")) {
    return { ok: false, reason: "Trade plan needs side buy|sell" };
  }

  const asset = resolveAssetToken(plan.chainId, plan.symbol);
  const stable = resolveQuoteStable(plan.chainId);
  if (!asset) {
    return {
      ok: false,
      reason: plan.symbol
        ? `Unsupported swap symbol ${plan.symbol} on chain ${plan.chainId}`
        : "Trade plan needs a symbol",
    };
  }
  if (!stable) {
    return { ok: false, reason: `No quote stable on chain ${plan.chainId}` };
  }

  if (asset.address.toLowerCase() === stable.address.toLowerCase()) {
    return {
      ok: false,
      reason: `Cannot swap ${stable.symbol} for ${stable.symbol}`,
    };
  }

  const notionalUnits = stableAmountUnits(plan.amountUsd, stable.decimals);
  const params = new URLSearchParams({
    chainId: String(plan.chainId),
    taker: plan.walletAddress,
    slippageBps: String(plan.maxSlippageBps),
  });

  if (plan.side === "buy") {
    params.set("sellToken", stable.address);
    params.set("buyToken", asset.address);
    params.set("sellAmount", notionalUnits);
  } else {
    params.set("sellToken", asset.address);
    params.set("buyToken", stable.address);
    params.set("buyAmount", notionalUnits);
  }

  const url = `https://api.0x.org/swap/allowance-holder/quote?${params}`;
  let response: Response;
  try {
    response = await fetch(url, {
      headers: {
        "0x-api-key": apiKey,
        "0x-version": "v2",
        Accept: "application/json",
      },
    });
  } catch (error) {
    return {
      ok: false,
      reason: `0x quote network error: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const payload = (await response.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;

  if (!response.ok) {
    const message =
      (payload &&
        typeof payload === "object" &&
        (typeof payload.message === "string"
          ? payload.message
          : typeof payload.reason === "string"
            ? payload.reason
            : null)) ||
      `HTTP ${response.status}`;
    return { ok: false, reason: `0x quote failed: ${message}` };
  }

  if (!payload || payload.liquidityAvailable === false) {
    return { ok: false, reason: "0x quote: no liquidity" };
  }

  const tx = payload.transaction as
    | {
        to?: string;
        data?: string;
        value?: string;
        gas?: string;
        gasPrice?: string;
      }
    | undefined;

  if (!isAddress(tx?.to) || typeof tx?.data !== "string" || !tx.data.startsWith("0x")) {
    return { ok: false, reason: "0x quote missing transaction calldata" };
  }

  const issues = payload.issues as
    | { allowance?: { spender?: string } | null }
    | undefined;
  const allowanceTarget =
    (typeof payload.allowanceTarget === "string"
      ? payload.allowanceTarget
      : null) ??
    (typeof issues?.allowance?.spender === "string"
      ? issues.allowance.spender
      : null);

  const swap: BuiltSwap = {
    provider: "0x",
    chainId: plan.chainId,
    sellToken: String(payload.sellToken ?? ""),
    buyToken: String(payload.buyToken ?? ""),
    sellAmount:
      typeof payload.sellAmount === "string" ? payload.sellAmount : null,
    buyAmount: typeof payload.buyAmount === "string" ? payload.buyAmount : null,
    minBuyAmount:
      typeof payload.minBuyAmount === "string" ? payload.minBuyAmount : null,
    allowanceTarget,
    needsAllowance: Boolean(issues?.allowance),
    transaction: {
      to: tx.to,
      data: tx.data as `0x${string}`,
      value: (typeof tx.value === "string" && tx.value.startsWith("0x")
        ? tx.value
        : "0x0") as `0x${string}`,
      ...(typeof tx.gas === "string" ? { gas: tx.gas } : {}),
      ...(typeof tx.gasPrice === "string" ? { gasPrice: tx.gasPrice } : {}),
    },
    zid: typeof payload.zid === "string" ? payload.zid : null,
  };

  return { ok: true, swap };
}

export function isZeroExConfigured(): boolean {
  return Boolean(getZeroExApiKey());
}

/** True when the plan's chain has a configured swap provider. */
export function isSwapProviderConfigured(chainId: number): boolean {
  if (usesCircleSwapKit(chainId)) return isCircleSwapConfigured();
  return isZeroExConfigured();
}
