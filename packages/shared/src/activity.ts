/** Present-tense verbs while a step is in flight. */
export const ACTIVITY_STEP_LABELS: Record<string, string> = {
  get_wallet_balances: "Looking up balances",
  get_spot_prices: "Checking prices",
  get_dex_quote: "Quoting swap",
  propose_strategy: "Drafting strategy",
  update_strategy_params: "Updating strategy params",
  propose_improvement: "Suggesting self-improvement",
  get_strategy: "Checking strategy",
  search_x: "Searching X",
  get_trending_pools: "Scanning trending pools",
  get_token_pools: "Looking up token pools",
  get_recent_trades: "Reading pool tape",
  get_stablecoin_market: "Checking stablecoins",
  get_dex_volumes: "Checking DEX volumes",
  run_backtest: "Running backtest",
  mcp__backtest__run_backtest: "Running backtest",
  publish_chain_search: "Publishing search results",
  deploy_event_pipeline: "Deploying event pipeline",
  web_search: "Searching the web",
  WebSearch: "Searching the web",
  web_fetch: "Reading a page",
  todo_write: "Organizing next steps",
  todo_read: "Reviewing next steps",
  ask_user_question: "Needs your input",
  skill: "Using a playbook",
};

/** Past-tense verbs once the step has finished. */
export const ACTIVITY_STEP_LABELS_DONE: Record<string, string> = {
  get_wallet_balances: "Looked up balances",
  get_spot_prices: "Checked prices",
  get_dex_quote: "Quoted swap",
  propose_strategy: "Drafted strategy",
  update_strategy_params: "Updated strategy params",
  propose_improvement: "Suggested self-improvement",
  get_strategy: "Checked strategy",
  search_x: "Searched X",
  get_trending_pools: "Scanned trending pools",
  get_token_pools: "Looked up token pools",
  get_recent_trades: "Read pool tape",
  get_stablecoin_market: "Checked stablecoins",
  get_dex_volumes: "Checked DEX volumes",
  run_backtest: "Ran backtest",
  mcp__backtest__run_backtest: "Ran backtest",
  publish_chain_search: "Published search results",
  deploy_event_pipeline: "Deployed event pipeline",
  web_search: "Searched the web",
  WebSearch: "Searched the web",
  web_fetch: "Read a page",
  todo_write: "Organized next steps",
  todo_read: "Reviewed next steps",
  ask_user_question: "Asked for input",
  skill: "Used a playbook",
};

function graphMcpLabel(toolName: string, done: boolean): string | null {
  if (!toolName.includes("subgraph") && !/^mcp__subgraph__/i.test(toolName)) {
    return null;
  }
  return done ? "Queried The Graph" : "Querying The Graph";
}

export function activityStepLabel(toolName: string): string {
  return (
    ACTIVITY_STEP_LABELS[toolName] ??
    graphMcpLabel(toolName, false) ??
    "Working on it"
  );
}

export function activityStepLabelDone(toolName: string): string {
  return (
    ACTIVITY_STEP_LABELS_DONE[toolName] ??
    graphMcpLabel(toolName, true) ??
    "Finished a step"
  );
}

/**
 * Display text for an activity row.
 * Prefer toolName → verb maps; otherwise use the stored label.
 * `done` switches known tools to past tense.
 */
export function displayActivityLabel(
  event: {
    kind: string;
    label: string;
    toolName?: string | null;
  },
  options: { done?: boolean } = {},
): string | null {
  if (
    event.kind === "turn_start" ||
    event.kind === "turn_end" ||
    event.kind === "tool_result"
  ) {
    return null;
  }

  const done = Boolean(options.done);

  if (event.kind === "error") {
    if (event.toolName && ACTIVITY_STEP_LABELS[event.toolName]) {
      return `${ACTIVITY_STEP_LABELS[event.toolName]} failed`;
    }
    return event.label || null;
  }

  if (event.kind === "info") return event.label || null;

  if (event.toolName) {
    return done
      ? activityStepLabelDone(event.toolName)
      : activityStepLabel(event.toolName);
  }

  return event.label || null;
}
