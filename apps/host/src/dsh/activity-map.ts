import {
  activityStepLabel,
  isBacktestToolName,
  isChainSearchPublishToolName,
  isSubstreamsDeployToolName,
  type ActivityKind,
} from "@squadrons/shared";
import type { NewActivityEvent } from "../agents/activity.js";

export type HarnessNotification = {
  method: string;
  params: Record<string, unknown>;
};

/** Last tool/call name per agent — tool/result error payloads often omit `name`. */
const lastToolCallName = new Map<string, string>();

function sessionEvent(notification: HarnessNotification): {
  type?: string;
  data: Record<string, unknown>;
} | null {
  if (notification.method !== "session.event") return null;
  const event = notification.params.event;
  if (!event || typeof event !== "object") return null;
  const typed = event as { type?: string; data?: Record<string, unknown> };
  return { type: typed.type, data: typed.data ?? {} };
}

function toolNameFromData(data: Record<string, unknown>): string | null {
  if (typeof data.name === "string" && data.name.trim()) return data.name;
  const message = data.message as { name?: string } | undefined;
  if (typeof message?.name === "string" && message.name.trim()) {
    return message.name;
  }
  if (typeof data.toolName === "string" && data.toolName.trim()) {
    return data.toolName;
  }
  const tool = data.tool as { name?: string } | undefined;
  if (typeof tool?.name === "string" && tool.name.trim()) return tool.name;
  return null;
}

function errorDetail(data: Record<string, unknown>): string | null {
  const error = data.error;
  if (typeof error === "string" && error.trim()) return error.trim();
  if (error && typeof error === "object") {
    const message = (error as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message.trim();
  }
  return null;
}

/**
 * True when dsh reports a successful propose_strategy tool result.
 * Used to sync workspace drafts into SQLite mid-turn.
 */
export function isSuccessfulProposeStrategyResult(
  notification: HarnessNotification,
): boolean {
  const event = sessionEvent(notification);
  if (!event || event.type !== "tool/result") return false;
  if (event.data.error) return false;
  return toolNameFromData(event.data) === "propose_strategy";
}

/** True when dsh reports a successful update_strategy_params tool result. */
export function isSuccessfulUpdateStrategyParamsResult(
  notification: HarnessNotification,
): boolean {
  const event = sessionEvent(notification);
  if (!event || event.type !== "tool/result") return false;
  if (event.data.error) return false;
  return toolNameFromData(event.data) === "update_strategy_params";
}

/** True when dsh reports a successful propose_improvement tool result. */
export function isSuccessfulProposeImprovementResult(
  notification: HarnessNotification,
): boolean {
  const event = sessionEvent(notification);
  if (!event || event.type !== "tool/result") return false;
  if (event.data.error) return false;
  return toolNameFromData(event.data) === "propose_improvement";
}

/** True when dsh reports a successful run_backtest tool result. */
export function isSuccessfulRunBacktestResult(
  agentId: string,
  notification: HarnessNotification,
): boolean {
  return backtestToolNameFromNotification(agentId, notification) != null;
}

/** True when dsh reports a successful publish_chain_search tool result. */
export function isSuccessfulPublishChainSearchResult(
  agentId: string,
  notification: HarnessNotification,
): boolean {
  return chainSearchPublishToolNameFromNotification(agentId, notification) != null;
}

/** True when dsh reports a successful deploy_event_pipeline tool result. */
export function isSuccessfulDeployEventPipelineResult(
  agentId: string,
  notification: HarnessNotification,
): boolean {
  return substreamsDeployToolNameFromNotification(agentId, notification) != null;
}

/**
 * Resolve backtest tool name from a notification (for per-agent last-call fallback).
 */
export function backtestToolNameFromNotification(
  agentId: string,
  notification: HarnessNotification,
): string | null {
  const event = sessionEvent(notification);
  if (!event || event.type !== "tool/result") return null;
  if (event.data.error) return null;
  const name =
    toolNameFromData(event.data) ?? lastToolCallName.get(agentId) ?? null;
  return isBacktestToolName(name) ? name : null;
}

export function chainSearchPublishToolNameFromNotification(
  agentId: string,
  notification: HarnessNotification,
): string | null {
  const event = sessionEvent(notification);
  if (!event || event.type !== "tool/result") return null;
  if (event.data.error) return null;
  const name =
    toolNameFromData(event.data) ?? lastToolCallName.get(agentId) ?? null;
  return isChainSearchPublishToolName(name) ? name : null;
}

export function substreamsDeployToolNameFromNotification(
  agentId: string,
  notification: HarnessNotification,
): string | null {
  const event = sessionEvent(notification);
  if (!event || event.type !== "tool/result") return null;
  if (event.data.error) return null;
  const name =
    toolNameFromData(event.data) ?? lastToolCallName.get(agentId) ?? null;
  return isSubstreamsDeployToolName(name) ? name : null;
}

/**
 * Map a dsh notification into at most one highly abstracted activity step.
 * Grok Bot–style: human verbs only — no turn markers, no args, no result dumps.
 * Exception: selected UI artifacts (backtest chart / chain search) forward as tool_result.
 */
export function mapNotificationToActivity(
  agentId: string,
  notification: HarnessNotification,
): NewActivityEvent | null {
  const event = sessionEvent(notification);
  if (!event) return null;
  const { type, data } = event;

  switch (type) {
    case "tool/call": {
      const name = toolNameFromData(data) ?? "tool";
      lastToolCallName.set(agentId, name);
      return {
        agentId,
        kind: "tool_call" satisfies ActivityKind,
        label: activityStepLabel(name),
        detail: null,
        toolName: name,
      };
    }
    case "tool/result": {
      const name =
        toolNameFromData(data) ?? lastToolCallName.get(agentId) ?? "tool";

      if (data.error) {
        return {
          agentId,
          kind: "error" satisfies ActivityKind,
          label: `${activityStepLabel(name)} failed`,
          detail: errorDetail(data),
          toolName: name,
        };
      }

      // Backtest / chain-search / substreams cards are published from workspace
      // file sync in routes.ts (dsh tool/result payloads don't reliably include
      // the structured artifact).
      return null;
    }
    case "turn/end": {
      const reason = data.reason as {
        kind?: string;
        error?: { message?: string };
      } | undefined;
      if (reason?.kind !== "error") return null;
      const message =
        typeof reason.error?.message === "string" && reason.error.message.trim()
          ? reason.error.message.trim()
          : null;
      return {
        agentId,
        kind: "error",
        label: "Something went wrong",
        detail: message,
      };
    }
    default:
      return null;
  }
}
