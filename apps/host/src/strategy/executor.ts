import {
  DEFAULT_POLICY,
  canBroadcastTrades,
  canProposeTrades,
  chainLabel,
  type Agent,
  type Strategy,
  type StrategyTradeIntent,
} from "@squadrons/shared";
import { buildApproveFromSwap } from "./approve.js";
import {
  broadcastEvmTx,
  canBroadcast,
} from "./broadcast.js";
import {
  buildSwapFromPlan,
  isSwapProviderConfigured,
  supportsDexQuote,
  type BuiltSwap,
  type BuiltSwapTx,
  type TradePlan,
} from "./swap-build.js";
import {
  executeCircleSwap,
  usesCircleSwapKit,
} from "./circle-swap.js";
import { isTenderlyConfigured, simulateSwapTx } from "./tenderly.js";
import { waitForTxReceipt } from "./tx-wait.js";

/** Host execution ceiling — ops kill switch over desk runMode. */
export type ExecutionMode = "off" | "dry_run" | "live";

/**
 * How to treat ERC-20 allowance on the live path.
 * - prompt: pause and ask the desk (default for autonomous ticks)
 * - approved: user already approved in chat — broadcast approve then swap
 */
export type AllowanceDecision = "prompt" | "approved";

export type { TradePlan };
export type ExecuteTradeResult =
  | {
      status: "proposed";
      detail: string;
      plan: TradePlan;
      swap?: BuiltSwap;
    }
  | {
      status: "dry_run";
      detail: string;
      plan: TradePlan;
      swap?: BuiltSwap;
    }
  | {
      status: "awaiting_allowance";
      detail: string;
      plan: TradePlan;
      swap: BuiltSwap;
    }
  | {
      status: "failed";
      reason: string;
      detail: string;
      plan: TradePlan;
      swap?: BuiltSwap;
    }
  | {
      status: "submitted";
      detail: string;
      plan: TradePlan;
      swap: BuiltSwap;
      txHash: string;
      approveTxHash?: string;
    };

export function getExecutionMode(): ExecutionMode {
  const raw = process.env.SQUADRONS_EXECUTION_MODE?.trim().toLowerCase();
  if (raw === "off" || raw === "dry_run" || raw === "live") return raw;
  return "dry_run";
}

/** True when the host ceiling allows desk Live mode. */
export function hostAllowsLive(): boolean {
  return getExecutionMode() === "live";
}

/**
 * Resolve paper vs live for an agent under the host ceiling.
 * - paper → dry_run (quote, no broadcast)
 * - live only when agent is live AND host ceiling is live
 * - host off → queue only (no quote)
 */
export function resolveTradeExecutionMode(agent: Agent): ExecutionMode {
  const host = getExecutionMode();
  if (host === "off") return "off";
  if (canBroadcastTrades(agent.runMode) && host === "live") return "live";
  return "dry_run";
}

function buildPlan(input: {
  agent: Agent;
  intent: StrategyTradeIntent;
  walletAddress: string | null;
}): TradePlan {
  return {
    chainId: input.agent.chainId,
    walletAddress: input.walletAddress,
    amountUsd: input.intent.amountUsd,
    symbol: input.intent.symbol ?? null,
    side: input.intent.side ?? null,
    maxSlippageBps: DEFAULT_POLICY.maxSlippageBps,
  };
}

function describePlan(plan: TradePlan): string {
  const side = plan.side ?? "trade";
  const symbol = plan.symbol ? ` ${plan.symbol}` : "";
  return `${side} $${plan.amountUsd}${symbol} on chain ${plan.chainId}`;
}

async function maybeSimulate(input: {
  chainId: number;
  from: string;
  tx: BuiltSwapTx;
}): Promise<{ ok: true; detail: string } | { ok: false; reason: string }> {
  if (!isTenderlyConfigured()) {
    return { ok: true, detail: "Tenderly skipped (not configured)" };
  }
  const sim = await simulateSwapTx(input);
  if (!sim.ok) return sim;
  return { ok: true, detail: sim.detail };
}

/**
 * Execute a gated trade intent under agent runMode + host ceiling.
 * Live ticks that need ERC-20 allowance pause for chat approval by default.
 */
