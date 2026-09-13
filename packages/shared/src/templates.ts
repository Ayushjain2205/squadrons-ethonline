import type { SupportedChainId } from "./policy";
import { isSupportedChainId } from "./policy";
import {
  parseStrategyDraftInput,
  type UpsertStrategyDraftInput,
} from "./strategy";

/**
 * Curated strategy template — a prefilled draft, not a new executor.
 * Import writes a strategy draft; the user still Arms in the desk.
 */
export type StrategyTemplate = {
  id: string;
  name: string;
  /** One-line list subtitle. */
  blurb: string;
  /** Longer body for the template detail pane. */
  description: string;
  /**
   * Home chains this template is offered for.
   * Empty array = any supported chain.
   */
  chainIds: readonly SupportedChainId[];
  tags: readonly string[];
  /** Param keys the desk may tweak before import. */
  editableKeys: readonly string[];
  draft: UpsertStrategyDraftInput;
};

/** ETH L2s / mainnet with USDC + 0x quotes (excludes Robinhood + Arc). */
const DEX_TEMPLATE_CHAINS = [
  8453, 1, 42161, 10, 130, 480,
] as const satisfies readonly SupportedChainId[];

/** Arc Testnet — Circle Swap Kit USDC↔EURC. */
const ARC_TEMPLATE_CHAINS = [5042002] as const satisfies readonly SupportedChainId[];

/** Robinhood Chain — Substreams token-flow listeners. */
const ROBINHOOD_TEMPLATE_CHAINS = [
  4663,
] as const satisfies readonly SupportedChainId[];

/**
 * Squadrons-authored templates only. Add entries here — no migration.
 * Each draft must use a built-in recipeId.
 */
