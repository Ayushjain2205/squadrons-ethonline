/** Curated + custom MCP plugins attached per agent. */

export type McpTransport = "stdio" | "streamable-http";

export type PluginKind = "catalog" | "custom";

/** One secret the operator must supply for a catalog (or custom) plugin. */
export type PluginSecretSpec = {
  /** Stable key used in storage / env injection (e.g. API_KEY). */
  key: string;
  /** Desk label. */
  label: string;
  /**
   * When set, host injects the secret as this HTTP header on streamable-http.
   * Otherwise it is injected as a process env var for stdio servers.
   */
  headerName?: string;
  /** Env var name for stdio (defaults to key when omitted). */
  envName?: string;
};

/** Product catalog entry — global menu, enabled per agent. */
export type McpCatalogEntry = {
  id: string;
  name: string;
  /** One-line desk blurb (marketplace row). */
  description: string;
  /** Brand mark id for the desk icon. */
  icon: string;
  /** Accent behind the brand mark. */
  accent: string;
  /** dsh-mcp-client serverName → tools as mcp__<serverName>__… */
  serverName: string;
  transport: McpTransport;
  /** streamable-http endpoint */
  url?: string;
  /** Extra static headers (no secrets). */
  headers?: Record<string, string>;
  /** stdio spawn (rare for curated crypto MCPs). */
  command?: string;
  args?: string[];
  secrets: PluginSecretSpec[];
  docsUrl?: string;
  /**
   * Platform-included capability (host-provisioned). No per-user install/key.
   * Desk shows as Included; host injects tools when configured.
   */
  builtin?: boolean;
};

/**
 * Curated crypto MCP servers. Enable per agent + paste API key.
 * Builtin entries are host-provisioned (no user secrets).
 */
export const MCP_CATALOG: readonly McpCatalogEntry[] = [
  {
    id: "chain-search",
    name: "Chain Search",
    description:
      "Onchain search via The Graph — find subgraphs, pools, and indexed data",
    icon: "graph",
    accent: "#6747FF",
    // @search mention token; live tools are mcp__subgraph__* from host MCP.
    serverName: "search",
    transport: "stdio",
    command: "chain-search",
    args: [],
    secrets: [],
    builtin: true,
    docsUrl: "https://thegraph.com/docs/en/ai-overview/",
  },
  {
    id: "substreams",
    name: "Event Pipeline",
    description:
      "Author and deploy Substreams pipelines for onchain strategy listeners",
    icon: "pipeline",
    accent: "#5dcea0",
    serverName: "pipeline",
    transport: "stdio",
    command: "squadrons-substreams",
    args: [],
    secrets: [],
    builtin: true,
    docsUrl: "https://thegraph.com/docs/en/substreams/tooling/skills/",
  },
  {
    id: "backtest",
    name: "Backtest",
    description: "Simulated equity curves for strategy ideas (chart in chat)",
    icon: "backtest",
    accent: "#5dcea0",
    serverName: "backtest",
    // Desk still treats this as a catalog plugin; host loads it as Cordis tools
    // (not remote MCP) when enabled — see mcp-patch.ts.
    transport: "stdio",
    command: "squadrons-backtest",
    args: [],
    secrets: [],
  },
  {
    id: "dune",
    name: "Dune",
    description: "SQL, datasets, and onchain dashboards",
    icon: "dune",
    accent: "#F0B90B",
    serverName: "dune",
    transport: "streamable-http",
    url: "https://api.dune.com/mcp/v1",
    secrets: [
      {
        key: "API_KEY",
        label: "API key",
        headerName: "x-dune-api-key",
      },
    ],
    docsUrl: "https://docs.dune.com/docs/agents/mcp",
  },
  {
    id: "nansen",
    name: "Nansen",
    description: "Wallet and token intelligence",
    icon: "nansen",
    accent: "#7C5CFF",
    serverName: "nansen",
    transport: "streamable-http",
    url: "https://mcp.nansen.ai/ra/mcp",
    headers: {
      Accept: "application/json, text/event-stream",
    },
    secrets: [
      {
        key: "API_KEY",
        label: "API key",
        headerName: "NANSEN-API-KEY",
      },
    ],
    docsUrl: "https://docs.nansen.ai/mcp/connecting",
  },
] as const;