export async function executeGatedTrade(input: {
  agent: Agent;
  strategy: Strategy;
  intent: StrategyTradeIntent;
  walletAddress: string | null;
  walletId?: string | null;
  allowanceDecision?: AllowanceDecision;
}): Promise<ExecuteTradeResult> {
  const plan = buildPlan(input);
  const mode = resolveTradeExecutionMode(input.agent);
  const summary = describePlan(plan);
  const allowanceDecision = input.allowanceDecision ?? "prompt";

  if (!canProposeTrades(input.agent.runMode)) {
    return {
      status: "failed",
      reason: "Agent is observe-only",
      detail: `Blocked after gate: ${summary}`,
      plan,
    };
  }
  if (input.strategy.action.type !== "propose_trade") {
    return {
      status: "failed",
      reason: "Strategy is alert-only",
      detail: `Blocked after gate: ${summary}`,
      plan,
    };
  }
  if (!(plan.amountUsd > 0) || plan.amountUsd > DEFAULT_POLICY.maxTradeUsd) {
    return {
      status: "failed",
      reason: `Amount outside $${DEFAULT_POLICY.maxTradeUsd} policy`,
      detail: `Blocked after gate: ${summary}`,
      plan,
    };
  }

  if (mode === "off") {
    return {
      status: "proposed",
      detail: `Queued only (${summary}) — execution mode off`,
      plan,
    };
  }

  if (mode === "dry_run") {
    const paperNote =
      input.agent.runMode === "live" && getExecutionMode() !== "live"
        ? " · host ceiling is paper-only"
        : "";
    if (!isSwapProviderConfigured(plan.chainId)) {
      const need = usesCircleSwapKit(plan.chainId)
        ? "Circle Swap Kit"
        : "ZEROEX_API_KEY";
      return {
        status: "dry_run",
        detail: `Paper: would ${summary} (no broadcast; configure ${need} to quote)${paperNote}`,
        plan,
      };
    }
    const quoted = await buildSwapFromPlan(plan);
    if (!quoted.ok) {
      return {
        status: "dry_run",
        detail: `Paper: would ${summary} — quote skipped (${quoted.reason})${paperNote}`,
        plan,
      };
    }
    const provider =
      quoted.swap.provider === "circle-swap-kit" ? "Circle Swap Kit" : "0x";
    const approveNote = quoted.swap.needsAllowance
      ? " · would ask chat to approve ERC-20 spend first"
      : quoted.swap.provider === "circle-swap-kit"
        ? " · Circle Kit handles approve on live"
        : "";
    return {
      status: "dry_run",
      detail: `Paper fill: quoted ${summary} via ${provider} (no broadcast)${approveNote}${paperNote}`,
      plan,
      swap: quoted.swap,
    };
  }

  if (!supportsDexQuote(plan.chainId)) {
    return {
      status: "failed",
      reason: `Live execution needs a swap provider on this home chain (unsupported: ${chainLabel(plan.chainId)} / ${plan.chainId})`,
      detail: `Live blocked: ${summary}`,
      plan,
    };
  }

  if (!plan.walletAddress) {
    return {
      status: "failed",
      reason: "No wallet address for live execution",
      detail: `Live blocked: ${summary}`,
      plan,
    };
  }

  const walletId = input.walletId?.trim() || null;
  if (!walletId) {
    return {
      status: "failed",
      reason:
        "No Privy wallet id on user — re-login after enabling embedded wallet API access",
      detail: `Live blocked: ${summary}`,
      plan,
    };
  }

  if (!canBroadcast()) {
    return {
      status: "failed",
      reason:
        "PRIVY_AUTHORIZATION_PRIVATE_KEY is not set — required for live broadcast",
      detail: `Live blocked at broadcast: ${summary}`,
      plan,
    };
  }

  // Arc / Circle Swap Kit — kit.swap handles approve + broadcast via Privy.
  if (usesCircleSwapKit(plan.chainId)) {
    const executed = await executeCircleSwap({ plan, walletId });
    if (!executed.ok) {
      return {
        status: "failed",
        reason: executed.reason,
        detail: `Live blocked at Circle Swap Kit: ${summary}`,
        plan,
        ...(executed.swap ? { swap: executed.swap } : {}),
      };
    }
    return {
      status: "submitted",
      detail: `Live: ${summary} · ${executed.detail}`,
      plan,
      swap: executed.swap,
      txHash: executed.txHash,
    };
  }

  let built = await buildSwapFromPlan(plan);
  if (!built.ok) {
    return {
      status: "failed",
      reason: built.reason,
      detail: `Live blocked at swap build: ${summary}`,
      plan,
    };
  }

  let approveTxHash: string | undefined;
  let approveDetail = "no approve needed";

  if (built.swap.needsAllowance) {
    if (allowanceDecision === "prompt") {
      return {
        status: "awaiting_allowance",
        detail: `Needs chat approval to allow token spend for ${summary}`,
        plan,
        swap: built.swap,
      };
    }

    const approveBuilt = buildApproveFromSwap(built.swap);
    if (!approveBuilt.ok) {
      return {
        status: "failed",
        reason: approveBuilt.reason,
        detail: `Live blocked at approve build: ${summary}`,
        plan,
        swap: built.swap,
      };
    }

    const approveSim = await maybeSimulate({
      chainId: plan.chainId,
      from: plan.walletAddress,
      tx: approveBuilt.approve.transaction,
    });
    if (!approveSim.ok) {
      return {
        status: "failed",
        reason: approveSim.reason,
        detail: `Live blocked at approve Tenderly: ${summary}`,
        plan,
        swap: built.swap,
      };
    }

    const approveSent = await broadcastEvmTx({
      walletId,
      chainId: plan.chainId,
      tx: approveBuilt.approve.transaction,
    });
    if (!approveSent.ok) {
      return {
        status: "failed",
        reason: approveSent.reason,
        detail: `Live blocked at approve broadcast: ${summary}`,
        plan,
        swap: built.swap,
      };
    }
    approveTxHash = approveSent.txHash;
    approveDetail = `approve ${approveSent.txHash}`;

    const receipt = await waitForTxReceipt({
      chainId: plan.chainId,
      txHash: approveSent.txHash,
    });
    if (!receipt.ok) {
      return {
        status: "failed",
        reason: receipt.reason,
        detail: `Live blocked waiting for approve: ${summary} · ${approveDetail}`,
        plan,
        swap: built.swap,
      };
    }
    if (receipt.status === "reverted") {
      return {
        status: "failed",
        reason: "Approve transaction reverted",
        detail: `Live blocked at approve: ${summary} · ${approveDetail}`,
        plan,
        swap: built.swap,
      };
    }

    built = await buildSwapFromPlan(plan);
    if (!built.ok) {
      return {
        status: "failed",
        reason: built.reason,
        detail: `Live blocked at re-quote after approve: ${summary} · ${approveDetail}`,
        plan,
      };
    }
    if (built.swap.needsAllowance) {
      return {
        status: "failed",
        reason: "Allowance still required after approve",
        detail: `Live blocked at re-quote: ${summary} · ${approveDetail}`,
        plan,
        swap: built.swap,
      };
    }
  }

  const swapSim = await maybeSimulate({
    chainId: plan.chainId,
    from: plan.walletAddress,
    tx: built.swap.transaction,
  });
  if (!swapSim.ok) {
    return {
      status: "failed",
      reason: swapSim.reason,
      detail: `Live blocked at Tenderly: ${summary} · ${approveDetail}`,
      plan,
      swap: built.swap,
    };
  }

  const sent = await broadcastEvmTx({
    walletId,
    chainId: plan.chainId,
    tx: built.swap.transaction,
  });
  if (!sent.ok) {
    return {
      status: "failed",
      reason: sent.reason,
      detail: `Live blocked at broadcast: ${summary} · ${approveDetail} · ${swapSim.detail}`,
      plan,
      swap: built.swap,
    };
  }

  return {
    status: "submitted",
    detail: `Submitted ${summary} · ${sent.detail} · ${approveDetail} · ${swapSim.detail}`,
    plan,
    swap: built.swap,
    txHash: sent.txHash,
    ...(approveTxHash ? { approveTxHash } : {}),
  };
}
