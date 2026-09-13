/**
 * Circle Swap Kit builder / executor for Arc Testnet.
 * Quotes via estimate; live spend via kit.swap through a Privy-backed EIP-1193 provider.
 */

import { SwapKit } from "@circle-fin/swap-kit";
import { createViemAdapterFromPrivateKey, createViemAdapterFromProvider } from "@circle-fin/adapter-viem-v2";
import { createPublicClient, http, parseUnits } from "viem";
import { resolveKnownToken } from "./recipes/tokens.js";
import { resolveRpcUrl } from "./recipes/rpc.js";
import { broadcastEvmTx } from "./broadcast.js";
import type {
  BuildSwapResult,
  BuiltSwap,
  TradePlan,
} from "./swap-build.js";

export const ARC_TESTNET_CHAIN_ID = 5042002;

const CIRCLE_CHAIN_NAME = "Arc_Testnet" as const;

/** Ephemeral quote-only key — never used to move user funds. */
const QUOTE_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80" as const;

function getCircleApiKey(): string | null {
  return (
    process.env.CIRCLE_API_KEY?.trim() ||
    process.env.CIRCLE_SWAP_API_KEY?.trim() ||
    null
  );
}

export function isCircleSwapConfigured(): boolean {
  return true;
}

export function usesCircleSwapKit(chainId: number): boolean {
  return chainId === ARC_TESTNET_CHAIN_ID;
}

function isAddress(value: string | null | undefined): value is `0x${string}` {
  return typeof value === "string" && /^0x[a-fA-F0-9]{40}$/.test(value);
}

function resolveQuoteStable(chainId: number) {
  return resolveKnownToken(chainId, "USDC");
}

function resolveCircleAsset(chainId: number, symbol: string | null) {
  if (!symbol) return null;
  const upper = symbol.trim().toUpperCase();
  if (upper === "ETH" || upper === "NATIVE" || upper === "USDC") return null;
  return resolveKnownToken(chainId, upper);
}

async function eurcAmountForUsd(amountUsd: number): Promise<string> {
  try {
    const response = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=euro-coin&vs_currencies=usd",
      {
        headers: {
          Accept: "application/json",
          "User-Agent": "squadrons-host/0.1 (circle-swap)",
        },
      },
    );
    if (response.ok) {
      const payload = (await response.json()) as {
        "euro-coin"?: { usd?: number };
      };
      const usd = payload["euro-coin"]?.usd;
      if (typeof usd === "number" && usd > 0) {
        return (amountUsd / usd).toFixed(6);
      }
    }
  } catch {
    /* fall through */
  }
  return amountUsd.toFixed(6);
}

async function resolveSwapLegs(plan: TradePlan): Promise<
  | {
      ok: true;
      stable: NonNullable<ReturnType<typeof resolveQuoteStable>>;
      asset: NonNullable<ReturnType<typeof resolveCircleAsset>>;
      tokenIn: string;
      tokenOut: string;
      amountIn: string;
    }
  | { ok: false; reason: string }
> {
  const stable = resolveQuoteStable(plan.chainId);
  const asset = resolveCircleAsset(plan.chainId, plan.symbol);
  if (!stable) {
    return { ok: false, reason: `No USDC quote stable on chain ${plan.chainId}` };
  }
  if (!asset) {
    return {
      ok: false,
      reason: plan.symbol
        ? `Unsupported Circle swap symbol ${plan.symbol} on chain ${plan.chainId} (try EURC)`
        : "Trade plan needs a symbol (EURC on Arc)",
    };
  }
  if (!plan.side || (plan.side !== "buy" && plan.side !== "sell")) {
    return { ok: false, reason: "Trade plan needs side buy|sell" };
  }

  if (plan.side === "buy") {
    return {
      ok: true,
      stable,
      asset,
      tokenIn: stable.symbol,
      tokenOut: asset.symbol,
      amountIn: plan.amountUsd.toFixed(2),
    };
  }

  const amountIn =
    asset.symbol === "EURC"
      ? await eurcAmountForUsd(plan.amountUsd)
      : plan.amountUsd.toFixed(6);

  return {
    ok: true,
    stable,
    asset,
    tokenIn: asset.symbol,
    tokenOut: stable.symbol,
    amountIn,
  };
}

