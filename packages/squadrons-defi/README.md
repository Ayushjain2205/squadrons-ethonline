# squadrons-defi

Cordis tools for wallet balances, CoinGecko spot prices, and **DEX quotes**
(0x AllowanceHolder on ETH L2s; **Circle Swap Kit** on Arc Testnet).

## Tools

| Tool | Scope |
| --- | --- |
| `get_wallet_balances` | Home-chain native + known ERC-20s |
| `get_spot_prices` | USD spot reference (not executable) |
| `get_dex_quote` | Indicative quote (observe-only) — provider depends on home chain |

Quotes use USD notional against a **quote stable** (`USDC` preferred, else `USDG`).

| Home chain | Provider | Pair language |
| --- | --- | --- |
| Base, Ethereum, Arbitrum, Optimism, Unichain, World Chain | 0x | stable ↔ ETH/WETH |
| Arc Testnet (`5042002`) | Circle Swap Kit | USDC ↔ EURC |

## Adding a chain (checklist)

Goal: one config row + flip a couple of allowlists — **do not fork** quote/swap code per chain unless the provider differs (Arc = Circle).

### 1. Token + RPC config (required for reads)

Edit [`chains.js`](./chains.js) — add a `CHAIN_TOOL_CONFIGS[chainId]` entry:

- `viemChain` / RPC env keys / default RPC
- `tokens`: at least one **quote stable** (`USDC` or `USDG`, 6 decimals) and usually `WETH` (or `EURC` on Arc)
- Native is usually `ETH` via the 0x `0xEeee…` sentinel; **Arc uses native USDC**

Mirror the ERC-20 map in the host:

- [`apps/host/src/strategy/recipes/tokens.ts`](../../apps/host/src/strategy/recipes/tokens.ts)

Also register the chain in product UI / agent create if needed:

- [`packages/shared/src/policy.ts`](../shared/src/policy.ts) → `SUPPORTED_CHAINS`
- Chain logo under `apps/web/public/chains/` if you show it in the web app
- Privy `supportedChains` in [`apps/web/src/components/Providers.tsx`](../../apps/web/src/components/Providers.tsx)

### 2. Enable DEX quotes

**0x path:** Confirm [0x Swap API](https://0x.org/docs/) supports the `chainId`. Then add the id to **all** allowlists:

| File | Constant |
| --- | --- |
| [`chains.js`](./chains.js) | `DEX_QUOTE_CHAIN_IDS` (+ `swapProviderForChain` → `"0x"`) |
| [`packages/shared/src/policy.ts`](../shared/src/policy.ts) | `DEX_QUOTE_CHAIN_IDS` |
| [`apps/host/src/strategy/swap-build.ts`](../../apps/host/src/strategy/swap-build.ts) | `ZEROEX_QUOTE_CHAIN_IDS` / `DEX_QUOTE_CHAIN_IDS` |

**Circle path (Arc):** keep `swapProviderForChain(chainId) === "circle-swap-kit"`. Quotes live in [`circle-quote.js`](./circle-quote.js); host build/execute in [`apps/host/src/strategy/circle-swap.ts`](../../apps/host/src/strategy/circle-swap.ts). Optional `CIRCLE_API_KEY` in `apps/host/.env`.

`get_dex_quote` registers automatically when `supportsDexQuote(homeChainId)` is true.

### 3. Smoke

```bash
# 0x (needs ZEROEX_API_KEY)
node --env-file=apps/host/.env --input-type=module -e "
import { fetchDexQuote } from './packages/squadrons-defi/zeroex-quote.js';
const q = await fetchDexQuote({
  chainId: 8453,
  walletAddress: '0x1111111111111111111111111111111111111111',
  side: 'buy',
  symbol: 'ETH',
  amountUsd: 5,
});
console.log(q.chain, q.quoteStable, q.buy);
"

# Circle / Arc (optional CIRCLE_API_KEY)
node --env-file=apps/host/.env --input-type=module -e "
import { fetchCircleDexQuote } from './packages/squadrons-defi/circle-quote.js';
const q = await fetchCircleDexQuote({
  chainId: 5042002,
  walletAddress: '0x1111111111111111111111111111111111111111',
  side: 'buy',
  symbol: 'EURC',
  amountUsd: 5,
});
console.log(q.source, q.chain, q.sell, q.buy);
"
```

Restart the host after linking plugins so Cordis reloads `squadrons-defi`.

### 4. Live spend

Live broadcast uses the same `DEX_QUOTE_CHAIN_IDS` allowlist as quotes
(`supportsDexQuote` in the executor). On Arc, the executor calls Circle Swap Kit
(`kit.swap`) with a Privy EIP-1193 adapter — not raw 0x calldata. Smoke quote +
live on testnet before shipping real size.

## Related intel

Market tape / TVL (not quotes): [`packages/squadrons-intel`](../squadrons-intel) — GeckoTerminal + DefiLlama. Those packs have their own chain→slug maps (`geckoNetworkId`, `llamaChainSlug`).
