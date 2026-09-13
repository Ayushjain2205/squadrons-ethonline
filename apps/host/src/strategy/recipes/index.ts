import type {
  RecipeId,
  StrategyTickDecision,
} from "@squadrons/shared";
import { executeBalanceThresholdAlert } from "./balance-threshold.js";
import { executeCopyWalletPropose } from "./copy-wallet.js";
import { executeInventoryRebalance } from "./inventory-rebalance.js";
import { executePoolLiquidityShock } from "./pool-liquidity.js";
import { executePriceBandAlert } from "./price-band.js";
import {
  executePriceCrossAlert,
  executePriceCrossSwap,
} from "./price-cross.js";
import { executeStableDepegAlert } from "./stable-depeg.js";
import { executeTakeProfitStop } from "./take-profit-stop.js";
import { executeTokenFlowAlert } from "./token-flow.js";
import type { RecipeContext } from "./types.js";

export type { RecipeContext } from "./types.js";

export type RecipeExecutor = (
  ctx: RecipeContext,
) => Promise<StrategyTickDecision>;

const EXECUTORS: Record<RecipeId, RecipeExecutor> = {
  balance_threshold_alert: executeBalanceThresholdAlert,
  price_band_alert: executePriceBandAlert,
  price_cross_alert: executePriceCrossAlert,
  price_cross_swap: executePriceCrossSwap,
  take_profit_stop: executeTakeProfitStop,
  inventory_rebalance: executeInventoryRebalance,
  stable_depeg_alert: executeStableDepegAlert,
  pool_liquidity_shock: executePoolLiquidityShock,
  copy_wallet_propose: executeCopyWalletPropose,
  token_flow_alert: executeTokenFlowAlert,
};

export function hasRecipeExecutor(recipeId: RecipeId | null): boolean {
  return recipeId != null && recipeId in EXECUTORS;
}

export async function executeStrategyRecipe(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const recipeId = ctx.strategy.recipeId;
  if (!recipeId || !EXECUTORS[recipeId]) {
    throw new Error(
      recipeId
        ? `No executor for recipe ${recipeId}`
        : "Strategy has no recipeId",
    );
  }
  return EXECUTORS[recipeId](ctx);
}
