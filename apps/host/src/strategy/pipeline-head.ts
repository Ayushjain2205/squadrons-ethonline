import { createHash } from "node:crypto";

export type TokenFlowRow = {
  symbol: string;
  volumeUsd: number;
  buyers: number;
  score: number;
  pool: string;
};

export type TokenFlowHead = {
  pipelineId: string;
  block: number;
  emittedAt: string;
  topTokens: TokenFlowRow[];
  /** Best row by score — used for edge detection. */
  leader: TokenFlowRow;
};

const ROBINHOOD_SYMBOLS = ["HOOD", "USDG", "WETH", "USDe", "ARB"] as const;
const DEFAULT_SYMBOLS = ["WETH", "USDC", "USDT", "WBTC", "DAI"] as const;

/**
 * Studio stream head for a deployed token-flow pipeline.
 * Deterministic per pipeline + time bucket so event edges can fire without
 * an external Substreams gateway.
 */
export function sampleTokenFlowHead(
  pipelineId: string,
  chainId: number,
  nowMs = Date.now(),
): TokenFlowHead {
  const bucket = Math.floor(nowMs / 60_000);
  const seed = createHash("sha256")
    .update(`${pipelineId}:${chainId}:${bucket}`)
    .digest();
  const symbols = chainId === 4663 ? ROBINHOOD_SYMBOLS : DEFAULT_SYMBOLS;
  const topTokens = symbols.slice(0, 5).map((symbol, i) => {
    const volumeUsd =
      35_000 + seed[i]! * 1100 + i * 14_000 + (bucket % 7) * 8_500;
    const buyers = 18 + (seed[i + 5]! % 90) + i * 6 + (bucket % 5) * 3;
    const score = Math.round(volumeUsd / 1000 + buyers * 1.35);
    return {
      symbol,
      volumeUsd,
      buyers,
      score,
      pool: `0x${createHash("sha256")
        .update(`${pipelineId}:${symbol}`)
        .digest("hex")
        .slice(0, 40)}`,
    };
  });
  const leader = [...topTokens].sort((a, b) => b.score - a.score)[0]!;
  return {
    pipelineId,
    block: 1_000_000 + (bucket % 200_000) + (seed[0]! % 500),
    emittedAt: new Date(nowMs).toISOString(),
    topTokens,
    leader,
  };
}

export function formatTokenFlowDetail(head: TokenFlowHead): string {
  const { leader } = head;
  return `${leader.symbol} score ${leader.score} · $${Math.round(leader.volumeUsd).toLocaleString()} vol · ${leader.buyers} buyers · block ${head.block}`;
}
