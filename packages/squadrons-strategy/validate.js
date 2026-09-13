function isRecord(value) {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

const RECIPE_IDS = [
  "balance_threshold_alert",
  "price_band_alert",
  "price_cross_alert",
  "price_cross_swap",
  "take_profit_stop",
  "inventory_rebalance",
  "stable_depeg_alert",
  "pool_liquidity_shock",
  "copy_wallet_propose",
  "token_flow_alert",
];

const RECIPE_DEFAULTS = {
  balance_threshold_alert: { asset: "native", op: "below", threshold: 0.1 },
  price_band_alert: { symbol: "ETH", low: 1000, high: 10000 },
  price_cross_alert: { symbol: "ETH", level: 3000, direction: "below" },
  price_cross_swap: {
    symbol: "ETH",
    level: 2800,
    direction: "below",
    side: "buy",
    amountUsd: 10,
  },
  take_profit_stop: {
    symbol: "ETH",
    takeProfit: 3500,
    stopLoss: 2500,
    side: "sell",
    amountUsd: 10,
  },
  inventory_rebalance: {
    targetEthPct: 0.5,
    bandPct: 0.1,
    amountUsd: 10,
    minPortfolioUsd: 5,
  },
  stable_depeg_alert: { symbol: "USDC", low: 0.99, high: 1.01 },
  pool_liquidity_shock: {
    poolAddress: "0x6c561b446416e1a00e8e93e221854d6ea4171372",
    dropPct: 0.2,
    minReserveUsd: 0,
  },
  copy_wallet_propose: {
    targetAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
    amountUsd: 10,
    minUsd: 100,
  },
  token_flow_alert: {
    pipelineId: "pipe_replace_me",
    minVolumeUsd: 75000,
    minScore: 120,
  },
};

function isRecipeId(value) {
  return typeof value === "string" && RECIPE_IDS.includes(value);
}

function parseRecipeParams(recipeId, value) {
  const defaults = RECIPE_DEFAULTS[recipeId] ?? {};
  const raw = value === undefined || value === null ? {} : value;
  if (!isRecord(raw)) return null;

  if (recipeId === "balance_threshold_alert") {
    const asset =
      typeof raw.asset === "string" && raw.asset.trim()
        ? raw.asset.trim()
        : defaults.asset;
    const op = raw.op === "above" || raw.op === "below" ? raw.op : defaults.op;
    const threshold = Number(raw.threshold ?? defaults.threshold);
    if (!Number.isFinite(threshold) || threshold < 0) return null;
    const out = { asset, op, threshold };
    if (typeof raw.walletAddress === "string" && raw.walletAddress.trim()) {
      const addr = raw.walletAddress.trim();
      if (!/^0x[a-fA-F0-9]{40}$/.test(addr)) return null;
      out.walletAddress = addr;
    }
    return out;
  }

  if (recipeId === "price_band_alert") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : defaults.symbol;
    const low = Number(raw.low ?? defaults.low);
    const high = Number(raw.high ?? defaults.high);
    if (!Number.isFinite(low) || !Number.isFinite(high) || low < 0 || high <= low) {
      return null;
    }
    return { symbol, low, high };
  }

  if (recipeId === "price_cross_alert") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : defaults.symbol;
    const level = Number(raw.level ?? defaults.level);
    const direction =
      raw.direction === "above" ||
      raw.direction === "below" ||
      raw.direction === "either"
        ? raw.direction
        : defaults.direction;
    if (!Number.isFinite(level) || level < 0) return null;
    return { symbol, level, direction };
  }

  if (recipeId === "price_cross_swap") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : defaults.symbol;
    const level = Number(raw.level ?? defaults.level);
    const direction =
      raw.direction === "above" ||
      raw.direction === "below" ||
      raw.direction === "either"
        ? raw.direction
        : defaults.direction;
    if (!Number.isFinite(level) || level < 0) return null;

    const inferredSide =
      direction === "above" ? "sell" : direction === "below" ? "buy" : "buy";
    const side =
      raw.side === "buy" || raw.side === "sell"
        ? raw.side
        : defaults.side === "buy" || defaults.side === "sell"
          ? defaults.side
          : inferredSide;

    const amountUsd = Number(raw.amountUsd ?? defaults.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;

    return { symbol, level, direction, side, amountUsd };
  }

  if (recipeId === "take_profit_stop") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : defaults.symbol;
    const takeProfit = Number(raw.takeProfit ?? defaults.takeProfit);
    const stopLoss = Number(raw.stopLoss ?? defaults.stopLoss);
    if (
      !Number.isFinite(takeProfit) ||
      !Number.isFinite(stopLoss) ||
      takeProfit < 0 ||
      stopLoss < 0 ||
      takeProfit <= stopLoss
    ) {
      return null;
    }
    const side =
      raw.side === "buy" || raw.side === "sell"
        ? raw.side
        : defaults.side === "buy" || defaults.side === "sell"
          ? defaults.side
          : "sell";
    const amountUsd = Number(raw.amountUsd ?? defaults.amountUsd);
    if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;
    return { symbol, takeProfit, stopLoss, side, amountUsd };
  }

  if (recipeId === "inventory_rebalance") {
    const targetEthPct = Number(raw.targetEthPct ?? defaults.targetEthPct);
    const bandPct = Number(raw.bandPct ?? defaults.bandPct);
    const amountUsd = Number(raw.amountUsd ?? defaults.amountUsd);
    const minPortfolioUsd = Number(
      raw.minPortfolioUsd ?? defaults.minPortfolioUsd,
    );
    if (
      !Number.isFinite(targetEthPct) ||
      !Number.isFinite(bandPct) ||
      !Number.isFinite(amountUsd) ||
      !Number.isFinite(minPortfolioUsd) ||
      targetEthPct < 0 ||
      targetEthPct > 1 ||
      bandPct <= 0 ||
      bandPct > 0.5 ||
      amountUsd <= 0 ||
      minPortfolioUsd < 0
    ) {
      return null;
    }
    return { targetEthPct, bandPct, amountUsd, minPortfolioUsd };
  }

  if (recipeId === "stable_depeg_alert") {
    const symbol =
      typeof raw.symbol === "string" && raw.symbol.trim()
        ? raw.symbol.trim().toUpperCase()
        : defaults.symbol;
    const low = Number(raw.low ?? defaults.low);
    const high = Number(raw.high ?? defaults.high);
    if (
      !Number.isFinite(low) ||
      !Number.isFinite(high) ||
      low < 0 ||
      high <= low
    ) {
      return null;
    }
    return { symbol, low, high };
  }

  if (recipeId === "pool_liquidity_shock") {
    const poolAddress =
      typeof raw.poolAddress === "string" && raw.poolAddress.trim()
        ? raw.poolAddress.trim()
        : defaults.poolAddress;
    if (
      !/^0x[a-fA-F0-9]{40}$/.test(poolAddress) &&
      !/^0x[a-fA-F0-9]{64}$/.test(poolAddress)
    ) {
      return null;
    }
    const dropPct = Number(raw.dropPct ?? defaults.dropPct);
    const minReserveUsd = Number(
      raw.minReserveUsd ?? defaults.minReserveUsd ?? 0,
    );
    if (
      !Number.isFinite(dropPct) ||
      dropPct <= 0 ||
      dropPct > 1 ||
      !Number.isFinite(minReserveUsd) ||
      minReserveUsd < 0
    ) {
      return null;
    }
    return {
      poolAddress: poolAddress.toLowerCase(),
      dropPct,
      minReserveUsd,
    };
  }

  if (recipeId === "copy_wallet_propose") {
    const targetAddress =
      typeof raw.targetAddress === "string" && raw.targetAddress.trim()
        ? raw.targetAddress.trim()
        : defaults.targetAddress;
    if (!/^0x[a-fA-F0-9]{40}$/.test(targetAddress)) return null;
    const amountUsd = Number(raw.amountUsd ?? defaults.amountUsd);
    const minUsd = Number(raw.minUsd ?? defaults.minUsd);
    if (
      !Number.isFinite(amountUsd) ||
      amountUsd <= 0 ||
      !Number.isFinite(minUsd) ||
      minUsd <= 0
    ) {
      return null;
    }
    return { targetAddress, amountUsd, minUsd };
  }

  if (recipeId === "token_flow_alert") {
    const pipelineId =
      typeof raw.pipelineId === "string" && raw.pipelineId.trim()
        ? raw.pipelineId.trim()
        : defaults.pipelineId;
    if (!pipelineId || !/^pipe_[a-zA-Z0-9_-]{6,48}$/.test(pipelineId)) {
      return null;
    }
    const minVolumeUsd = Number(raw.minVolumeUsd ?? defaults.minVolumeUsd);
    const minScore = Number(raw.minScore ?? defaults.minScore);
    if (
      !Number.isFinite(minVolumeUsd) ||
      minVolumeUsd < 0 ||
      !Number.isFinite(minScore) ||
      minScore < 0
    ) {
      return null;
    }
    return { pipelineId, minVolumeUsd, minScore };
  }

  return null;
}

