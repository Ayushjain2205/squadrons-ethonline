# Arc usage

How Squadrons runs agents on **Circle Arc** — USDC-native gas, Circle Swap Kit for FX, Privy for wallets.

> **Network today:** Arc **Testnet** only (`chainId` `5042002`). Mainnet IDs land when Circle publishes them; swap this doc’s IDs/RPCs then.

## Why Arc is different

| Topic | ETH L2 home chains | Arc |
| --- | --- | --- |
| Gas token | ETH | **USDC** (native, 18 decimals) |
| Quote / swap provider | **0x** AllowanceHolder | **Circle Swap Kit** (App Kit Swap) |
| Desk pair language | USDC ↔ ETH/WETH | **USDC ↔ EURC** |
| Funding | Privy onramp / bridges (where configured) | [Circle Faucet](https://faucet.circle.com) on testnet |

0x does **not** list Arc. Squadrons therefore routes Arc exclusively through Circle’s developer stack — required for Circle bounty demos and correct for Arc’s stablecoin-native design.

## Network parameters

| Field | Value |
| --- | --- |
| Name | Arc Testnet |
| Chain ID | `5042002` (`0x4CEF52`) |
| RPC | `https://rpc.testnet.arc.io` (override with `ARC_RPC_URL`) |
| Explorer | https://testnet.arcscan.app |
| Circle chain enum | `Arc_Testnet` |
| Native currency | USDC (18 decimals for `eth_getBalance`) |
| USDC ERC-20 interface | `0x3600000000000000000000000000000000000000` (6 decimals) |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6 decimals) |

Native USDC and the ERC-20 USDC interface **share one balance**. Balance tools show native USDC once and skip the ERC-20 duplicate.

