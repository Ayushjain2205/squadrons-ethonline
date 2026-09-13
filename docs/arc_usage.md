# Arc usage

How Squadrons runs agents on **Circle Arc** — USDC-native gas, Circle Swap Kit for FX, Privy for wallets.

**Network today:** Arc **Testnet** only (`chainId` `5042002`). Update chain id / RPC / addresses when mainnet ships.

## Why Arc is different

| Topic | ETH L2 home chains | Arc |
| --- | --- | --- |
| Gas token | ETH | **USDC** (native, 18 decimals) |
| Quote / swap provider | **0x** AllowanceHolder | **Circle Swap Kit** |
| Desk pair language | USDC ↔ ETH/WETH | **USDC ↔ EURC** |
| Funding | Privy Add funds (where settle is supported) | Circle faucet on testnet |

0x does not list Arc, so this home chain routes exclusively through Circle Swap Kit.

## What we use

| Feature | In product | Implementation |
| --- | --- | --- |
| Arc as a home chain | Desk create-agent → **Arc Testnet**; Privy `supportedChains` | [`policy.ts`](../packages/shared/src/policy.ts) · [`Providers.tsx`](../apps/web/src/components/Providers.tsx) · [`chains.js`](../packages/squadrons-defi/chains.js) |
| Balances / spots | `get_wallet_balances` (native USDC + EURC) · `get_spot_prices` (CoinGecko reference) | [`squadrons-defi`](../packages/squadrons-defi/) · host token mirror [`tokens.ts`](../apps/host/src/strategy/recipes/tokens.ts) |
| Observe quotes | `get_dex_quote` → Circle estimate (USDC ↔ EURC) | [`circle-quote.js`](../packages/squadrons-defi/circle-quote.js) |
| Paper / Live build | TradePlan with `symbol: "EURC"`; Paper quotes only | [`circle-swap.ts`](../apps/host/src/strategy/circle-swap.ts) · [`swap-build.ts`](../apps/host/src/strategy/swap-build.ts) |
| Live settle | `kit.swap` through Privy EIP-1193 (`eth_sendTransaction` only) | [`circle-swap.ts`](../apps/host/src/strategy/circle-swap.ts) · [`executor.ts`](../apps/host/src/strategy/executor.ts) · [`broadcast.ts`](../apps/host/src/strategy/broadcast.ts) |
| Template | **Arc EURC dip buy** (`arc-eurc-dip-buy` → `price_cross_swap`) | [`templates.ts`](../packages/shared/src/templates.ts) |

## Network parameters

| Field | Value |
| --- | --- |
| Name | Arc Testnet |
| Chain ID | `5042002` (`0x4CEF52`) |
| RPC | `https://rpc.testnet.arc.io` (override with `ARC_RPC_URL`) |
| Explorer | `https://testnet.arcscan.app` |
| Circle chain enum | `Arc_Testnet` |
| Native currency | USDC (18 decimals for `eth_getBalance`) |
| USDC ERC-20 interface | `0x3600000000000000000000000000000000000000` (6 decimals) |
| EURC | `0x89B50855Aa3bE2F677cD6303Cec089B5F319D72a` (6 decimals) |

Native USDC and the ERC-20 USDC interface **share one balance**. Balance tools show native USDC once and skip the ERC-20 duplicate.

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
- **Live** needs host `SQUADRONS_EXECUTION_MODE=live`, desk Live mode, and Privy authorization key (same as other chains).
- Live uses `allowanceStrategy: "approve"` so Privy only needs `eth_sendTransaction` (no EIP-2612 permit).

## Operator setup

### Host (`apps/host/.env`)

```bash
# Optional — better rate limits; estimates work without it
CIRCLE_API_KEY=

ARC_RPC_URL=https://rpc.testnet.arc.io

PRIVY_AUTHORIZATION_PRIVATE_KEY=
PRIVY_AUTHORIZATION_KEY_QUORUM_ID=
SQUADRONS_EXECUTION_MODE=dry_run   # live only when ready
```

### Web / Privy

Arc Testnet is already in Privy `supportedChains`. Set `NEXT_PUBLIC_PRIVY_APP_ID`, then **Grant access** in the Wallet sheet (same as Base).

### Fund the shared wallet (testnet)

1. Copy the embedded wallet address from the desk.
2. Circle faucet → **Arc Testnet**.
3. Request **USDC** (gas + quote stable) and **EURC** (FX asset).

Without USDC you cannot pay gas or buy EURC.

### Create an Arc agent

1. Desk → create agent → home chain **Arc Testnet**.
2. **Observe** → research → **Paper** to see Circle quotes.
3. Import template `arc-eurc-dip-buy` or author a strategy with `symbol: "EURC"`.
4. Arm when ready. **Live** only after Paper quotes look sane.

## Tool usage

### `get_wallet_balances`

Home-chain only. On Arc defaults cover native **USDC** + **EURC**.

### `get_spot_prices`

USD spot via CoinGecko (`usd-coin`, `euro-coin`). Reference only — not executable.

### `get_dex_quote`

Indicative Circle Swap Kit quote (observe-only).

| Arg | Meaning on Arc |
| --- | --- |
| `side` | `buy` = USDC → EURC · `sell` = EURC → USDC |
| `symbol` | `EURC` (not `ETH`) |
| `amountUsd` | USD notional on the **USDC** side (capped by desk max, default $10) |
| `slippageBps` | Optional; default 50 |

Examples: “Quote buying $5 of EURC on Arc” · `get_dex_quote buy EURC amountUsd 5`

Sell path sizes EURC input from CoinGecko EURC/USD (exact-in; no 0x-style exact-out).

## Strategy / templates

| Template id | Recipe | Behavior |
| --- | --- | --- |
| `arc-eurc-dip-buy` | `price_cross_swap` | When EURC USD crosses below a level, propose capped USDC→EURC |

Import from the Strategy card (`chainId=5042002`) or `POST /v1/agents/:id/strategy/from-template`.

Trade intents on Arc must use `symbol: "EURC"` (plus `side` / `amountUsd`). ETH/WETH routes are rejected.

## Smoke check

```bash
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

Desk: Arc agent → Observe → EURC quote → Paper tick → detail should say **Circle Swap Kit**.

## Limits & gotchas

- Testnet liquidity can be thin — retry or shrink size.
- Gas is USDC — keep a buffer above trade notional.
- Do not mix native 18-decimal USDC amounts with ERC-20 6-decimal units in custom scripts.
- Quote-only adapters may use an ephemeral key for Circle’s estimate API; **user funds only move through Privy**.
- On mainnet: new chain id, RPC, addresses, and a mainnet Circle API key.
