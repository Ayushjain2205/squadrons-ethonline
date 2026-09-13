import type { Strategy } from "@squadrons/shared";
import {
  clearCopyWalletState,
  detectCopyTrade,
  getCopySnapshot,
  sampleCopyTarget,
  setCopySnapshot,
  setPendingCopySignal,
} from "./recipes/copy-detect.js";

const SPOT_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "weth",
  BTC: "bitcoin",
  SOL: "solana",
  USDC: "usd-coin",
  EURC: "euro-coin",
};

/** In-memory last samples for event-edge detection (resets on host restart). */
const lastPrices = new Map<string, number>();
const lastPoolReserves = new Map<string, number>();

export type EventEdgeResult =
  | { kind: "skip"; reason: string }
  | { kind: "armed"; detail: string }
  | { kind: "quiet"; detail: string }
  | { kind: "fire"; detail: string };

export type PoolReserveSnapshot = {
  reserveUsd: number;
  name: string | null;
  prevReserveUsd: number | null;
  dropFraction: number | null;
};

function geckoNetworkId(chainId: number): string | null {
  if (chainId === 8453) return "base";
  if (chainId === 1) return "eth";
  if (chainId === 42161) return "arbitrum";
  if (chainId === 10) return "optimism";
  if (chainId === 130) return "unichain";
  if (chainId === 480) return "world-chain";
  return null;
}

/** GeckoTerminal pool reserve USD + update in-memory sample for this agent key. */
export async function fetchPoolReserveUsd(
  chainId: number,
  poolAddress: string,
  sampleKey?: string,
): Promise<PoolReserveSnapshot | null> {
  const network = geckoNetworkId(chainId);
  if (!network) return null;
  const address = poolAddress.trim().toLowerCase();
  if (
    !/^0x[a-f0-9]{40}$/.test(address) &&
    !/^0x[a-f0-9]{64}$/.test(address)
  ) {
    return null;
  }

  const url = `https://api.geckoterminal.com/api/v2/networks/${network}/pools/${address}`;
  const response = await fetch(url, {
    headers: {
      accept: "application/json",
      "User-Agent": "squadrons-host/0.1 (pool liquidity; read-only)",
    },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    data?: { attributes?: Record<string, unknown> };
  };
  const attrs = payload.data?.attributes;
  if (!attrs) return null;
  const reserveRaw = attrs.reserve_in_usd;
  const reserveUsd = Number(reserveRaw);
  if (!Number.isFinite(reserveUsd)) return null;
  const name = typeof attrs.name === "string" ? attrs.name : null;

  let prevReserveUsd: number | null = null;
  let dropFraction: number | null = null;
  if (sampleKey) {
    prevReserveUsd = lastPoolReserves.get(sampleKey) ?? null;
    lastPoolReserves.set(sampleKey, reserveUsd);
    if (prevReserveUsd != null && prevReserveUsd > 0) {
      dropFraction = (prevReserveUsd - reserveUsd) / prevReserveUsd;
    }
  }

  return { reserveUsd, name, prevReserveUsd, dropFraction };
}

export async function fetchSpotUsd(symbol: string): Promise<number | null> {
  const coingeckoId = SPOT_IDS[symbol.toUpperCase()];
  if (!coingeckoId) return null;

  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", coingeckoId);
  url.searchParams.set("vs_currencies", "usd");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "squadrons-host/0.1 (event wakes; read-only)",
    },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as Record<
    string,
    { usd?: number } | undefined
  >;
  const usd = payload?.[coingeckoId]?.usd;
  return typeof usd === "number" ? usd : null;
}

/**
 * Cheap pre-check for event triggers. Only `fire` should run the full recipe path
 * with a loud "Strategy tick" — quiet polls just advance lastTickAt.
 */
