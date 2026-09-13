"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { useAddFunds } from "@privy-io/react-auth";
import { SUPPORTED_CHAINS, getSupportedChain } from "@squadrons/shared";
import { ChainLogo } from "@/components/ChainLogo";
import { WalletIcon } from "@/components/WalletIcon";
import { useHostSigner } from "@/hooks/useHostSigner";
import {
  fundingFallbackNote,
  resolveFundingDestination,
} from "@/lib/funding";
import { getWalletSummary, type WalletChainBalance } from "@/lib/host";
import { useToast } from "@/components/Toast";

function fundingEnvironment(): "sandbox" | "production" {
  return process.env.NEXT_PUBLIC_PRIVY_FUNDING_ENV === "sandbox"
    ? "sandbox"
    : "production";
}

function truncateAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

function isFundingCancel(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return /cancel|exited|closed|abort|dismiss/i.test(message);
}

function CopyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <rect
        x="9"
        y="9"
        width="13"
        height="13"
        rx="2"
        stroke="currentColor"
        strokeWidth="2"
      />
      <path
        d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ExternalLinkIcon({ size = 12 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden
    >
      <path
        d="M14 4h6v6M20 4l-9 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function explorerFor(
  chainId: number,
  address: string,
): { label: string; url: string } | null {
  if (chainId === 8453) {
    return { label: "Basescan", url: `https://basescan.org/address/${address}` };
  }
  if (chainId === 1) {
    return {
      label: "Etherscan",
      url: `https://etherscan.io/address/${address}`,
    };
  }
  if (chainId === 42161) {
    return {
      label: "Arbiscan",
      url: `https://arbiscan.io/address/${address}`,
    };
  }
  if (chainId === 10) {
    return {
      label: "Optimistic Etherscan",
      url: `https://optimistic.etherscan.io/address/${address}`,
    };
  }
  if (chainId === 130) {
    return {
      label: "Uniscan",
      url: `https://uniscan.xyz/address/${address}`,
    };
  }
  if (chainId === 480) {
    return {
      label: "Worldscan",
      url: `https://worldscan.org/address/${address}`,
    };
  }
  if (chainId === 5042002) {
    return {
      label: "ArcScan",
      url: `https://testnet.arcscan.app/address/${address}`,
    };
  }
  // Robinhood — no public explorer wired yet
  return null;
}

export function WalletSheet({
  open,
  onClose,
  address,
  preferredChainId = null,
  onLogout,
}: {
  open: boolean;
  onClose: () => void;
  address: string | null;
  /** Selected agent home chain — used as the default Add funds destination. */
  preferredChainId?: number | null;
  onLogout: () => void;
}) {
  const titleId = useId();
  const panelRef = useRef<HTMLDivElement | null>(null);
  const toast = useToast();
  const { addFunds } = useAddFunds();
  const { status, ensureHostSigner } = useHostSigner();
  const [chains, setChains] = useState<WalletChainBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [signerBusy, setSignerBusy] = useState(false);
  const [fundingBusy, setFundingBusy] = useState(false);

  const destination = resolveFundingDestination(preferredChainId);
  const fallbackNote = fundingFallbackNote(preferredChainId);

  const refresh = useCallback(async () => {
    if (!address) {
      setChains([]);
      return;
    }
    setLoading(true);
    try {
      const summary = await getWalletSummary();
      setChains(summary.chains);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not load balances",
      );
    } finally {
      setLoading(false);
    }
  }, [address, toast]);

  useEffect(() => {
    if (!open) return;
    void refresh();
  }, [open, refresh]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    panelRef.current?.focus();
  }, [open]);

  if (!open) return null;

  async function onGrantSigner() {
    setSignerBusy(true);
    try {
      const result = await ensureHostSigner();
      toast.info(
        result.alreadyDelegated
          ? "Host already can sign"
          : "Host can now sign for this wallet",
      );
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not grant host access",
      );
    } finally {
      setSignerBusy(false);
    }
  }

  async function onCopy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      toast.info("Address copied");
    } catch {
      toast.error("Could not copy address");
    }
  }

  async function onAddFunds() {
    if (!address) return;
    setFundingBusy(true);
    try {
      const result = await addFunds({
        destination: {
          address,
          chain: destination.caip2,
          asset: destination.asset,
        },
        fiat: {
          source: {
            assets: ["usd", "eur"],
            defaultAsset: "usd",
          },
          environment: fundingEnvironment(),
          defaultAmount: "50",
        },
        crypto: {
          slippageBps: 100,
        },
      });

      if (result.method === "fiat") {
        toast.info(
          result.status === "confirmed"
            ? `Funds confirmed — ${destination.label} may take a moment to arrive`
            : `Payment submitted — ${destination.label} may take a moment to arrive`,
        );
      } else {
        toast.info("Deposit complete — refreshing balances");
      }
      void refresh();
    } catch (err) {
      if (isFundingCancel(err)) return;
      toast.error(
        err instanceof Error ? err.message : "Could not start funding",
      );
    } finally {
      setFundingBusy(false);
    }
  }

  const balanceByChain = new Map(chains.map((row) => [row.chainId, row]));
  const orderedChains = [...SUPPORTED_CHAINS].sort((a, b) => {
    if (preferredChainId == null) return 0;
    if (a.chainId === preferredChainId) return -1;
    if (b.chainId === preferredChainId) return 1;
    return 0;
  });
  const needsGasNames = orderedChains
    .filter((chain) => balanceByChain.get(chain.chainId)?.needsGas)
    .map((chain) => getSupportedChain(chain.chainId)?.shortName ?? chain.shortName);

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 cursor-default bg-black/40"
        aria-label="Close wallet"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="wallet-sheet absolute bottom-[calc(100%+0.5rem)] left-0 right-0 z-50 rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-3.5 shadow-[0_16px_48px_rgb(0_0_0_/_0.55)] outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-2.5">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[var(--panel-2)] text-[var(--ink-soft)]">
            <WalletIcon size={18} />
          </span>
          <div className="min-w-0 flex-1">
            <h2 id={titleId} className="type-ui text-[var(--ink)]">
              Wallet
            </h2>
            {address ? (
              <div className="group/addr mt-0.5 flex min-w-0 items-center gap-1">
                <p className="type-data truncate !text-[length:var(--text-ui)] !text-[var(--ink-soft)]">
                  {truncateAddress(address)}
                </p>
                <button
                  type="button"
                  onClick={() => void onCopy()}
                  className="inline-flex size-5 shrink-0 cursor-pointer items-center justify-center rounded text-[var(--muted)] opacity-100 transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover/addr:opacity-100"
                  aria-label="Copy address"
                  title="Copy address"
                >
                  <CopyIcon />
                </button>
              </div>
            ) : (
              <p className="type-data mt-0.5 truncate !text-[length:var(--text-ui)] !text-[var(--ink-soft)]">
                No wallet yet
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="type-meta cursor-pointer rounded-lg px-2 py-1 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
            aria-label="Close"
          >
            Esc
          </button>
        </div>

        {address ? (
          <div className="mt-3">
            <button
              type="button"
              disabled={fundingBusy}
              onClick={() => void onAddFunds()}
              className="type-ui w-full cursor-pointer rounded-full bg-[var(--ink)] px-3 py-1.5 font-semibold text-[var(--canvas)] transition hover:opacity-90 disabled:opacity-40"
            >
              {fundingBusy ? "Opening…" : "Add funds"}
            </button>
            {fallbackNote ? (
              <p className="type-meta mt-1.5 text-center !text-[var(--warn)]">
                {fallbackNote}
              </p>
            ) : null}
          </div>
        ) : null}

        <section className="relative mt-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-1.5">
            <h3 className="type-ui text-[var(--ink)]">Host signing</h3>
            <span
              tabIndex={0}
              className="group/host-tip inline-flex size-4 shrink-0 cursor-help items-center justify-center rounded-full border border-[var(--line)] text-[10px] leading-none text-[var(--muted)] outline-none"
              aria-label={
                status.delegated
                  ? "Squadrons can sign when an agent has spend enabled."
                  : "Grant once so the host can broadcast after you approve in chat."
              }
            >
              i
              <span
                role="tooltip"
                className="pointer-events-none absolute left-0 right-0 top-full z-50 mt-1.5 hidden whitespace-normal rounded-lg border border-[var(--line)] bg-[var(--panel-2)] px-2.5 py-2 text-left type-meta leading-snug !text-[var(--ink)] shadow-[0_8px_24px_rgb(0_0_0_/_0.45)] group-hover/host-tip:block group-focus-within/host-tip:block"
              >
                {status.delegated
                  ? "Squadrons can sign when an agent has spend enabled."
                  : "Grant once so the host can broadcast after you approve in chat."}
              </span>
            </span>
          </div>
          {status.delegated ? (
            <p className="type-meta shrink-0 !text-[var(--accent)]">Granted</p>
          ) : status.configured ? (
            <button
              type="button"
              disabled={signerBusy || !address}
              onClick={() => void onGrantSigner()}
              className="type-ui shrink-0 cursor-pointer rounded-full bg-[var(--ink)] px-3 py-1.5 font-semibold text-[var(--canvas)] disabled:opacity-40"
            >
              {signerBusy ? "Granting…" : "Grant access"}
            </button>
          ) : (
            <p className="type-meta shrink-0 !text-[var(--muted)]">Not granted</p>
          )}
        </section>

        <section className="mt-4">
          <div className="flex items-baseline justify-between gap-2">
            <h3 className="type-ui text-[var(--ink)]">Gas</h3>
            <button
              type="button"
              disabled={loading || !address}
              onClick={() => void refresh()}
              className="type-meta cursor-pointer text-[var(--muted)] transition hover:!text-[var(--ink)] disabled:opacity-40"
            >
              {loading ? "Refreshing…" : "Refresh"}
            </button>
          </div>
          {needsGasNames.length > 0 && address ? (
            <p className="type-meta mt-1 !text-[var(--warn)]">
              {needsGasNames.length === 1
                ? `Needs ETH on ${needsGasNames[0]}`
                : needsGasNames.length <= 3
                  ? `Needs ETH on ${needsGasNames.join(", ")}`
                  : `Needs ETH on ${needsGasNames.length} chains`}
            </p>
          ) : null}
          <ul className="mt-1.5 max-h-44 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:thin]">
            {orderedChains.map((chain) => {
              const row = balanceByChain.get(chain.chainId);
              const balance = row?.balance ?? (loading ? "…" : "—");
              const needsGas = row?.needsGas ?? false;
              const meta = getSupportedChain(chain.chainId);
              const name = meta?.shortName ?? chain.shortName;
              const isHome = preferredChainId === chain.chainId;
              const explorer =
                address != null ? explorerFor(chain.chainId, address) : null;
              return (
                <li
                  key={chain.chainId}
                  className="flex items-center gap-2 rounded-lg px-1 py-1.5"
                >
                  <ChainLogo chainId={chain.chainId} size={16} />
                  <p className="type-ui min-w-0 flex-1 truncate text-[var(--ink)]">
                    {name}
                    {isHome ? (
                      <span className="type-meta !text-[var(--muted)]">
                        {" "}
                        · home
                      </span>
                    ) : null}
                  </p>
                  <p
                    className={`type-data shrink-0 !text-[length:var(--text-ui)] ${
                      needsGas && address
                        ? "!text-[var(--warn)]"
                        : "!text-[var(--ink-soft)]"
                    }`}
                  >
                    {balance} {row?.symbol ?? "ETH"}
                  </p>
                  {explorer ? (
                    <a
                      href={explorer.url}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex size-5 shrink-0 items-center justify-center rounded text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--link)]"
                      aria-label={`Open on ${explorer.label}`}
                      title={explorer.label}
                    >
                      <ExternalLinkIcon />
                    </a>
                  ) : (
                    <span className="size-5 shrink-0" aria-hidden />
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <div className="mt-3 border-t border-[var(--line-soft)] pt-2.5">
          <button
            type="button"
            onClick={onLogout}
            className="type-ui w-full cursor-pointer rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)]"
          >
            Log out
          </button>
        </div>
      </div>
    </>
  );
}