export const STRATEGY_TEMPLATES: readonly StrategyTemplate[] = [
  {
    id: "eth-dip-alert",
    name: "ETH dip watch",
    blurb: "Alert when ETH crosses below a USD level.",
    description:
      "Event-style watch for ETH USD. The host polls quietly and only fires when price crosses your level — useful for dip alerts without noisy interval spam. Import sets a draft; tweak the level, then Arm.",
    chainIds: DEX_TEMPLATE_CHAINS,
    tags: ["alert", "price"],
    editableKeys: ["level", "direction"],
    draft: {
      summary: "Alert when ETH crosses below $2,800",
      recipeId: "price_cross_alert",
      params: { symbol: "ETH", level: 2800, direction: "below" },
      trigger: { type: "event", event: "price_cross", intervalSec: 60 },
      action: { type: "alert" },
    },
  },
  {
    id: "eth-price-band",
    name: "ETH price band",
    blurb: "Alert when ETH leaves a USD band.",
    description:
      "Interval check that alerts when ETH spot USD moves outside your low–high band. Good for range monitoring. Defaults are a wide demo band — tighten before Arming.",
    chainIds: DEX_TEMPLATE_CHAINS,
    tags: ["alert", "price"],
    editableKeys: ["low", "high"],
    draft: {
      summary: "Alert when ETH leaves $2,000–$5,000",
      recipeId: "price_band_alert",
      params: { symbol: "ETH", low: 2000, high: 5000 },
      trigger: { type: "interval", intervalSec: 60 },
      action: { type: "alert" },
    },
  },
  {
    id: "native-low-balance",
    name: "Native balance low",
    blurb: "Alert when home-chain gas/native balance drops below a floor.",
    description:
      "Watches the shared wallet’s native/gas balance on this agent’s home chain. Fires an in-app alert when it drops below your floor so you can top up before txs fail. Works on any supported chain.",
    chainIds: [],
    tags: ["alert", "wallet"],
    editableKeys: ["threshold"],
    draft: {
      summary: "Alert when native balance drops below 0.01",
      recipeId: "balance_threshold_alert",
      params: { asset: "native", op: "below", threshold: 0.01 },
      trigger: { type: "interval", intervalSec: 120 },
      action: { type: "alert" },
    },
  },
  {
    id: "eth-dip-buy",
    name: "ETH dip buy",
    blurb: "Propose a capped ETH buy when price crosses below a level.",
    description:
      "Event-style dip buy on ETH USD. When price crosses your level, the host proposes a capped USDC→ETH swap (spend still fail-closed / desk confirm). Defaults to $10 — tighten level and size before Arming. Needs spend enabled on the agent.",
    chainIds: DEX_TEMPLATE_CHAINS,
    tags: ["trade", "price", "propose"],
    editableKeys: ["level", "amountUsd", "direction", "side"],
    draft: {
      summary: "Propose buy ETH when price crosses below $2,800 (~$10)",
      recipeId: "price_cross_swap",
      params: {
        symbol: "ETH",
        level: 2800,
        direction: "below",
        side: "buy",
        amountUsd: 10,
      },
      trigger: { type: "event", event: "price_cross", intervalSec: 60 },
      action: { type: "propose_trade" },
      caps: { maxTradeUsd: 10 },
    },
  },
  {
    id: "eth-tp-stop",
    name: "ETH take-profit / stop",
    blurb: "Propose a capped ETH sell at take-profit or stop-loss.",
    description:
      "Long-exit watch: fires when ETH crosses above your take-profit or below your stop. Proposes a capped sell (fail-closed). Set levels around your entry before Arming; requires spend enabled.",
    chainIds: DEX_TEMPLATE_CHAINS,
    tags: ["trade", "price", "propose"],
    editableKeys: ["takeProfit", "stopLoss", "amountUsd", "side"],
    draft: {
      summary: "Propose sell ETH at TP $3,500 or stop $2,500 (~$10)",
      recipeId: "take_profit_stop",
      params: {
        symbol: "ETH",
        takeProfit: 3500,
        stopLoss: 2500,
        side: "sell",
        amountUsd: 10,
      },
      trigger: { type: "event", event: "price_tp_stop", intervalSec: 60 },
      action: { type: "propose_trade" },
      caps: { maxTradeUsd: 10 },
    },
  },
  {
    id: "eth-usdc-rebalance",
    name: "ETH/USDC rebalance",
    blurb: "Propose a swap when ETH share leaves a 50% ±10% band.",
    description:
      "Interval check of the shared wallet’s ETH + USDC on the home chain. When ETH’s USD share drifts outside your band, proposes a capped corrective swap (fail-closed). Needs USDC + 0x on the home chain.",
    chainIds: DEX_TEMPLATE_CHAINS,
    tags: ["trade", "wallet", "propose"],
    editableKeys: ["targetEthPct", "bandPct", "amountUsd", "minPortfolioUsd"],
    draft: {
      summary: "Propose ETH/USDC rebalance when ETH share leaves 40–60% (~$10 max)",
      recipeId: "inventory_rebalance",
      params: {
        targetEthPct: 0.5,
        bandPct: 0.1,
        amountUsd: 10,
        minPortfolioUsd: 5,
      },
      trigger: { type: "interval", intervalSec: 300 },
      action: { type: "propose_trade" },
      caps: { maxTradeUsd: 10 },
    },
  },
  {
    id: "usdc-depeg-watch",
    name: "USDC depeg watch",
    blurb: "Alert when USDC leaves a $0.99–$1.01 peg band.",
    description:
      "Event-style peg watch. The host polls quietly and alerts when USDC USD moves outside your band — useful before USDC-centric strategies. Alert-only by default.",
    chainIds: DEX_TEMPLATE_CHAINS,
    tags: ["alert", "stable"],
    editableKeys: ["low", "high"],
    draft: {
      summary: "Alert when USDC leaves $0.99–$1.01",
      recipeId: "stable_depeg_alert",
      params: { symbol: "USDC", low: 0.99, high: 1.01 },
      trigger: { type: "event", event: "stable_depeg", intervalSec: 60 },
      action: { type: "alert" },
    },
  },
  {
    id: "base-weth-usdc-liq",
    name: "Base WETH/USDC liquidity shock",
    blurb: "Alert when a major Base WETH/USDC pool reserve drops ≥20%.",
    description:
      "Watches a large Base WETH/USDC pool via GeckoTerminal. Quiet polls until reserve USD drops by your percentage (or under an optional floor). Paste another pool address from get_trending_pools if you want a different venue.",
    chainIds: [8453],
    tags: ["alert", "pool", "base"],
    editableKeys: ["poolAddress", "dropPct", "minReserveUsd"],
    draft: {
      summary: "Alert when Base WETH/USDC pool liquidity drops ≥20%",
      recipeId: "pool_liquidity_shock",
      params: {
        poolAddress: "0x6c561b446416e1a00e8e93e221854d6ea4171372",
        dropPct: 0.2,
        minReserveUsd: 0,
      },
      trigger: { type: "event", event: "pool_liquidity_shock", intervalSec: 120 },
      action: { type: "alert" },
    },
  },
  {
    id: "copy-eth-usdc-wallet",
    name: "Copy wallet (ETH↔USDC)",
    blurb: "Propose a capped ETH swap when a watched wallet looks like it traded.",
    description:
      "Polls a target wallet’s ETH(+WETH) and USDC. When balances move like a swap above minUsd, proposes a capped mirror (fail-closed). Not HFT — lag equals your poll interval. Replace the demo targetAddress before Arming; needs spend enabled.",
    chainIds: DEX_TEMPLATE_CHAINS,
    tags: ["trade", "copy", "propose"],
    editableKeys: ["targetAddress", "amountUsd", "minUsd"],
    draft: {
      summary: "Propose copy ETH↔USDC when target moves ≥$100 (~$10 max)",
      recipeId: "copy_wallet_propose",
      params: {
        targetAddress: "0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045",
        amountUsd: 10,
        minUsd: 100,
      },
      trigger: { type: "event", event: "target_trade_seen", intervalSec: 60 },
      action: { type: "propose_trade" },
      caps: { maxTradeUsd: 10 },
    },
  },
  {
    id: "arc-eurc-dip-buy",
    name: "Arc EURC dip buy",
    blurb: "Propose a capped USDC→EURC buy on Arc when EURC USD dips.",
    description:
      "Stablecoin FX on Arc Testnet via Circle Swap Kit (not 0x). When EURC USD crosses below your level, proposes a capped USDC→EURC swap. Fund Arc USDC from the Circle faucet for testnet. Import sets a draft; Arm to run.",
    chainIds: ARC_TEMPLATE_CHAINS,
    tags: ["trade", "fx", "arc", "circle"],
    editableKeys: ["level", "amountUsd", "direction", "side"],
    draft: {
      summary: "Propose buy EURC on Arc when price crosses below $1.05 (~$10 USDC)",
      recipeId: "price_cross_swap",
      params: {
        symbol: "EURC",
        level: 1.05,
        direction: "below",
        side: "buy",
        amountUsd: 10,
      },
      trigger: { type: "event", event: "price_cross", intervalSec: 60 },
      action: { type: "propose_trade" },
      caps: { maxTradeUsd: 10 },
    },
  },
  {
    id: "robinhood-top-token-flow",
    name: "Robinhood top-token flow",
    blurb: "Alert when Substreams ranks a hot token from swaps + transfers.",
    description:
      "For a “top tokens on Robinhood Chain” desk: deploy an Event Pipeline (@pipeline / /event-pipeline) that indexes Uniswap swaps, token transfers, pool liquidity, metadata, and holder/buyer activity. Then Arm this recipe with the returned pipelineId. The host watches token_flow_hit edges from the studio stream head — not GeckoTerminal (unsupported on Robinhood).",
    chainIds: ROBINHOOD_TEMPLATE_CHAINS,
    tags: ["alert", "substreams", "robinhood", "tokens"],
    editableKeys: ["pipelineId", "minVolumeUsd", "minScore"],
    draft: {
      summary:
        "Alert when Robinhood token-flow pipeline hits volume ≥$75k or score ≥120",
      recipeId: "token_flow_alert",
      params: {
        // Replace after deploy_event_pipeline returns pipelineId.
        pipelineId: "pipe_replace_me",
        minVolumeUsd: 75_000,
        minScore: 120,
      },
      trigger: { type: "event", event: "token_flow_hit", intervalSec: 60 },
      action: { type: "alert" },
    },
  },
] as const;

