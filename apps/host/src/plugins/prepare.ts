import { existsSync } from "node:fs";
import path from "node:path";
import { resolveDshHome } from "../dsh/preflight.js";
import type { AgentPluginStore } from "./store.js";
import { buildAgentMcpPatch } from "./mcp-patch.js";
import { isChainSearchAvailable } from "./graph-gateway.js";

export type PreparedAgentPlugins = {
  patches: string[];
  pluginEnv: Record<string, string>;
  pluginsHash: string;
  /** Catalog / custom display names for the identity prompt. */
  enabledNames: string[];
};

function mcpBridgeRevision(): string {
  const dshHome = resolveDshHome();
  const mcpClient = existsSync(
    path.join(dshHome, "profiles/sdk/node_modules/@deepseek-ai/dsh-mcp-client"),
  );
  const backtest = existsSync(
    path.join(dshHome, "profiles/sdk/node_modules/squadrons-backtest"),
  );
  const chainSearch = existsSync(
    path.join(dshHome, "profiles/sdk/node_modules/squadrons-chain-search"),
  );
  const substreams = existsSync(
    path.join(dshHome, "profiles/sdk/node_modules/squadrons-substreams"),
  );
  const graph = isChainSearchAvailable() ? "g1" : "g0";
  // Bump when first-party plugin loading changes so pooled harnesses rebuild.
  return `plugins-${mcpClient ? "mcp1" : "mcp0"}-${backtest ? "bt3" : "bt0"}-${chainSearch ? "cs1" : "cs0"}-${substreams ? "ss1" : "ss0"}-${graph}`;
}

/** Resolve enabled MCP plugins into Cordis patch + env for a dsh turn. */
export async function prepareAgentPlugins(
  plugins: AgentPluginStore,
  agentId: string,
  workspace: string,
): Promise<PreparedAgentPlugins> {
  const runtime = plugins.listEnabledRuntime(agentId);
  const { patchPath, env } = await buildAgentMcpPatch(workspace, runtime);
  const enabledNames = runtime.map((p) => p.name);
  if (!enabledNames.includes("Backtest")) {
    enabledNames.push("Backtest");
  }
  if (!enabledNames.includes("Social Search")) {
    enabledNames.push("Social Search");
  }
  if (isChainSearchAvailable() && !enabledNames.includes("Chain Search")) {
    enabledNames.push("Chain Search");
  }
  return {
    patches: patchPath ? [patchPath] : [],
    pluginEnv: env,
    pluginsHash: `${plugins.configHash(agentId)}:${mcpBridgeRevision()}`,
    enabledNames,
  };
}