Official refs: [Connect to Arc](https://docs.arc.io/integrate/connect-to-arc) · [Contract addresses](https://docs.arc.io/arc/references/contract-addresses) · [App Kit Swap](https://docs.arc.io/app-kit/swap)

## Mental model

```
Desk agent (home chain = Arc)
        │
        ├─ observe tools ──► get_wallet_balances / get_spot_prices
        │                    get_dex_quote  ──► Circle Swap Kit estimate
        │
        └─ strategy tick ──► TradePlan (USDC notional, symbol EURC)
                               │
                               ├─ Paper ──► buildCircleSwapFromPlan (quote only)
                               └─ Live  ──► kit.swap via Privy EIP-1193 adapter
```

- **Observe / Paper** never broadcast.
- **Live** requires host `SQUADRONS_EXECUTION_MODE=live`, desk Live mode, and Privy authorization key (same as other chains).
- Circle Kit uses `allowanceStrategy: "approve"` on the live path so Privy only needs `eth_sendTransaction` (no EIP-2612 permit).

## Operator setup

### 1. Host env

In `apps/host/.env` (see `.env.example`):

```bash
# Optional but recommended for volume / production rate limits
CIRCLE_API_KEY=

# Optional RPC override
ARC_RPC_URL=https://rpc.testnet.arc.io

# Same as other chains for Live
PRIVY_AUTHORIZATION_PRIVATE_KEY=
PRIVY_AUTHORIZATION_KEY_QUORUM_ID=
SQUADRONS_EXECUTION_MODE=dry_run   # set live only when ready
```

`CIRCLE_API_KEY` is a **TEST** key from [Circle Console](https://console.circle.com/) for Arc Testnet. Estimates also work permissionlessly without a key (shared rate limit).

### 2. Web / Privy

`apps/web` already includes Arc Testnet in Privy `supportedChains`. Ensure `NEXT_PUBLIC_PRIVY_APP_ID` is set. After login, enable the host session signer (same Wallet sheet flow as Base).

### 3. Fund the shared wallet

1. Copy the agent / user embedded wallet address from the desk.
2. Open https://faucet.circle.com → **Arc Testnet**.
3. Request **USDC** (gas + quote stable) and **EURC** (FX asset).

Without USDC you cannot pay gas or buy EURC.

### 4. Create an Arc agent

1. Desk → create agent → home chain **Arc Testnet**.
2. Start in **Observe**, research with tools, then **Paper** to see Circle quotes.
3. Import template **Arc EURC dip buy** (`arc-eurc-dip-buy`) or author a strategy with `symbol: "EURC"`.
4. Arm when ready. Graduate to **Live** only after Paper quotes look sane.

## Tool usage

### `get_wallet_balances`

Home-chain only. On Arc defaults cover native **USDC** + **EURC**.

### `get_spot_prices`

USD spot via CoinGecko (`usd-coin`, `euro-coin`). Reference only — not executable.

### `get_dex_quote`

Indicative **Circle Swap Kit** quote (observe-only).

| Arg | Meaning on Arc |
| --- | --- |
| `side` | `buy` = USDC → EURC · `sell` = EURC → USDC |
| `symbol` | `EURC` (not `ETH`) |
| `amountUsd` | USD notional on the **USDC** side (capped by desk max, default $10) |
| `slippageBps` | Optional; default 50 |

Example chat intents:

- “Quote buying $5 of EURC on Arc”
- “get_dex_quote buy EURC amountUsd 5”

Sell path sizes EURC input from CoinGecko EURC/USD (exact-in; Circle does not take 0x-style exact-out).

## Strategy / templates

| Template id | Recipe | Behavior |
| --- | --- | --- |
| `arc-eurc-dip-buy` | `price_cross_swap` | When EURC USD crosses below a level, propose capped USDC→EURC |

Catalog: `packages/shared/src/templates.ts`  
Import: Strategy card → templates filtered by `chainId=5042002`, or `POST /v1/agents/:id/strategy/from-template`.

Trade intents on Arc must use `symbol: "EURC"` (and `side` / `amountUsd`). ETH/WETH routes are rejected on this chain.

## Code map

| Concern | Path |
| --- | --- |
| Supported chain list | `packages/shared/src/policy.ts` |
| RPC + token config | `packages/squadrons-defi/chains.js` |
| Observe Circle quotes | `packages/squadrons-defi/circle-quote.js` |
| Host build + live `kit.swap` | `apps/host/src/strategy/circle-swap.ts` |
| Provider router (0x vs Circle) | `apps/host/src/strategy/swap-build.ts` |
| Live branch for Arc | `apps/host/src/strategy/executor.ts` |
| Host token mirror | `apps/host/src/strategy/recipes/tokens.ts` |
| Privy chain | `apps/web/src/components/Providers.tsx` |
| Adding chains checklist | `packages/squadrons-defi/README.md` |

## Smoke checks

From repo root (host `.env` loaded):

```bash
# Circle estimate on Arc (optional CIRCLE_API_KEY)
node --env-file=apps/host/.env --input-type=module -e "
import { fetchCircleDexQuote } from './packages/squadrons-defi/circle-quote.js';
const q = await fetchCircleDexQuote({
  chainId: 5042002,
  walletAddress: '0x1111111111111111111111111111111111111111',
  side: 'buy',
  symbol: 'EURC',
  amountUsd: 5,
});
console.log(q.source, q.sell, q.buy);
"
```

Then in the desk: Arc agent → Observe → ask for a EURC quote → Paper strategy tick → confirm detail says **Circle Swap Kit**.

## Circle bounty alignment

Useful talking points for submissions:

| Bounty angle | What Squadrons shows |
| --- | --- |
| **Best DeFi / Onchain Finance** | Stablecoin-native FX (USDC↔EURC) on Arc via Circle Swap Kit; agents + desk caps |
| **Best Agentic Economy** | Agents hold Privy wallets, decide from signals, settle USDC spends on Arc |

Core products touched: **Arc**, **USDC**, **EURC**, **App Kit / Swap Kit**. CCTP / Gateway / Agent Stack can extend funding and agent settlement later — not required for the MVP swap loop.

Call out explicitly in the submission which bounty track you target.

## Limits & gotchas

- **Testnet liquidity** can be thin; quotes may look off or fail — retry or shrink size.
- **Gas is USDC** — keep a buffer above trade notional.
- Do not mix native 18-decimal USDC amounts with ERC-20 6-decimal units in custom scripts.
- Quote-only adapters use an ephemeral key for Circle’s estimate API; **user funds never leave Privy**.
- Mainnet Sept 30 bonus: redeploy when Arc mainnet is published (new chain id, RPC, addresses, Circle **mainnet** API key).

## Related docs

- [Strategies](./STRATEGY.md) — Observe / Paper / Live, templates, Arm
- [squadrons-defi README](../packages/squadrons-defi/README.md) — chain add checklist
- Circle: [Arc docs](https://docs.arc.io/) · [Swap quickstart](https://docs.arc.io/app-kit/quickstarts/swap-tokens-same-chain)