export async function evaluateEventEdge(
  strategy: Strategy,
  chainId: number,
): Promise<EventEdgeResult> {
  const event = strategy.trigger.event?.trim() || "";
  if (!event) {
    return { kind: "skip", reason: "missing event kind" };
  }

  if (
    event === "price_cross" ||
    strategy.recipeId === "price_cross_alert" ||
    strategy.recipeId === "price_cross_swap"
  ) {
    return evaluatePriceCrossEdge(strategy);
  }

  if (
    event === "price_tp_stop" ||
    strategy.recipeId === "take_profit_stop"
  ) {
    return evaluateTakeProfitStopEdge(strategy);
  }

  if (
    event === "stable_depeg" ||
    strategy.recipeId === "stable_depeg_alert"
  ) {
    return evaluateStableDepegEdge(strategy);
  }

  if (
    event === "pool_liquidity_shock" ||
    strategy.recipeId === "pool_liquidity_shock"
  ) {
    return evaluatePoolLiquidityShockEdge(strategy, chainId);
  }

  if (
    event === "target_trade_seen" ||
    strategy.recipeId === "copy_wallet_propose"
  ) {
    return evaluateCopyWalletEdge(strategy, chainId);
  }

  // Unknown events: treat like interval (always fire when due).
  return {
    kind: "fire",
    detail: `event ${event} (no edge detector — running recipe)`,
  };
}

async function evaluatePriceCrossEdge(
  strategy: Strategy,
): Promise<EventEdgeResult> {
  const symbol =
    typeof strategy.params.symbol === "string"
      ? strategy.params.symbol.toUpperCase()
      : "ETH";
  const level = Number(strategy.params.level);
  const direction =
    strategy.params.direction === "above" ||
    strategy.params.direction === "below" ||
    strategy.params.direction === "either"
      ? strategy.params.direction
      : "below";

  if (!Number.isFinite(level)) {
    return { kind: "skip", reason: "invalid price_cross level" };
  }

  const price = await fetchSpotUsd(symbol);
  if (price == null) {
    return { kind: "skip", reason: `no spot price for ${symbol}` };
  }

  const key = strategy.agentId;
  const prev = lastPrices.get(key);
  lastPrices.set(key, price);

  if (prev == null) {
    return {
      kind: "armed",
      detail: `${symbol} $${price.toFixed(2)} — watching ${direction} ${level}`,
    };
  }

  let crossed = false;
  if (direction === "above") {
    crossed = prev < level && price >= level;
  } else if (direction === "below") {
    crossed = prev > level && price <= level;
  } else {
    crossed =
      (prev < level && price >= level) || (prev > level && price <= level);
  }

  const detail = `${symbol} $${prev.toFixed(2)} → $${price.toFixed(2)} (level ${level})`;
  if (crossed) return { kind: "fire", detail };
  return { kind: "quiet", detail };
}

async function evaluateTakeProfitStopEdge(
  strategy: Strategy,
): Promise<EventEdgeResult> {
  const symbol =
    typeof strategy.params.symbol === "string"
      ? strategy.params.symbol.toUpperCase()
      : "ETH";
  const takeProfit = Number(strategy.params.takeProfit);
  const stopLoss = Number(strategy.params.stopLoss);

  if (
    !Number.isFinite(takeProfit) ||
    !Number.isFinite(stopLoss) ||
    takeProfit <= stopLoss
  ) {
    return { kind: "skip", reason: "invalid takeProfit/stopLoss" };
  }

  const price = await fetchSpotUsd(symbol);
  if (price == null) {
    return { kind: "skip", reason: `no spot price for ${symbol}` };
  }

  const key = strategy.agentId;
  const prev = lastPrices.get(key);
  lastPrices.set(key, price);

  if (prev == null) {
    return {
      kind: "armed",
      detail: `${symbol} $${price.toFixed(2)} — watching TP $${takeProfit} / stop $${stopLoss}`,
    };
  }

  const hitTp = prev < takeProfit && price >= takeProfit;
  const hitStop = prev > stopLoss && price <= stopLoss;
  const detail = `${symbol} $${prev.toFixed(2)} → $${price.toFixed(2)} (TP $${takeProfit} / stop $${stopLoss})`;

  if (hitTp || hitStop) {
    return {
      kind: "fire",
      detail: hitTp ? `${detail} · TP` : `${detail} · stop`,
    };
  }
  return { kind: "quiet", detail };
}