export type StrategyTemplateId = (typeof STRATEGY_TEMPLATES)[number]["id"];

export function isStrategyTemplateId(
  value: unknown,
): value is StrategyTemplateId {
  return (
    typeof value === "string" &&
    STRATEGY_TEMPLATES.some((template) => template.id === value)
  );
}

export function getStrategyTemplate(
  id: string,
): StrategyTemplate | undefined {
  return STRATEGY_TEMPLATES.find((template) => template.id === id);
}

/** True when the template is offered for this home chain. */
export function templateMatchesChain(
  template: StrategyTemplate,
  chainId: number,
): boolean {
  if (template.chainIds.length === 0) return isSupportedChainId(chainId);
  return template.chainIds.includes(chainId as SupportedChainId);
}

export function listStrategyTemplates(
  chainId?: number,
): StrategyTemplate[] {
  if (chainId === undefined) return [...STRATEGY_TEMPLATES];
  return STRATEGY_TEMPLATES.filter((template) =>
    templateMatchesChain(template, chainId),
  );
}

/**
 * Build a validated strategy draft from a template + optional param overrides.
 * Returns null when the template is missing or overrides fail recipe validation.
 */
export function buildDraftFromTemplate(
  templateId: string,
  paramOverrides?: Record<string, unknown> | null,
): UpsertStrategyDraftInput | null {
  const template = getStrategyTemplate(templateId);
  if (!template) return null;

  const params = {
    ...template.draft.params,
    ...(paramOverrides ?? {}),
  };

  // Keep summary in sync for common editable knobs when the user tweaks them.
  let summary = template.draft.summary;
  if (template.id === "eth-dip-alert" && params.level !== undefined) {
    const level = Number(params.level);
    const direction =
      params.direction === "above"
        ? "above"
        : params.direction === "either"
          ? "either side of"
          : "below";
    if (Number.isFinite(level)) {
      summary = `Alert when ETH crosses ${direction} $${Math.round(level).toLocaleString()}`;
    }
  } else if (template.id === "eth-price-band") {
    const low = Number(params.low);
    const high = Number(params.high);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      summary = `Alert when ETH leaves $${Math.round(low).toLocaleString()}–$${Math.round(high).toLocaleString()}`;
    }
  } else if (template.id === "native-low-balance") {
    const threshold = Number(params.threshold);
    if (Number.isFinite(threshold)) {
      summary = `Alert when native balance drops below ${threshold}`;
    }
  } else if (template.id === "eth-dip-buy") {
    const level = Number(params.level);
    const amountUsd = Number(params.amountUsd);
    const side = params.side === "sell" ? "sell" : "buy";
    const direction =
      params.direction === "above"
        ? "above"
        : params.direction === "either"
          ? "either side of"
          : "below";
    if (Number.isFinite(level)) {
      const size =
        Number.isFinite(amountUsd) && amountUsd > 0
          ? ` (~$${Math.round(amountUsd).toLocaleString()})`
          : "";
      summary = `Propose ${side} ETH when price crosses ${direction} $${Math.round(level).toLocaleString()}${size}`;
    }
  } else if (template.id === "arc-eurc-dip-buy") {
    const level = Number(params.level);
    const amountUsd = Number(params.amountUsd);
    const side = params.side === "sell" ? "sell" : "buy";
    const direction =
      params.direction === "above"
        ? "above"
        : params.direction === "either"
          ? "either side of"
          : "below";
    if (Number.isFinite(level)) {
      const size =
        Number.isFinite(amountUsd) && amountUsd > 0
          ? ` (~$${Math.round(amountUsd).toLocaleString()} USDC)`
          : "";
      summary = `Propose ${side} EURC on Arc when price crosses ${direction} $${level.toFixed(2)}${size}`;
    }
  } else if (template.id === "eth-tp-stop") {
    const takeProfit = Number(params.takeProfit);
    const stopLoss = Number(params.stopLoss);
    const amountUsd = Number(params.amountUsd);
    const side = params.side === "buy" ? "buy" : "sell";
    if (Number.isFinite(takeProfit) && Number.isFinite(stopLoss)) {
      const size =
        Number.isFinite(amountUsd) && amountUsd > 0
          ? ` (~$${Math.round(amountUsd).toLocaleString()})`
          : "";
      summary = `Propose ${side} ETH at TP $${Math.round(takeProfit).toLocaleString()} or stop $${Math.round(stopLoss).toLocaleString()}${size}`;
    }
  } else if (template.id === "eth-usdc-rebalance") {
    const target = Number(params.targetEthPct);
    const band = Number(params.bandPct);
    const amountUsd = Number(params.amountUsd);
    if (Number.isFinite(target) && Number.isFinite(band)) {
      const low = Math.round(Math.max(0, target - band) * 100);
      const high = Math.round(Math.min(1, target + band) * 100);
      const size =
        Number.isFinite(amountUsd) && amountUsd > 0
          ? ` (~$${Math.round(amountUsd).toLocaleString()} max)`
          : "";
      summary = `Propose ETH/USDC rebalance when ETH share leaves ${low}–${high}%${size}`;
    }
  } else if (template.id === "usdc-depeg-watch") {
    const low = Number(params.low);
    const high = Number(params.high);
    if (Number.isFinite(low) && Number.isFinite(high)) {
      summary = `Alert when USDC leaves $${low.toFixed(2)}–$${high.toFixed(2)}`;
    }
  } else if (template.id === "base-weth-usdc-liq") {
    const dropPct = Number(params.dropPct);
    if (Number.isFinite(dropPct) && dropPct > 0) {
      summary = `Alert when Base WETH/USDC pool liquidity drops ≥${Math.round(dropPct * 100)}%`;
    }
  } else if (template.id === "copy-eth-usdc-wallet") {
    const amountUsd = Number(params.amountUsd);
    const minUsd = Number(params.minUsd);
    const target =
      typeof params.targetAddress === "string" && params.targetAddress.length > 10
        ? `${params.targetAddress.slice(0, 6)}…${params.targetAddress.slice(-4)}`
        : "target";
    const size =
      Number.isFinite(amountUsd) && amountUsd > 0
        ? ` (~$${Math.round(amountUsd).toLocaleString()} max)`
        : "";
    const floor =
      Number.isFinite(minUsd) && minUsd > 0
        ? `≥$${Math.round(minUsd).toLocaleString()}`
        : "ETH↔USDC";
    summary = `Propose copy of ${target} when move ${floor}${size}`;
  }

  return parseStrategyDraftInput({
    ...template.draft,
    summary,
    params,
  });
}