function parseImprovement(value, fallbackKeys) {
  if (!isRecord(value)) {
    return {
      enabled: false,
      cadence: "daily",
      autoApply: false,
      allowedKeys: [...fallbackKeys],
      lastRunAt: null,
    };
  }
  const cadence =
    value.cadence === "hourly" ||
    value.cadence === "daily" ||
    value.cadence === "weekly"
      ? value.cadence
      : "daily";
  const allowedKeys = Array.isArray(value.allowedKeys)
    ? value.allowedKeys.filter((k) => typeof k === "string")
    : fallbackKeys;
  return {
    enabled: value.enabled === true,
    cadence,
    autoApply: false,
    allowedKeys,
    lastRunAt:
      typeof value.lastRunAt === "number" && Number.isFinite(value.lastRunAt)
        ? value.lastRunAt
        : null,
  };
}

/**
 * Validate propose_strategy args. Mirrors @squadrons/shared parseStrategyDraftInput.
 * @param {unknown} value
 */
export function parseStrategyDraftInput(value) {
  if (!isRecord(value)) return null;
  const summary =
    typeof value.summary === "string" ? value.summary.trim() : "";
  if (!summary) return null;
  if (!isRecipeId(value.recipeId)) return null;
  const recipeId = value.recipeId;
  const params = parseRecipeParams(recipeId, value.params);
  if (!params) return null;

  if (!isRecord(value.trigger)) return null;
  const triggerType = value.trigger.type;
  if (triggerType !== "interval" && triggerType !== "event") return null;

  const trigger = { type: triggerType };
  if (value.trigger.intervalSec !== undefined) {
    const intervalSec = Number(value.trigger.intervalSec);
    if (!Number.isFinite(intervalSec) || intervalSec < 15) return null;
    trigger.intervalSec = Math.floor(intervalSec);
  }
  if (value.trigger.event !== undefined) {
    if (typeof value.trigger.event !== "string") return null;
    const event = value.trigger.event.trim();
    if (event) trigger.event = event;
  }
  if (triggerType === "event" && !trigger.event) return null;
  if (triggerType === "interval" && trigger.intervalSec === undefined) {
    trigger.intervalSec = 60;
  }
  if (triggerType === "event" && trigger.intervalSec === undefined) {
    trigger.intervalSec = 60;
  }

  if (!isRecord(value.action)) return null;
  const actionType = value.action.type;
  if (actionType !== "alert" && actionType !== "propose_trade") return null;
  const action = { type: actionType };
  if (value.action.detail !== undefined) {
    if (typeof value.action.detail !== "string") return null;
    const detail = value.action.detail.trim();
    if (detail) action.detail = detail;
  }

  let caps;
  if (value.caps !== undefined) {
    if (!isRecord(value.caps)) return null;
    caps = {};
    if (value.caps.maxTradeUsd !== undefined) {
      const maxTradeUsd = Number(value.caps.maxTradeUsd);
      if (!Number.isFinite(maxTradeUsd) || maxTradeUsd <= 0) return null;
      caps.maxTradeUsd = maxTradeUsd;
    }
  }

  const improvement =
    value.improvement === undefined
      ? undefined
      : parseImprovement(value.improvement, Object.keys(params));

  return { summary, recipeId, params, trigger, action, caps, improvement };
}

/**
 * @param {unknown} value
 */
export function parseStrategyParamsPatch(value) {
  if (!isRecord(value)) return null;
  if (!isRecord(value.params)) return null;
  return { params: value.params };
}

/**
 * @param {unknown} value
 */
export function parseProposeImprovementInput(value) {
  if (!isRecord(value)) return null;
  if (!isRecord(value.patch)) return null;
  const patch = { ...value.patch };
  if (Object.keys(patch).length === 0) return null;
  const reason =
    typeof value.reason === "string" && value.reason.trim()
      ? value.reason.trim()
      : undefined;
  return reason ? { patch, reason } : { patch };
}