async function evaluateStableDepegEdge(
  strategy: Strategy,
): Promise<EventEdgeResult> {
  const symbol =
    typeof strategy.params.symbol === "string"
      ? strategy.params.symbol.toUpperCase()
      : "USDC";
  const low = Number(strategy.params.low);
  const high = Number(strategy.params.high);

  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    return { kind: "skip", reason: "invalid stable peg band" };
  }

  const price = await fetchSpotUsd(symbol);
  if (price == null) {
    return { kind: "skip", reason: `no spot price for ${symbol}` };
  }

  const key = strategy.agentId;
  const prev = lastPrices.get(key);
  lastPrices.set(key, price);

  const inside = (p: number) => p >= low && p <= high;

  if (prev == null) {
    return {
      kind: "armed",
      detail: `${symbol} $${price.toFixed(4)} — watching peg ${low}–${high}`,
    };
  }

  const detail = `${symbol} $${prev.toFixed(4)} → $${price.toFixed(4)} (peg ${low}–${high})`;
  if (inside(prev) && !inside(price)) {
    return { kind: "fire", detail: `${detail} · depeg` };
  }
  return { kind: "quiet", detail };
}

async function evaluatePoolLiquidityShockEdge(
  strategy: Strategy,
  chainId: number,
): Promise<EventEdgeResult> {
  const poolAddress =
    typeof strategy.params.poolAddress === "string"
      ? strategy.params.poolAddress.trim()
      : "";
  const dropPct = Number(strategy.params.dropPct);
  const minReserveUsd = Number(strategy.params.minReserveUsd ?? 0);

  if (!poolAddress || !Number.isFinite(dropPct) || dropPct <= 0) {
    return { kind: "skip", reason: "invalid pool liquidity params" };
  }

  const snap = await fetchPoolReserveUsd(
    chainId,
    poolAddress,
    strategy.agentId,
  );
  if (!snap) {
    return { kind: "skip", reason: "no pool reserve" };
  }

  const label =
    snap.name ?? `${poolAddress.slice(0, 6)}…${poolAddress.slice(-4)}`;

  if (snap.prevReserveUsd == null) {
    return {
      kind: "armed",
      detail: `${label} reserve $${snap.reserveUsd.toFixed(0)} — watching ≥${(dropPct * 100).toFixed(0)}% drop`,
    };
  }

  const detail = `${label} $${snap.prevReserveUsd.toFixed(0)} → $${snap.reserveUsd.toFixed(0)}`;
  const hitDrop =
    snap.dropFraction != null && snap.dropFraction >= dropPct;
  const hitFloor = minReserveUsd > 0 && snap.reserveUsd < minReserveUsd;

  if (hitDrop || hitFloor) {
    return {
      kind: "fire",
      detail: hitDrop
        ? `${detail} · −${((snap.dropFraction ?? 0) * 100).toFixed(1)}%`
        : `${detail} · below floor $${minReserveUsd}`,
    };
  }
  return { kind: "quiet", detail };
}

async function evaluateCopyWalletEdge(
  strategy: Strategy,
  chainId: number,
): Promise<EventEdgeResult> {
  const targetAddress =
    typeof strategy.params.targetAddress === "string"
      ? strategy.params.targetAddress.trim()
      : "";
  const minUsd = Number(strategy.params.minUsd ?? 100);

  if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress) || !(minUsd > 0)) {
    return { kind: "skip", reason: "invalid copy wallet params" };
  }

  const next = await sampleCopyTarget(chainId, targetAddress);
  if (!next) {
    return { kind: "skip", reason: "could not sample target balances" };
  }

  const short = `${targetAddress.slice(0, 6)}…${targetAddress.slice(-4)}`;
  const prev = getCopySnapshot(strategy.agentId);
  setCopySnapshot(strategy.agentId, next);

  if (!prev) {
    return {
      kind: "armed",
      detail: `${short} ETH $${next.ethUsd.toFixed(0)} / USDC $${next.usdcUsd.toFixed(0)} — watching ETH↔USDC ≥ $${minUsd}`,
    };
  }

  const signal = detectCopyTrade(prev, next, minUsd);
  const detail = `${short} ETH $${prev.ethUsd.toFixed(0)}→$${next.ethUsd.toFixed(0)} USDC $${prev.usdcUsd.toFixed(0)}→$${next.usdcUsd.toFixed(0)}`;

  if (signal) {
    setPendingCopySignal(strategy.agentId, signal);
    return {
      kind: "fire",
      detail: `${detail} · ${signal.side} ~$${signal.observedUsd.toFixed(0)}`,
    };
  }
  return { kind: "quiet", detail };
}

export function clearEventEdgeState(agentId: string): void {
  lastPrices.delete(agentId);
  lastPoolReserves.delete(agentId);
  clearCopyWalletState(agentId);
}
