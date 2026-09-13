import { getSupportedChain } from "@squadrons/shared";

const RPC_BY_CHAIN: Record<
  number,
  { envKeys: string[]; defaultUrl: string }
> = {
  1: {
    envKeys: ["ETHEREUM_RPC_URL", "ETH_RPC_URL", "SQUADRONS_ETH_RPC_URL"],
    defaultUrl: "https://ethereum.publicnode.com",
  },
  8453: {
    envKeys: ["BASE_RPC_URL", "SQUADRONS_BASE_RPC_URL"],
    defaultUrl: "https://mainnet.base.org",
  },
  42161: {
    envKeys: ["ARBITRUM_RPC_URL", "SQUADRONS_ARBITRUM_RPC_URL"],
    defaultUrl: "https://arb1.arbitrum.io/rpc",
  },
  10: {
    envKeys: ["OPTIMISM_RPC_URL", "SQUADRONS_OPTIMISM_RPC_URL"],
    defaultUrl: "https://mainnet.optimism.io",
  },
  130: {
    envKeys: ["UNICHAIN_RPC_URL", "SQUADRONS_UNICHAIN_RPC_URL"],
    defaultUrl: "https://mainnet.unichain.org",
  },
  480: {
    envKeys: ["WORLDCHAIN_RPC_URL", "SQUADRONS_WORLDCHAIN_RPC_URL"],
    defaultUrl: "https://worldchain-mainnet.g.alchemy.com/public",
  },
  4663: {
    envKeys: ["ROBINHOOD_RPC_URL", "SQUADRONS_ROBINHOOD_RPC_URL"],
    defaultUrl: "https://rpc.mainnet.chain.robinhood.com",
  },
  5042002: {
    envKeys: ["ARC_RPC_URL", "SQUADRONS_ARC_RPC_URL"],
    defaultUrl: "https://rpc.testnet.arc.io",
  },
};

export function resolveRpcUrl(chainId: number): string {
  const chain = getSupportedChain(chainId);
  const config = RPC_BY_CHAIN[chainId];
  if (!config) {
    throw new Error(
      `No RPC for chain ${chain?.name ?? chainId}. Set an RPC env var.`,
    );
  }
  for (const key of config.envKeys) {
    const value = process.env[key]?.trim();
    if (value) return value;
  }
  return config.defaultUrl;
}
