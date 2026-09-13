/**
 * dsh Cordis plugins linked into apps/host/data/dsh-home/profiles/sdk.
 * Keep in sync with scripts/dsh/repair-profile.sh bundles.
 */
export const SQUADRONS_DSH_PLUGINS = [
  "squadrons-defi",
  "squadrons-strategy",
  "squadrons-social",
  "squadrons-intel",
  "squadrons-backtest",
  "squadrons-chain-search",
  "squadrons-substreams",
] as const;

export type SquadronsDshPlugin = (typeof SQUADRONS_DSH_PLUGINS)[number];
