"use client";

import { PrivyProvider } from "@privy-io/react-auth";
import {
  arbitrum,
  base,
  mainnet,
  optimism,
  unichain,
  worldchain,
  type Chain,
} from "viem/chains";
import type { ReactNode } from "react";
import { ToastProvider } from "@/components/Toast";

const robinhood = {
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.mainnet.chain.robinhood.com"] },
  },
} as const satisfies Chain;

const arcTestnet = {
  id: 5042002,
  name: "Arc Testnet",
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.testnet.arc.io"] },
  },
  blockExplorers: {
    default: { name: "ArcScan", url: "https://testnet.arcscan.app" },
  },
  testnet: true,
} as const satisfies Chain;

const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID ?? "";

export function Providers({ children }: { children: ReactNode }) {
  if (!appId) {
    return (
      <div className="type-ui flex h-dvh items-center justify-center bg-[var(--canvas)] px-6 text-center text-[var(--muted)]">
        Set NEXT_PUBLIC_PRIVY_APP_ID in apps/web/.env.local to enable login.
      </div>
    );
  }

  return (
    <PrivyProvider
      appId={appId}
      config={{
        appearance: {
          theme: "dark",
          accentColor: "#5dcea0",
          logo: undefined,
        },
        loginMethods: ["email", "wallet"],
        defaultChain: base,
        supportedChains: [
          base,
          mainnet,
          arbitrum,
          optimism,
          unichain,
          worldchain,
          robinhood,
          arcTestnet,
        ],
        embeddedWallets: {
          ethereum: {
            createOnLogin: "all-users",
          },
        },
      }}
    >
      <ToastProvider>{children}</ToastProvider>
    </PrivyProvider>
  );
}
