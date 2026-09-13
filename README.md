# Squadrons

**The agent harness for DeFi.**

Equip crypto agents with live onchain search, social sentiment, and safety-capped execution loops — a roster of named agents on a desk, not a generic chatbot with tools bolted on.

Crypto operators get persistent scouts they can chat with, research with, Arm into strategies, and graduate from Observe → Paper → Live without babysitting every tick.

```
Choose a chain → create an agent → research → Arm a loop → paper → live (capped)
```

## Why this exists

Coding harnesses (Cursor, Claude Code, …) are built for repos: web search, docs, linters, terminals, PRs. DeFi needs different primitives.

| Generic harness | Squadrons |
| --- | --- |
| Web / SEO search | **Onchain search** — subgraphs, pools, TVL (`@search`) |
| Docs / StackOverflow | **X & CT pulse** — ticker mindshare, whale chatter (`@pulse`) |
| Linter / typecheck | **DEX radar & sim** — quotes, impact, backtests (`@backtest`) |
| Bash sandbox | **Armed loops** — deterministic host recipes, not LLM-every-tick (`@arm`) |
| Code review | **Safety ladder** — Observe → Paper → Live with fail-closed spend caps |

One shared Privy embedded wallet per user. Agents never hold keys. Spend is per-agent and capped (default auto-trade ceiling: $10).

## How it works

1. **Choose chain, create agent** — Base, Ethereum, Arbitrum, Optimism, Unichain, World Chain, Robinhood, Arc Testnet. Name, avatar, mandate.
2. **Research** — skills (`/market-analyser`, `/wallet-pulse`, …), tools (`@search`, `@pulse`, `@backtest`, quotes, balances), and MCP plugins (The Graph, Uniswap, DefiLlama, …).
3. **Simulate, then graduate** — chat drafts a strategy → **Arm** starts a host loop → **Paper** quotes/fills with no broadcast → **Live** settles under gas / slippage / spend caps (0x on ETH L2s; Circle Swap Kit on Arc).
4. **Self-improve** — optional cadence: execute → analyze edge → propose param patches for desk approval.

## What you get

- **My Agents desk** — Grok-shaped three-column roster / chat / context
- Continuous per-agent memory and an activity trail (chat tools vs strategy ticks)
- Curated **templates** + deterministic **recipes** (see [docs/STRATEGY.md](./docs/STRATEGY.md))
- Funding via Privy **Add funds**; Live broadcast via Privy session signer + Wallet API
- Builtins for Chain Search, Event Pipeline (Substreams), Social Search, Backtest — host-provisioned, no paste-your-own-key UX for the core loop

## Repo

| Package | Role |
| --- | --- |
| `apps/web` | Next.js desk + landing |
| `apps/host` | Node 22 supervisor — agents, dsh, policy, Privy, SSE, strategy runtime |
| `packages/shared` | Types, policy, templates, recipes, plugin catalog |
| `packages/squadrons-*` | Cordis plugins (defi, strategy, social, intel, chain-search, substreams, …) |

## Docs

| Guide | What it covers |
| --- | --- |
| [Strategy](./docs/STRATEGY.md) | Chat → Arm → recipes → self-improvement |
| [Privy usage](./docs/privy_usage.md) | Auth, embedded wallet, Add funds, Live broadcast |
| [Arc usage](./docs/arc_usage.md) | USDC-native Arc, Circle Swap Kit, USDC↔EURC |
| [The Graph usage](./docs/graph_usage.md) | Chain Search (Subgraph MCP) + Event Pipeline (Substreams) |
| [PRD](./PRD.md) · [Product](./PRODUCT.md) | Spec and positioning |

## Quick start

**Prereqs:** Node 22+, pnpm 9+

```bash
pnpm install
cp apps/host/.env.example apps/host/.env
cp apps/web/.env.example apps/web/.env.local
```

Fill at least:

- Web: `NEXT_PUBLIC_PRIVY_APP_ID`, `NEXT_PUBLIC_PRIVY_SIGNER_ID`
- Host: `PRIVY_APP_ID`, `PRIVY_APP_SECRET`, `OPENROUTER_API_KEY`
- Optional for Live: `PRIVY_AUTHORIZATION_PRIVATE_KEY`, `SQUADRONS_EXECUTION_MODE=live`
- Optional for Chain Search: `THE_GRAPH_GATEWAY_API_KEY`

```bash
pnpm dsh:repair          # local sdk profile + OpenRouter patch
pnpm --filter @squadrons/host dsh:link
pnpm dev                 # web :3000 · host :8787
```

Open http://localhost:3000 → log in → create an agent.

Host refuses to listen if the dsh plugin tree looks broken (`pnpm dsh:check`; override with `SQUADRONS_DSH_SKIP_PREFLIGHT=1`). `@squadrons/shared` is consumed from TypeScript source — no separate shared build for local `pnpm dev`.

### Smoke

```bash
pnpm --filter @squadrons/host dsh:smoke
```

### Auth note

Desk login is Privy (email or wallet; embedded wallet on login). Host APIs take `Authorization: Bearer <access token>` (SSE: `?access_token=`). Agents are scoped by Privy user id. Details: [docs/privy_usage.md](./docs/privy_usage.md).
