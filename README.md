# Squadrons

Multi-tenant platform for persistent, named crypto agents.

See [PRD.md](./PRD.md) for product and implementation orientation.
See [docs/STRATEGY.md](./docs/STRATEGY.md) for chat → Arm → deterministic recipes → self-improvement.
See [docs/graph_usage.md](./docs/graph_usage.md) for The Graph (Chain Search + Substreams).
See [docs/arc_usage.md](./docs/arc_usage.md) for Arc / Circle Swap Kit.

## Monorepo

| Package | Role |
| --- | --- |
| `apps/web` | Next.js — My Agents UI |
| `apps/host` | Node 22 supervisor — agents, dsh, policy, Privy, SSE |
| `packages/shared` | Shared types, policy defaults, avatar IDs |

## Prerequisites

- Node.js 22+
- [pnpm](https://pnpm.io) 9+

## Setup

```bash
pnpm install
```

Copy env examples when present:

```bash
cp apps/host/.env.example apps/host/.env
cp apps/web/.env.example apps/web/.env.local
```

`@squadrons/shared` is consumed from TypeScript source (Next transpiles it; host runs via `tsx`). No separate shared build step for local `pnpm dev`.

## Develop

```bash
# both apps
pnpm dev

# individually
pnpm dev:web
pnpm dev:host
```

- Web: http://localhost:3000
- Host: http://localhost:8787

### dsh profile (OpenRouter + Cordis plugins)

Host uses workspace-local `apps/host/data/dsh-home` (not `~/.dsh`). Cordis plugins live in `packages/squadrons-{defi,strategy,social}` and must list `@deepseek-ai/dsh-tools` as a **dependency** so Node can resolve imports when the profile `link:`s them.

```bash
pnpm dsh:check    # fail closed if plugins/peers/DSH_HOME look broken
pnpm dsh:repair   # rewrite local sdk profile + OpenRouter patch
pnpm --filter @squadrons/host dsh:link   # ensure plugins are bundled
```

Host runs `dsh:check` on startup and refuses to listen if the tree is broken (override with `SQUADRONS_DSH_SKIP_PREFLIGHT=1`). `/health` includes a `dsh` block. Scripts live under `apps/host/scripts/dsh/`.

### Chain Search (The Graph)

Onchain search is **included for every agent** when the host has a Gateway API key — users do not paste keys in Plugins.

1. Create a free key in [Subgraph Studio](https://thegraph.com/studio/) (API Keys; **100k queries/month** free — set a spending limit).
2. Set `THE_GRAPH_GATEWAY_API_KEY=` in `apps/host/.env` and restart the host.
3. In chat: `@search Uniswap V3 pools on Ethereum` (or `@graph …`). The agent queries Subgraph MCP live, then shows a **Chain Search** results card.

All tenants share that one quota — fine for demos; add rate limits or BYO keys later for production.

## Step 1 — dsh smoke

Requires a working `sdk` profile (`dsh --profile sdk --help`).

```bash
pnpm --filter @squadrons/host dsh:smoke
# or: curl -X POST http://localhost:8787/v1/dsh/smoke -H 'content-type: application/json' -d '{"prompt":"say hi"}'
```

## Auth (Privy)

1. Create a Privy app and enable embedded wallets (create on login).
2. Set `NEXT_PUBLIC_PRIVY_APP_ID` in `apps/web/.env.local`.
3. Set `PRIVY_APP_ID` and `PRIVY_APP_SECRET` in `apps/host/.env`.

The desk requires login. Host APIs expect `Authorization: Bearer <Privy access token>` (SSE uses `?access_token=`). Agents are scoped by Privy user id (DID). Older `local-dev` rows are not migrated — wipe/recreate agents after switching to real auth.

`GET /v1/me` returns `{ userId, walletAddress }` for the shared embedded wallet. The host injects that address as `SQUADRONS_USER_WALLET` into dsh turns so `get_wallet_balances` defaults to it. Optional `SQUADRONS_DEMO_WALLET` is only a fallback when no user wallet is set.

## Step 2 — agents + workspaces

Use a Privy access token from a logged-in session (browser Network tab, or Privy SDK `getAccessToken()`):

```bash
curl -s -X POST http://localhost:8787/v1/agents \
  -H 'content-type: application/json' \
  -H "authorization: Bearer $PRIVY_ACCESS_TOKEN" \
  -d '{"name":"Base Scout","avatarId":"01","description":"Scouts LP opportunities on Base"}'
```

## Step 3 — My Agents UI

With host running on `:8787`:

```bash
pnpm dev:web
# open http://localhost:3000 — log in, then list / create agents
```

New agents start idle with a short greeting. The host keeps a long-lived dsh harness + session per agent in-process (new session after host restart or home-chain change). Context pressure uses dsh’s built-in `@deepseek-ai/dsh-compaction-basic` from the `sdk` profile (`dsh-base`) — no custom summarizer. Mid-turn tool activity streams over SSE (`GET /v1/agents/:id/events`) and is persisted in SQLite (`GET /v1/agents/:id/activity`). Observe-mode dsh patch disables shell/fs/subagents; keeps web/todo/goal/skill plus **`get_wallet_balances`** / **`get_spot_prices`** / **`get_dex_quote`** (ETH L2s via 0x; Arc Testnet via Circle Swap Kit — `packages/squadrons-defi`; [add a chain](packages/squadrons-defi/README.md)), **`search_x`** (`packages/squadrons-social`), and market intel **`get_trending_pools`** / **`get_token_pools`** / **`get_recent_trades`** / **`get_stablecoin_market`** / **`get_dex_volumes`** (`packages/squadrons-intel` — GeckoTerminal + DefiLlama, free). Generic `web_search` still needs `DEEPSEEK_API_KEY` (disabled in observe). Live broadcast remains Base-gated.