export type McpCatalogId = (typeof MCP_CATALOG)[number]["id"];

export function getMcpCatalogEntry(
  id: string,
): McpCatalogEntry | undefined {
  return MCP_CATALOG.find((entry) => entry.id === id);
}

export function isMcpCatalogId(id: unknown): id is McpCatalogId {
  return typeof id === "string" && MCP_CATALOG.some((e) => e.id === id);
}

export function isBuiltinCatalogPlugin(id: string | null | undefined): boolean {
  if (!id) return false;
  return Boolean(getMcpCatalogEntry(id)?.builtin);
}

/** Custom MCP connection config (no secrets — those are stored separately). */
export type CustomMcpConfig = {
  transport: McpTransport;
  /** streamable-http */
  url?: string;
  /** Map secret key → header name for HTTP auth. */
  headerSecretKeys?: Record<string, string>;
  /** stdio */
  command?: string;
  args?: string[];
  /** Map secret key → env var name for stdio. */
  envSecretKeys?: Record<string, string>;
};

/**
 * Agent plugin as returned to the desk (secrets never included).
 * Catalog rows are always listed (even when never toggled) via merge with MCP_CATALOG.
 */
export type AgentPluginView = {
  id: string;
  kind: PluginKind;
  catalogId: string | null;
  name: string;
  description: string;
  serverName: string;
  enabled: boolean;
  /** True when every required catalog secret is present (custom: any saved secrets). */
  configured: boolean;
  /** Host-provisioned; no per-user install/key. */
  builtin?: boolean;
  secretSpecs: PluginSecretSpec[];
  /** Which secret keys are set (values never returned). */
  secretsSet: string[];
  docsUrl?: string;
  /** Present for custom plugins. */
  custom?: CustomMcpConfig;
  createdAt: number | null;
  updatedAt: number | null;
};

export type UpsertCatalogPluginInput = {
  enabled: boolean;
  /** Partial secret map — only keys to set/replace. Empty string clears. */
  secrets?: Record<string, string>;
};

export type CreateCustomPluginInput = {
  name: string;
  description?: string;
  serverName: string;
  enabled?: boolean;
  config: CustomMcpConfig;
  secrets?: Record<string, string>;
};

export type UpdateCustomPluginInput = {
  name?: string;
  description?: string;
  enabled?: boolean;
  config?: CustomMcpConfig;
  secrets?: Record<string, string>;
};

const SERVER_NAME_RE = /^[A-Za-z0-9_-]{1,32}$/;

export function isValidMcpServerName(name: unknown): name is string {
  return typeof name === "string" && SERVER_NAME_RE.test(name);
}

/** Plugins the composer may @-mention (enabled + configured). */
export function mentionablePlugins(
  plugins: readonly AgentPluginView[],
): AgentPluginView[] {
  return plugins.filter((plugin) => plugin.enabled && plugin.configured);
}

/**
 * Match an in-progress `@token` at the cursor (start of text or after whitespace).
 * Closes once the user types a space after the name.
 */
export function matchAtPluginQuery(
  text: string,
  cursor = text.length,
): { start: number; end: number; query: string } | null {
  const before = text.slice(0, cursor);
  const match = before.match(/(^|\s)@([A-Za-z0-9_-]*)$/);
  if (!match || match.index === undefined) return null;
  const at = match.index + match[1]!.length;
  return {
    start: at,
    end: cursor,
    query: match[2]!.toLowerCase(),
  };
}

export function filterMentionablePlugins(
  plugins: readonly AgentPluginView[],
  query: string,
): AgentPluginView[] {
  const rows = mentionablePlugins(plugins);
  const q = query.trim().toLowerCase();
  if (!q) return rows;
  return rows.filter(
    (plugin) =>
      plugin.serverName.toLowerCase().includes(q) ||
      plugin.name.toLowerCase().includes(q) ||
      plugin.description.toLowerCase().includes(q),
  );
}