function placeholderTx(): BuiltSwap["transaction"] {
  return {
    to: "0x0000000000000000000000000000000000000000",
    data: "0x",
    value: "0x0",
  };
}

/**
 * Build an indicative Circle Swap Kit quote as a BuiltSwap (no broadcast calldata).
 * Live execution uses {@link executeCircleSwap}.
 */
export async function buildCircleSwapFromPlan(
  plan: TradePlan,
): Promise<BuildSwapResult> {
  if (!usesCircleSwapKit(plan.chainId)) {
    return {
      ok: false,
      reason: `Circle Swap Kit does not support chain ${plan.chainId}`,
    };
  }
  if (!isAddress(plan.walletAddress)) {
    return { ok: false, reason: "Valid wallet address required for swap quote" };
  }

  const legs = await resolveSwapLegs(plan);
  if (!legs.ok) return legs;

  const apiKey = getCircleApiKey();
  const adapter = createViemAdapterFromPrivateKey({
    privateKey: QUOTE_PRIVATE_KEY,
  });
  const kit = new SwapKit();

  let estimate: Awaited<ReturnType<typeof kit.estimate>>;
  try {
    estimate = await kit.estimate({
      from: { adapter, chain: CIRCLE_CHAIN_NAME },
      tokenIn: legs.tokenIn,
      tokenOut: legs.tokenOut,
      amountIn: legs.amountIn,
      config: {
        slippageBps: plan.maxSlippageBps,
        allowanceStrategy: "approve",
        ...(apiKey ? { apiKey } : {}),
      },
    });
  } catch (error) {
    return {
      ok: false,
      reason: `Circle Swap Kit estimate failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
    };
  }

  const sellDecimals =
    plan.side === "buy" ? legs.stable.decimals : legs.asset.decimals;
  const buyDecimals =
    plan.side === "buy" ? legs.asset.decimals : legs.stable.decimals;
  const buyHuman =
    typeof estimate.estimatedOutput?.amount === "string"
      ? estimate.estimatedOutput.amount
      : null;
  const minHuman =
    typeof estimate.stopLimit?.amount === "string"
      ? estimate.stopLimit.amount
      : null;

  let sellAmount: string | null = null;
  let buyAmount: string | null = null;
  let minBuyAmount: string | null = null;
  try {
    sellAmount = parseUnits(legs.amountIn, sellDecimals).toString();
  } catch {
    /* ignore */
  }
  try {
    if (buyHuman) buyAmount = parseUnits(buyHuman, buyDecimals).toString();
  } catch {
    /* ignore */
  }
  try {
    if (minHuman) minBuyAmount = parseUnits(minHuman, buyDecimals).toString();
  } catch {
    /* ignore */
  }

  const swap: BuiltSwap = {
    provider: "circle-swap-kit",
    chainId: plan.chainId,
    sellToken:
      plan.side === "buy" ? legs.stable.address : legs.asset.address,
    buyToken:
      plan.side === "buy" ? legs.asset.address : legs.stable.address,
    sellAmount,
    buyAmount,
    minBuyAmount,
    allowanceTarget: null,
    // Kit handles approve internally on the live path.
    needsAllowance: false,
    transaction: placeholderTx(),
    zid: null,
  };

  return { ok: true, swap };
}

type JsonRpcRequest = {
  method: string;
  params?: unknown[] | object;
};

/**
 * EIP-1193 provider that signs/broadcasts via Privy and reads via Arc RPC.
 */
function createPrivyEip1193Provider(input: {
  walletAddress: `0x${string}`;
  walletId: string;
  chainId: number;
}) {
  const rpcUrl = resolveRpcUrl(input.chainId);
  const publicClient = createPublicClient({
    transport: http(rpcUrl),
  });

  return {
    request: async ({ method, params }: JsonRpcRequest) => {
      const list = Array.isArray(params) ? params : [];

      if (method === "eth_chainId") {
        return `0x${input.chainId.toString(16)}`;
      }
      if (method === "eth_accounts" || method === "eth_requestAccounts") {
        return [input.walletAddress];
      }
      if (method === "eth_sendTransaction") {
        const tx = list[0] as {
          to?: string;
          data?: string;
          value?: string;
          gas?: string;
          gasLimit?: string;
        };
        if (!tx?.to || !/^0x[a-fA-F0-9]{40}$/.test(tx.to)) {
          throw new Error("eth_sendTransaction missing to");
        }
        const data =
          typeof tx.data === "string" && tx.data.startsWith("0x")
            ? (tx.data as `0x${string}`)
            : ("0x" as const);
        const value =
          typeof tx.value === "string" && tx.value.startsWith("0x")
            ? (tx.value as `0x${string}`)
            : ("0x0" as const);
        const gas = tx.gas ?? tx.gasLimit;
        const sent = await broadcastEvmTx({
          walletId: input.walletId,
          chainId: input.chainId,
          tx: {
            to: tx.to as `0x${string}`,
            data,
            value,
            ...(typeof gas === "string" ? { gas } : {}),
          },
        });
        if (!sent.ok) throw new Error(sent.reason);
        return sent.txHash;
      }

      // Forward reads / gas estimates to Arc RPC.
      return publicClient.request({
        method: method as never,
        params: list as never,
      });
    },
    on() {
      /* no-op — Privy broadcast path does not emit chain events */
    },
    removeListener() {
      /* no-op */
    },
  };
}

export type ExecuteCircleSwapResult =
  | { ok: true; txHash: string; swap: BuiltSwap; detail: string }
  | { ok: false; reason: string; swap?: BuiltSwap };

/**
 * Live Arc swap via Circle Swap Kit, broadcasting through Privy.
 */
export async function executeCircleSwap(input: {
  plan: TradePlan;
  walletId: string;
}): Promise<ExecuteCircleSwapResult> {
  const { plan, walletId } = input;
  if (!usesCircleSwapKit(plan.chainId)) {
    return { ok: false, reason: `Not a Circle Swap Kit chain (${plan.chainId})` };
  }
  if (!isAddress(plan.walletAddress)) {
    return { ok: false, reason: "Valid wallet address required" };
  }
  if (!walletId.trim()) {
    return { ok: false, reason: "Missing Privy wallet id" };
  }

  const built = await buildCircleSwapFromPlan(plan);
  if (!built.ok) {
    return { ok: false, reason: built.reason };
  }

  const legs = await resolveSwapLegs(plan);
  if (!legs.ok) {
    return { ok: false, reason: legs.reason, swap: built.swap };
  }

  const apiKey = getCircleApiKey();
  let adapter;
  try {
    // Privy-backed minimal EIP-1193 — cast past viem's exhaustive RPC schema.
    const provider = createPrivyEip1193Provider({
      walletAddress: plan.walletAddress,
      walletId,
      chainId: plan.chainId,
    }) as Parameters<typeof createViemAdapterFromProvider>[0]["provider"];
    adapter = await createViemAdapterFromProvider({ provider });
  } catch (error) {
    return {
      ok: false,
      reason: `Circle adapter setup failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      swap: built.swap,
    };
  }

  const kit = new SwapKit();
  try {
    const result = await kit.swap({
      from: { adapter, chain: CIRCLE_CHAIN_NAME },
      tokenIn: legs.tokenIn,
      tokenOut: legs.tokenOut,
      amountIn: legs.amountIn,
      config: {
        slippageBps: plan.maxSlippageBps,
        // Privy path uses eth_sendTransaction — avoid EIP-2612 permit signatures.
        allowanceStrategy: "approve",
        ...(apiKey ? { apiKey } : {}),
      },
    });

    const txHash =
      typeof result.txHash === "string" && result.txHash.startsWith("0x")
        ? result.txHash
        : null;
    if (!txHash) {
      return {
        ok: false,
        reason: "Circle Swap Kit returned no transaction hash",
        swap: built.swap,
      };
    }

    return {
      ok: true,
      txHash,
      swap: built.swap,
      detail: `Circle Swap Kit ${legs.tokenIn}→${legs.tokenOut} ${txHash}`,
    };
  } catch (error) {
    return {
      ok: false,
      reason: `Circle Swap Kit swap failed: ${
        error instanceof Error ? error.message : String(error)
      }`,
      swap: built.swap,
    };
  }
}
