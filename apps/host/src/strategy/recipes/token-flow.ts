import type { StrategyTickDecision } from "@squadrons/shared";
import { applyStrategyAction } from "./action.js";
import {
  formatTokenFlowDetail,
  sampleTokenFlowHead,
} from "../pipeline-head.js";
import type { RecipeContext } from "./types.js";

/** Alert when a Substreams token-flow pipeline ranks a hot token. */
export async function executeTokenFlowAlert(
  ctx: RecipeContext,
): Promise<StrategyTickDecision> {
  const params = ctx.strategy.params;
  const pipelineId =
    typeof params.pipelineId === "string" && params.pipelineId.trim()
      ? params.pipelineId.trim()
      : "";
  if (!pipelineId) {
    return {
      action: "alert",
      label: "Token flow skipped",
      detail: "Missing pipelineId — deploy_event_pipeline first",
    };
  }

  const minVolumeUsd = Number(params.minVolumeUsd);
  const minScore = Number(params.minScore);
  const head = sampleTokenFlowHead(pipelineId, ctx.agent.chainId);
  const detail = formatTokenFlowDetail(head);
  const { leader } = head;

  const hitVolume =
    Number.isFinite(minVolumeUsd) &&
    minVolumeUsd > 0 &&
    leader.volumeUsd >= minVolumeUsd;
  const hitScore =
    Number.isFinite(minScore) && minScore > 0 && leader.score >= minScore;

  if (!hitVolume && !hitScore) {
    return {
      action: "none",
      label: "Checked token flow",
      detail,
    };
  }

  return applyStrategyAction(
    ctx,
    {
      action: "alert",
      label: `${leader.symbol} token-flow hit`,
      detail,
    },
    {
      symbol: leader.symbol,
      side: "buy",
    },
  );
}
