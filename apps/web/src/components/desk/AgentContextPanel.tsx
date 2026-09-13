"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  AGENT_COLORS,
  AGENT_FACES,
  SUPPORTED_CHAINS,
  chainLabel,
  type AvatarId,
  type OrbColorId,
  type RunMode,
  type SupportedChainId,
} from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";
import { ChainName, ChainPicker } from "@/components/ChainLogo";
import { OrbColorSwatch } from "@/components/OrbColorSwatch";
import {
  armStrategy,
  disarmStrategy,
  getAgent,
  getHostMeta,
  pauseStrategy,
  resumeStrategy,
  updateAgent,
  type AgentWithWorkspace,
} from "@/lib/host";
import { ActivityTrail } from "./ActivityTrail";
import { StrategyCard } from "./StrategyCard";
import { AgentPluginsPanel } from "./AgentPluginsPanel";
import { useToast } from "@/components/Toast";
import { useHostSigner } from "@/hooks/useHostSigner";

type PanelView = "desk" | "settings" | "plugins";

export function AgentContextPanel({
  agent,
  onAgentUpdated,
  onCollapse,
}: {
  agent: AgentWithWorkspace | null;
  onAgentUpdated?: (agent: AgentWithWorkspace) => void;
  /** Hide the desk rail (desktop). */
  onCollapse?: () => void;
}) {
  const [view, setView] = useState<PanelView>("desk");

  useEffect(() => {
    setView("desk");
  }, [agent?.id]);

  if (!agent) {
    return (
      <div className="flex min-h-0 flex-1 flex-col">
        <DeskPanelHeader
          title="Desk"
          onCollapse={onCollapse}
        />
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="type-ui text-[var(--muted)]">
            Select an agent to see status and details.
          </p>
        </div>
      </div>
    );
  }

  const title =
    view === "settings" ? "Settings" : view === "plugins" ? "Plugins" : "Desk";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <DeskPanelHeader
        title={title}
        onCollapse={onCollapse}
        view={view}
        onToggleSettings={() =>
          setView((v) => (v === "settings" ? "desk" : "settings"))
        }
        onTogglePlugins={() =>
          setView((v) => (v === "plugins" ? "desk" : "plugins"))
        }
      />

      <div className="desk-scroll flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
        {view === "settings" ? (
          <AgentSettingsForm
            agent={agent}
            onSaved={(updated) => {
              onAgentUpdated?.(updated);
              setView("desk");
            }}
            onCancel={() => setView("desk")}
          />
        ) : view === "plugins" ? (
          <AgentPluginsPanel
            agentId={agent.id}
            onClose={() => setView("desk")}
          />
        ) : (
          <AgentContextSummary
            agent={agent}
            onAgentUpdated={onAgentUpdated}
          />
        )}
      </div>
    </div>
  );
}

