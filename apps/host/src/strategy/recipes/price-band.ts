import type { StrategyTickDecision } from "@squadrons/shared";
import { applyStrategyAction } from "./action.js";
import type { RecipeContext } from "./types.js";

const SPOT_IDS: Record<string, string> = {
  ETH: "ethereum",
  WETH: "weth",
  BTC: "bitcoin",
  SOL: "solana",
  USDC: "usd-coin",
  EURC: "euro-coin",
};

export async function executePriceBandAlert(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const params = ctx.strategy.params;
  const symbol =
    typeof params.symbol === "string" && params.symbol.trim()
      ? params.symbol.trim().toUpperCase()
      : "ETH";
  const low = Number(params.low);
  const high = Number(params.high);
  if (!Number.isFinite(low) || !Number.isFinite(high) || high <= low) {
    return {
      action: "alert",
      label: "Price check skipped",
      detail: "Invalid low/high band",
    };
  }

  const coingeckoId = SPOT_IDS[symbol];
  if (!coingeckoId) {
    return {
      action: "alert",
      label: "Price check skipped",
      detail: `No spot feed for ${symbol}`,
    };
  }

  const url = new URL("https://api.coingecko.com/api/v3/simple/price");
  url.searchParams.set("ids", coingeckoId);
  url.searchParams.set("vs_currencies", "usd");

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      "User-Agent": "squadrons-host/0.1 (deterministic recipes; read-only)",
    },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    return {
      action: "alert",
      label: "Price feed failed",
      detail: `HTTP ${response.status}${body ? `: ${body.slice(0, 120)}` : ""}`,
    };
  }

  const payload = (await response.json()) as Record<
    string,
    { usd?: number } | undefined
  >;
  const usd = payload?.[coingeckoId]?.usd;
  if (typeof usd !== "number") {
    return {
      action: "alert",
      label: "Price unavailable",
      detail: `${symbol} returned no USD price`,
    };
  }

  const detail = `${symbol} $${usd.toFixed(2)} (band ${low}–${high})`;
  if (usd >= low && usd <= high) {
    return {
      action: "none",
      label: "Checked price",
      detail,
    };
  }

  return applyStrategyAction(
    ctx,
    {
      action: "alert",
      label:
        usd < low
          ? `${symbol} below $${low}`
          : `${symbol} above $${high}`,
      detail,
    },
    {
      symbol,
      side: usd < low ? "buy" : "sell",
    },
  );
}
