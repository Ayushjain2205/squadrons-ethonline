#!/usr/bin/env bash
# Link all Squadrons Cordis plugins into the workspace-local dsh sdk profile.
# Always targets apps/host/data/dsh-home (never ~/.dsh) unless DSH_HOME is set.
set -euo pipefail

HOST_ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
ROOT="$(cd "$HOST_ROOT/../.." && pwd)"
PROFILE="${DSH_HOME:-$HOST_ROOT/data/dsh-home}/profiles/sdk"

if [[ ! -d "$PROFILE" ]]; then
  echo "dsh sdk profile not found at $PROFILE" >&2
  echo "Run: pnpm --filter @squadrons/host dsh:repair" >&2
  exit 1
fi

node <<EOF
const fs = require("fs");
const path = require("path");
const file = path.join("$PROFILE", "package.json");
const data = JSON.parse(fs.readFileSync(file, "utf8"));
data.dependencies = data.dependencies || {};
const plugins = {
  "squadrons-defi": "link:$ROOT/packages/squadrons-defi",
  "squadrons-strategy": "link:$ROOT/packages/squadrons-strategy",
  "squadrons-social": "link:$ROOT/packages/squadrons-social",
  "squadrons-intel": "link:$ROOT/packages/squadrons-intel",
  "squadrons-backtest": "link:$ROOT/packages/squadrons-backtest",
  "squadrons-chain-search": "link:$ROOT/packages/squadrons-chain-search",
  "squadrons-substreams": "link:$ROOT/packages/squadrons-substreams",
};
    // MCP bridge for remote catalog/custom plugins (Dune, Nansen, custom HTTP).
data.dependencies["@deepseek-ai/dsh-mcp-client"] = "0.1.2-rc.1";
for (const [name, spec] of Object.entries(plugins)) {
  data.dependencies[name] = spec;
}
data.dsh = data.dsh || {};
data.dsh.profile = data.dsh.profile || {};
data.dsh.profile.bundles = data.dsh.profile.bundles || [];
// Always-on Cordis tools (Backtest is disabled per-agent when Plugins toggle is off).
const bundled = [
  "squadrons-defi",
  "squadrons-strategy",
  "squadrons-social",
  "squadrons-intel",
  "squadrons-backtest",
  "squadrons-chain-search",
  "squadrons-substreams",
];
for (const name of bundled) {
  if (!data.dsh.profile.bundles.includes(name)) {
    data.dsh.profile.bundles.push(name);
  }
}
fs.writeFileSync(file, JSON.stringify(data, null, 2) + "\n");
console.log("Updated", file);
EOF

# Fail closed after bundle list is updated — broken peers crash the Cordis tree.
(cd "$HOST_ROOT" && pnpm exec tsx src/dsh/preflight-cli.ts) || {
  echo "Preflight failed — fix plugin deps (pnpm install at repo root) before linking." >&2
  exit 1
}

(cd "$PROFILE" && CI=true pnpm install --no-frozen-lockfile)
echo "Squadrons Cordis plugins linked into $PROFILE"