function DeskPanelHeader({
  title,
  onCollapse,
  view,
  onToggleSettings,
  onTogglePlugins,
}: {
  title: string;
  onCollapse?: () => void;
  view?: PanelView;
  onToggleSettings?: () => void;
  onTogglePlugins?: () => void;
}) {
  return (
    <div className="flex shrink-0 items-center justify-between gap-2 px-4 py-3">
      <h2 className="type-title text-[var(--ink)]">{title}</h2>
      <div className="flex items-center gap-0.5">
        {onTogglePlugins ? (
          <button
            type="button"
            onClick={onTogglePlugins}
            aria-pressed={view === "plugins"}
            aria-label={view === "plugins" ? "Close plugins" : "Open plugins"}
            title={view === "plugins" ? "Close plugins" : "Plugins"}
            className={`flex size-8 cursor-pointer items-center justify-center rounded-lg transition ${
              view === "plugins"
                ? "bg-[var(--panel-2)] text-[var(--ink)]"
                : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
            }`}
          >
            <PluginsIcon />
          </button>
        ) : null}
        {onToggleSettings ? (
          <button
            type="button"
            onClick={onToggleSettings}
            aria-pressed={view === "settings"}
            aria-label={view === "settings" ? "Close settings" : "Open settings"}
            title={view === "settings" ? "Close settings" : "Settings"}
            className={`flex size-8 cursor-pointer items-center justify-center rounded-lg transition ${
              view === "settings"
                ? "bg-[var(--panel-2)] text-[var(--ink)]"
                : "text-[var(--muted)] hover:bg-[var(--panel)] hover:text-[var(--ink)]"
            }`}
          >
            <SettingsIcon />
          </button>
        ) : null}
        {onCollapse ? (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Hide desk"
            className="chain-tip group/chain relative flex size-8 cursor-pointer items-center justify-center rounded-lg text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
          >
            <ChevronsRightIcon />
            <span role="tooltip" className="chain-tip-bubble chain-tip-bubble--left">
              Hide desk
            </span>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ChevronsRightIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M13 17l5-5-5-5M6 17l5-5-5-5"
      />
    </svg>
  );
}

function AgentContextSummary({
  agent,
  onAgentUpdated,
}: {
  agent: AgentWithWorkspace;
  onAgentUpdated?: (agent: AgentWithWorkspace) => void;
}) {
  const isWorking = agent.status === "working";
  const strategyRunning = agent.strategy?.status === "running";
  const onAgentUpdatedRef = useRef(onAgentUpdated);
  onAgentUpdatedRef.current = onAgentUpdated;
  const [posturePending, startPosture] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const [hostAllowsLive, setHostAllowsLive] = useState(false);
  const toast = useToast();
  const { ensureHostSigner } = useHostSigner();

  useEffect(() => {
    let cancelled = false;
    void getHostMeta()
      .then((meta) => {
        if (!cancelled) setHostAllowsLive(meta.hostAllowsLive);
      })
      .catch(() => {
        if (!cancelled) setHostAllowsLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!strategyRunning) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const latest = await getAgent(agent.id);
        if (!cancelled) onAgentUpdatedRef.current?.(latest);
      } catch {
        // ignore transient poll errors
      }
    };
    const id = window.setInterval(() => {
      void refresh();
    }, 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [agent.id, strategyRunning]);

  function patchAgent(input: { runMode?: RunMode }) {
    if (posturePending || isWorking) return;
    startPosture(async () => {
      try {
        const updated = await updateAgent(agent.id, input);
        onAgentUpdatedRef.current?.(updated);
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Could not update run mode",
        );
      }
    });
  }

  function requestRunModeChange(runMode: RunMode) {
    if (runMode === agent.runMode || posturePending || isWorking) return;
    if (runMode === "live" && !hostAllowsLive) {
      toast.error(
        "Live is disabled on this host — set SQUADRONS_EXECUTION_MODE=live",
      );
      return;
    }
    setConfirm(
      runModeConfirmRequest(runMode, () => {
        setConfirm(null);
        if (runMode !== "live") {
          patchAgent({ runMode });
          return;
        }
        if (posturePending || isWorking) return;
        startPosture(async () => {
          try {
            const signer = await ensureHostSigner();
            const updated = await updateAgent(agent.id, { runMode });
            onAgentUpdatedRef.current?.(updated);
            if (!signer.alreadyDelegated) {
              toast.info("Host can now sign for this wallet");
            }
          } catch (err) {
            toast.error(
              err instanceof Error
                ? err.message
                : "Could not enable Live — host wallet access failed",
            );
          }
        });
      }, chainLabel(agent.chainId)),
    );
  }

  const postureDisabled = posturePending || isWorking;

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-6">
      <section className="flex shrink-0 flex-col gap-1.5">
        <div className="flex items-center gap-2.5">
          <ChainName chainId={agent.chainId} size={18} tipPlacement="right" />
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            <RunModeToggle
              value={agent.runMode}
              disabled={postureDisabled}
              hostAllowsLive={hostAllowsLive}
              onChange={requestRunModeChange}
            />
          </div>
        </div>
      </section>

      <StrategyCard
        runMode={agent.runMode}
        strategy={agent.strategy}
        agentId={agent.id}
        chainId={agent.chainId}
        agentWorking={isWorking}
        onAgentUpdated={onAgentUpdated}
        onAction={async (action) => {
          const updated =
            action === "arm"
              ? await armStrategy(agent.id)
              : action === "pause"
                ? await pauseStrategy(agent.id)
                : action === "resume"
                  ? await resumeStrategy(agent.id)
                  : await disarmStrategy(agent.id);
          onAgentUpdated?.(updated);
          return updated;
        }}
      />

      <ActivityTrail
        agentId={agent.id}
        agentName={agent.name}
        live={agent.strategy?.status === "running"}
        showTradeScoreboard={agent.strategy?.action.type === "propose_trade"}
        onLiveEvent={(event) => {
          const shouldRefresh =
            event.label === "Saved strategy draft" ||
            event.label === "Armed strategy" ||
            event.label === "Paused strategy" ||
            event.label === "Resumed strategy" ||
            event.label === "Disarmed strategy" ||
            event.label === "Updated strategy params" ||
            event.label === "Updated self-improvement" ||
            event.label === "Self-improvement review" ||
            event.label === "Self-improvement suggested" ||
            event.label === "Self-improvement approved" ||
            event.label === "Self-improvement dismissed" ||
            event.label === "Self-improvement failed" ||
            event.label === "Self-improvement skipped" ||
            event.label === "Spend enabled" ||
            event.label.startsWith("Run mode set to");
          if (!shouldRefresh) return;
          void getAgent(agent.id)
            .then((latest) => onAgentUpdatedRef.current?.(latest))
            .catch(() => undefined);
        }}
      />

      <ConfirmDialog
        request={confirm}
        busy={posturePending}
        onCancel={() => setConfirm(null)}
      />
    </div>
  );
}

type ConfirmRequest = {
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
};

function runModeConfirmRequest(
  next: RunMode,
  onConfirm: () => void,
  homeChainName: string,
): ConfirmRequest {
  if (next === "live") {
    return {
      title: "Go live?",
      body: `This agent can broadcast capped trades on ${homeChainName}. You’ll grant Squadrons permission to sign from your embedded wallet. Token allowances still need chat approval before first spend.`,
      confirmLabel: "Go live",
      onConfirm,
    };
  }
  if (next === "paper") {
    return {
      title: "Switch to paper?",
      body: "Strategies will quote and record paper fills. Nothing is broadcast on-chain.",
      confirmLabel: "Paper trading",
      onConfirm,
    };
  }
  return {
    title: "Switch to observe?",
    body: "This agent will stop proposing trades until you move to Paper or Live.",
    confirmLabel: "Observe only",
    onConfirm,
  };
}

function ConfirmDialog({
  request,
  busy,
  onCancel,
}: {
  request: ConfirmRequest | null;
  busy?: boolean;
  onCancel: () => void;
}) {
  if (!request) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/65 p-4"
      role="presentation"
      onClick={() => {
        if (!busy) onCancel();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="desk-confirm-title"
        className="w-full max-w-sm rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-4 shadow-[0_16px_48px_rgb(0_0_0_/_0.55)]"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 id="desk-confirm-title" className="type-ui text-[var(--ink)]">
          {request.title}
        </h3>
        <p className="type-meta mt-2 text-[var(--ink-soft)]">{request.body}</p>
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={request.onConfirm}
            className="type-ui flex-1 cursor-pointer rounded-full bg-[var(--ink)] px-3 py-2 font-semibold text-[var(--canvas)] disabled:opacity-40"
          >
            {busy ? "Working…" : request.confirmLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="type-ui flex-1 cursor-pointer rounded-full px-3 py-2 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

/** Always-visible Observe | Paper | Live control. */
function RunModeToggle({
  value,
  disabled,
  hostAllowsLive,
  onChange,
}: {
  value: RunMode;
  disabled?: boolean;
  hostAllowsLive: boolean;
  onChange: (next: RunMode) => void;
}) {
  const options: Array<{
    id: RunMode;
    label: string;
    locked?: boolean;
  }> = [
    { id: "observe", label: "Observe" },
    { id: "paper", label: "Paper" },
    {
      id: "live",
      label: "Live",
      locked: !hostAllowsLive,
    },
  ];

  return (
    <div
      className={`inline-flex items-center gap-0.5 rounded-full bg-[var(--panel)] p-0.5 ring-1 ring-[var(--line)] ${
        disabled ? "opacity-50" : ""
      }`}
      role="group"
      aria-label="Run mode"
    >
      {options.map((option) => {
        const selected = option.id === value;
        const locked = Boolean(option.locked);
        return (
          <button
            key={option.id}
            type="button"
            disabled={disabled || locked}
            title={
              locked
                ? "Host ceiling is paper-only (SQUADRONS_EXECUTION_MODE)"
                : undefined
            }
            aria-pressed={selected}
            onClick={() => {
              if (selected || locked || disabled) return;
              onChange(option.id);
            }}
            className={`type-ui rounded-full px-3 py-1 transition ${
              selected
                ? "bg-[var(--ink)] !font-semibold !text-[var(--canvas)]"
                : locked
                  ? "cursor-not-allowed !text-[var(--muted)] opacity-40"
                  : "cursor-pointer !text-[var(--ink-soft)] hover:bg-[var(--panel-2)] hover:!text-[var(--ink)]"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}

function AgentSettingsForm({
  agent,
  onSaved,
  onCancel,
}: {
  agent: AgentWithWorkspace;
  onSaved: (agent: AgentWithWorkspace) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(agent.name);
  const [description, setDescription] = useState(agent.description);
  const [avatarId, setAvatarId] = useState<AvatarId>(agent.avatarId);
  const [colorId, setColorId] = useState<OrbColorId>(agent.colorId);
  const [chainId, setChainId] = useState<SupportedChainId>(agent.chainId);
  const [runMode, setRunMode] = useState<RunMode>(agent.runMode);
  const [hostAllowsLive, setHostAllowsLive] = useState(false);
  const [pending, startTransition] = useTransition();
  const [confirm, setConfirm] = useState<ConfirmRequest | null>(null);
  const toast = useToast();
  const { ensureHostSigner } = useHostSigner();

  const chainLocked = agent.status === "working";

  useEffect(() => {
    let cancelled = false;
    void getHostMeta()
      .then((meta) => {
        if (!cancelled) setHostAllowsLive(meta.hostAllowsLive);
      })
      .catch(() => {
        if (!cancelled) setHostAllowsLive(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setName(agent.name);
    setDescription(agent.description);
    setAvatarId(agent.avatarId);
    setColorId(agent.colorId);
    setChainId(agent.chainId);
    setRunMode(agent.runMode);
    setConfirm(null);
  }, [agent]);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const enablingLive =
      runMode === "live" && agent.runMode !== "live";

    const save = () => {
      startTransition(async () => {
        try {
          if (enablingLive) {
            await ensureHostSigner();
          }
          const updated = await updateAgent(agent.id, {
            name,
            description,
            avatarId,
            colorId,
            chainId: chainLocked ? undefined : chainId,
            runMode,
          });
          onSaved(updated);
        } catch (err) {
          toast.error(err instanceof Error ? err.message : "Save failed");
        }
      });
    };

    if (enablingLive) {
      if (!hostAllowsLive) {
        toast.error(
          "Live is disabled on this host — set SQUADRONS_EXECUTION_MODE=live",
        );
        return;
      }
      setConfirm(
        runModeConfirmRequest("live", () => {
          setConfirm(null);
          save();
        }, chainLabel(chainId)),
      );
      return;
    }
    save();
  }

  return (
    <>
      <form onSubmit={onSubmit} className="space-y-5">
        <fieldset className="space-y-2">
          <legend className="type-label">Face</legend>
          <div className="grid grid-cols-4 gap-1.5">
            {AGENT_FACES.map((face) => {
              const selected = face.id === avatarId;
              return (
                <button
                  key={face.id}
                  type="button"
                  onClick={() => setAvatarId(face.id)}
                  aria-pressed={selected}
                  aria-label={face.name}
                  className={`flex cursor-pointer items-center justify-center rounded-xl border p-1 transition ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--panel)]"
                      : "border-transparent hover:border-[var(--line)] hover:bg-[var(--panel)]"
                  }`}
                >
                  <AgentOrb
                    id={face.id}
                    colorId={colorId}
                    size={36}
                    animate={selected}
                  />
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="type-label">Color</legend>
          <div className="flex flex-nowrap gap-1.5">
            {AGENT_COLORS.map((color) => {
              const selected = color.id === colorId;
              return (
                <button
                  key={color.id}
                  type="button"
                  onClick={() => setColorId(color.id)}
                  aria-pressed={selected}
                  aria-label={color.name}
                  className={`flex cursor-pointer items-center justify-center rounded-full border p-0.5 transition ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--panel)]"
                      : "border-transparent hover:border-[var(--line)] hover:bg-[var(--panel)]"
                  }`}
                >
                  <OrbColorSwatch colorId={color.id} size={24} />
                </button>
              );
            })}
          </div>
        </fieldset>

        <label className="block space-y-2">
          <span className="type-label">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="type-ui w-full rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[var(--ink)] placeholder:text-[var(--muted)]"
          />
        </label>

        <label className="block space-y-2">
          <span className="type-label">Description</span>
          <textarea
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="type-ui w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--panel)] px-3 py-2.5 text-[var(--ink)] placeholder:text-[var(--muted)]"
          />
        </label>

        <fieldset className="space-y-2">
          <legend className="type-label">Chain</legend>
          <ChainPicker
            value={chainId}
            onChange={setChainId}
            disabled={chainLocked}
          />
          {chainLocked ? (
            <p className="type-meta">
              Chain can change when the agent is not working.
            </p>
          ) : chainId !== agent.chainId ? (
            <p className="type-meta">
              Switching home chain moves tools to{" "}
              {SUPPORTED_CHAINS.find((c) => c.chainId === chainId)?.shortName}.
              Chat history is kept.
            </p>
          ) : null}
        </fieldset>

        <fieldset className="space-y-2">
          <legend className="type-label">Run mode</legend>
          <div className="flex gap-1.5">
            {(
              [
                { id: "observe" as const, label: "Observe" },
                { id: "paper" as const, label: "Paper" },
                { id: "live" as const, label: "Live" },
              ] as const
            ).map((option) => {
              const selected = runMode === option.id;
              const locked = option.id === "live" && !hostAllowsLive;
              return (
                <button
                  key={option.id}
                  type="button"
                  disabled={locked}
                  title={
                    locked
                      ? "Live is disabled on this host"
                      : undefined
                  }
                  onClick={() => {
                    if (option.id === runMode || locked) return;
                    setConfirm(
                      runModeConfirmRequest(option.id, () => {
                        setConfirm(null);
                        setRunMode(option.id);
                      }, chainLabel(chainId)),
                    );
                  }}
                  aria-pressed={selected}
                  className={`flex flex-1 cursor-pointer items-center justify-center rounded-xl border px-3 py-2.5 transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    selected
                      ? "border-[var(--accent)] bg-[var(--panel)]"
                      : "border-[var(--line)] hover:border-[var(--line)] hover:bg-[var(--panel)]"
                  }`}
                >
                  <span className="type-ui text-[var(--ink)]">{option.label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={pending}
            className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? "Saving…" : "Save"}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={pending}
            className="type-ui cursor-pointer rounded-full px-4 py-2 text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </form>

      <ConfirmDialog
        request={confirm}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
}

function SettingsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9c.2.6.7 1.1 1.5 1.1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z"
      />
    </svg>
  );
}

function PluginsIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M15.39 4.39a1 1 0 0 0 1.68-.474 2.5 2.5 0 1 1 3.014 3.015 1 1 0 0 0-.474 1.68l1.683 1.682a2.414 2.414 0 0 1 0 3.414L19.61 15.39a1 1 0 0 1-1.68-.474 2.5 2.5 0 1 0-3.014 3.015 1 1 0 0 1 .474 1.68l-1.683 1.682a2.414 2.414 0 0 1-3.414 0L8.61 19.61a1 1 0 0 0-1.68.474 2.5 2.5 0 1 1-3.014-3.015 1 1 0 0 0 .474-1.68l-1.683-1.682a2.414 2.414 0 0 1 0-3.414L4.39 8.61a1 1 0 0 1 1.68.474 2.5 2.5 0 1 0 3.014-3.015 1 1 0 0 1-.474-1.68l1.683-1.682a2.414 2.414 0 0 1 3.414 0z" />
    </svg>
  );
}
