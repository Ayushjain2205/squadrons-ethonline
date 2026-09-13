"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  displayActivityLabel,
  filterDeskSkills,
  filterMentionablePlugins,
  matchAtPluginQuery,
  matchSlashSkillQuery,
  mentionablePlugins,
  parseAllowanceApprovalMarker,
  parseBacktestArtifact,
  parseChainSearchArtifact,
  parseSubstreamsPipelineArtifact,
  parseTradeOutcomeMarker,
  stripAllowanceApprovalMarker,
  stripTradeOutcomeMarker,
  chainLabel,
  type AgentPluginView,
  type AvatarId,
  type BacktestArtifact,
  type ChainSearchArtifact,
  type DeskSkill,
  type OrbColorId,
  type SubstreamsPipelineArtifact,
} from "@squadrons/shared";
import { AgentOrb } from "@/components/AgentOrb";
import { BacktestChartCard } from "@/components/desk/BacktestChartCard";
import { ChainSearchCard } from "@/components/desk/ChainSearchCard";
import { SubstreamsPipelineCard } from "@/components/desk/SubstreamsPipelineCard";
import { PluginAtMenu } from "@/components/desk/PluginAtMenu";
import { SkillSlashMenu } from "@/components/desk/SkillSlashMenu";
import {
  SkillComposerBackdrop,
  SkillHighlightedText,
} from "@/components/desk/SkillHighlightedText";
import {
  approveTradeAllowance,
  dismissTradeAllowance,
  getAgent,
  listAgentPlugins,
  listMessages,
  listTradeIntents,
  pauseAgent,
  sendMessage,
  subscribeActivity,
  type AgentMessage,
  type AgentWithWorkspace,
  type TradeIntentRecord,
} from "@/lib/host";
import { MarkdownContent } from "@/components/MarkdownContent";
import { useToast } from "@/components/Toast";
import { useHostSigner } from "@/hooks/useHostSigner";
import { sanitizeAssistantContent } from "@/lib/sanitize-assistant";

type ChatToolStep = {
  id: string;
  label: string;
  toolName: string | null;
  status: "running" | "done" | "error";
  detail: string | null;
  artifact?: BacktestArtifact | null;
};

export function AgentChat({
  agent: initialAgent,
  initialMessages,
  onAgentUpdated,
}: {
  agent: AgentWithWorkspace;
  initialMessages: AgentMessage[];
  onAgentUpdated?: (agent: AgentWithWorkspace) => void;
}) {
  const [agent, setAgent] = useState(initialAgent);
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const [pending, startTransition] = useTransition();
  const [pausing, setPausing] = useState(false);
  const toast = useToast();
  const { ensureHostSigner } = useHostSigner();
  const [liveSteps, setLiveSteps] = useState<ChatToolStep[]>([]);
  const [stepsByUserMessageId, setStepsByUserMessageId] = useState<
    Record<string, ChatToolStep[]>
  >({});
  const [chartsByUserMessageId, setChartsByUserMessageId] = useState<
    Record<string, BacktestArtifact[]>
  >({});
  const [searchesByUserMessageId, setSearchesByUserMessageId] = useState<
    Record<string, ChainSearchArtifact[]>
  >({});
  const [pipelinesByUserMessageId, setPipelinesByUserMessageId] = useState<
    Record<string, SubstreamsPipelineArtifact[]>
  >({});
  const [activeUserMessageId, setActiveUserMessageId] = useState<string | null>(
    null,
  );
  const pendingChartsRef = useRef<BacktestArtifact[]>([]);
  const pendingSearchesRef = useRef<ChainSearchArtifact[]>([]);
  const pendingPipelinesRef = useRef<SubstreamsPipelineArtifact[]>([]);
  const activeUserMessageIdRef = useRef<string | null>(null);
  activeUserMessageIdRef.current = activeUserMessageId;
  const [awaitingAllowance, setAwaitingAllowance] = useState<
    TradeIntentRecord[]
  >([]);
  const [allowanceBusyId, setAllowanceBusyId] = useState<string | null>(null);
  const [allowancePhase, setAllowancePhase] = useState<
    "signer" | "broadcast" | null
  >(null);
  const [slashOpen, setSlashOpen] = useState(false);
  const [slashQuery, setSlashQuery] = useState("");
  const [slashRange, setSlashRange] = useState<{ start: number; end: number } | null>(
    null,
  );
  const [slashIndex, setSlashIndex] = useState(0);
  const [atOpen, setAtOpen] = useState(false);
  const [atQuery, setAtQuery] = useState("");
  const [atRange, setAtRange] = useState<{ start: number; end: number } | null>(
    null,
  );
  const [atIndex, setAtIndex] = useState(0);
  const [plugins, setPlugins] = useState<AgentPluginView[]>([]);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const liveStepsRef = useRef<ChatToolStep[]>([]);
  liveStepsRef.current = liveSteps;

  const slashSkills = useMemo(
    () => filterDeskSkills(slashQuery),
    [slashQuery],
  );
  const atPlugins = useMemo(
    () => filterMentionablePlugins(plugins, atQuery),
    [plugins, atQuery],
  );
  const pluginServerNames = useMemo(
    () => mentionablePlugins(plugins).map((plugin) => plugin.serverName),
    [plugins],
  );
  const showSlashMenu = slashOpen && !pending;
  const showAtMenu = atOpen && !pending;

  function refreshAllowanceRequests() {
    void listTradeIntents(agent.id, 20)
      .then((data) => setAwaitingAllowance(data.awaitingAllowance ?? []))
      .catch(() => setAwaitingAllowance([]));
  }

  useEffect(() => {
    setAgent(initialAgent);
  }, [initialAgent]);

  useEffect(() => {
    setMessages(initialMessages);
    setStepsByUserMessageId({});
    setChartsByUserMessageId({});
    setSearchesByUserMessageId({});
    setPipelinesByUserMessageId({});
    setLiveSteps([]);
    setActiveUserMessageId(null);
    pendingChartsRef.current = [];
    pendingSearchesRef.current = [];
    pendingPipelinesRef.current = [];
    setDraft("");
    closeSlashMenu();
    closeAtMenu();
    refreshAllowanceRequests();
  }, [initialAgent.id]); // eslint-disable-line react-hooks/exhaustive-deps -- only reset transcript when switching agents

  useEffect(() => {
    let cancelled = false;
    void listAgentPlugins(agent.id)
      .then((list) => {
        if (!cancelled) setPlugins(list);
      })
      .catch(() => {
        if (!cancelled) setPlugins([]);
      });
    return () => {
      cancelled = true;
    };
  }, [agent.id]);

  // Refresh when the @ menu opens so newly enabled plugins appear immediately.
  useEffect(() => {
    if (!atOpen) return;
    let cancelled = false;
    void listAgentPlugins(agent.id)
      .then((list) => {
        if (!cancelled) setPlugins(list);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [atOpen, agent.id]);

  useEffect(() => {
    if (slashIndex < slashSkills.length) return;
    setSlashIndex(0);
  }, [slashSkills.length, slashIndex]);

  useEffect(() => {
    if (atIndex < atPlugins.length) return;
    setAtIndex(0);
  }, [atPlugins.length, atIndex]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, pending, liveSteps, awaitingAllowance]);

  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [draft]);

  // One Approve card per pending intent — attach to the latest marker message only.
  const allowanceCardMessageIds = useMemo(() => {
    const awaitingIds = new Set(awaitingAllowance.map((row) => row.id));
    const latestByIntent = new Map<string, string>();
    for (const message of messages) {
      if (message.role !== "system") continue;
      const intentId = parseAllowanceApprovalMarker(message.content);
      if (!intentId || !awaitingIds.has(intentId)) continue;
      latestByIntent.set(intentId, message.id);
    }
    return new Set(latestByIntent.values());
  }, [messages, awaitingAllowance]);

  // Strategy may post allowance cards / outcomes while chat is idle — listen always.
  useEffect(() => {
    const unsubscribe = subscribeActivity(agent.id, (event) => {
      if (event.source !== "strategy" && event.source !== "system") return;
      refreshAllowanceRequests();
      // Any strategy/system activity may append a chat message (allowance, trade, etc.)
      void listMessages(agent.id)
        .then(setMessages)
        .catch(() => {});
    });
    return unsubscribe;
  }, [agent.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // GenUI artifacts (backtest / chain search / event pipeline) — always listen.
  useEffect(() => {
    const unsubscribe = subscribeActivity(agent.id, (event) => {
      if (event.source === "strategy") return;
      if (event.kind !== "tool_result") return;

      const backtest = parseBacktestArtifact(event.detail);
      if (backtest) {
        pendingChartsRef.current = [...pendingChartsRef.current, backtest];
        const anchorId = activeUserMessageIdRef.current;
        if (anchorId) {
          setChartsByUserMessageId((prev) => ({
            ...prev,
            [anchorId]: [...(prev[anchorId] ?? []), backtest],
          }));
        }

        setLiveSteps((prev) => {
          const label =
            displayActivityLabel(
              { ...event, kind: "tool_call" },
              { done: true },
            ) ?? event.label;
          const idx = [...prev]
            .reverse()
            .findIndex(
              (step) =>
                step.status === "running" ||
                (event.toolName != null && step.toolName === event.toolName),
            );
          if (idx === -1) {
            return [
              ...prev,
              {
                id: event.id,
                label,
                toolName: event.toolName,
                status: "done" as const,
                detail: event.detail,
                artifact: backtest,
              },
            ];
          }
          const realIndex = prev.length - 1 - idx;
          return prev.map((step, i) =>
            i === realIndex
              ? {
                  ...step,
                  status: "done" as const,
                  label,
                  detail: event.detail,
                  artifact: backtest ?? step.artifact,
                }
              : step,
          );
        });
        return;
      }

      const search = parseChainSearchArtifact(event.detail);
      if (search) {
        pendingSearchesRef.current = [...pendingSearchesRef.current, search];
        const anchorId = activeUserMessageIdRef.current;
        if (anchorId) {
          setSearchesByUserMessageId((prev) => ({
            ...prev,
            [anchorId]: [...(prev[anchorId] ?? []), search],
          }));
        }

        setLiveSteps((prev) => {
          const label =
            displayActivityLabel(
              { ...event, kind: "tool_call" },
              { done: true },
            ) ?? event.label;
          const idx = [...prev]
            .reverse()
            .findIndex(
              (step) =>
                step.status === "running" ||
                (event.toolName != null && step.toolName === event.toolName),
            );
          if (idx === -1) {
            return [
              ...prev,
              {
                id: event.id,
                label,
                toolName: event.toolName,
                status: "done" as const,
                detail: event.detail,
              },
            ];
          }
          const realIndex = prev.length - 1 - idx;
          return prev.map((step, i) =>
            i === realIndex
              ? {
                  ...step,
                  status: "done" as const,
                  label,
                  detail: event.detail,
                }
              : step,
          );
        });
        return;
      }

      const pipeline = parseSubstreamsPipelineArtifact(event.detail);
      if (!pipeline) return;

      pendingPipelinesRef.current = [
        ...pendingPipelinesRef.current,
        pipeline,
      ];
      const anchorId = activeUserMessageIdRef.current;
      if (anchorId) {
        setPipelinesByUserMessageId((prev) => ({
          ...prev,
          [anchorId]: [...(prev[anchorId] ?? []), pipeline],
        }));
      }

      setLiveSteps((prev) => {
        const label =
          displayActivityLabel(
            { ...event, kind: "tool_call" },
            { done: true },
          ) ?? event.label;
        const idx = [...prev]
          .reverse()
          .findIndex(
            (step) =>
              step.status === "running" ||
              (event.toolName != null && step.toolName === event.toolName),
          );
        if (idx === -1) {
          return [
            ...prev,
            {
              id: event.id,
              label,
              toolName: event.toolName,
              status: "done" as const,
              detail: event.detail,
            },
          ];
        }
        const realIndex = prev.length - 1 - idx;
        return prev.map((step, i) =>
          i === realIndex
            ? {
                ...step,
                status: "done" as const,
                label,
                detail: event.detail,
              }
            : step,
        );
      });
    });
    return unsubscribe;
  }, [agent.id]);

  // Live chat tool steps while a turn is in flight (Cursor-style).
  useEffect(() => {
    if (!pending && agent.status !== "working") return;
    const unsubscribe = subscribeActivity(agent.id, (event) => {
      if (event.source === "strategy") return;
      if (event.kind !== "tool_call" && event.kind !== "error") return;
      if (event.kind === "error" && !event.toolName) return;

      setLiveSteps((prev) => {
        if (event.kind === "tool_call") {
          const label =
            displayActivityLabel(event, { done: false }) ?? event.label;
          const next = prev.map((step) =>
            step.status === "running" ? { ...step, status: "done" as const } : step,
          );
          return [
            ...next,
            {
              id: event.id,
              label,
              toolName: event.toolName,
              status: "running",
              detail: null,
              artifact: null,
            },
          ];
        }

        // tool error — mark matching/running step failed
        const label =
          displayActivityLabel(event, { done: true }) ?? event.label;
        const idx = [...prev]
          .reverse()
          .findIndex(
            (step) =>
              step.status === "running" ||
              (event.toolName != null && step.toolName === event.toolName),
          );
        if (idx === -1) {
          return [
            ...prev,
            {
              id: event.id,
              label,
              toolName: event.toolName,
              status: "error",
              detail: event.detail,
              artifact: null,
            },
          ];
        }
        const realIndex = prev.length - 1 - idx;
        return prev.map((step, i) =>
          i === realIndex
            ? {
                ...step,
                status: "error" as const,
                label,
                detail: event.detail,
              }
            : step,
        );
      });
    });
    return unsubscribe;
  }, [agent.id, agent.status, pending]);

  function applyAgent(next: AgentWithWorkspace) {
    setAgent(next);
    onAgentUpdated?.(next);
  }

  function resolveAllowance(intentId: string, kind: "approve" | "dismiss") {
    if (allowanceBusyId) return;
    setAllowanceBusyId(intentId);
    setAllowancePhase(kind === "approve" ? "signer" : null);
    startTransition(async () => {
      try {
        if (kind === "approve") {
          setAllowancePhase("signer");
          await ensureHostSigner();
          setAllowancePhase("broadcast");
          const result = await approveTradeAllowance(agent.id, intentId);
          if (result.outcome) {
            if (result.outcome.kind === "failed") {
              toast.error(result.outcome.title);
            } else {
              toast.info(result.outcome.title);
            }
          }
        } else {
          await dismissTradeAllowance(agent.id, intentId);
          toast.info("Allowance dismissed");
        }
        const nextMessages = await listMessages(agent.id);
        setMessages(nextMessages);
        refreshAllowanceRequests();
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Allowance action failed",
        );
      } finally {
        setAllowanceBusyId(null);
        setAllowancePhase(null);
      }
    });
  }

  function closeSlashMenu() {
    setSlashOpen(false);
    setSlashQuery("");
    setSlashRange(null);
    setSlashIndex(0);
  }

  function closeAtMenu() {
    setAtOpen(false);
    setAtQuery("");
    setAtRange(null);
    setAtIndex(0);
  }

  function syncComposerTriggers(nextDraft: string, cursor?: number) {
    const pos =
      cursor ??
      inputRef.current?.selectionStart ??
      nextDraft.length;
    const slash = matchSlashSkillQuery(nextDraft, pos);
    if (slash) {
      closeAtMenu();
      setSlashOpen(true);
      setSlashQuery(slash.query);
      setSlashRange({ start: slash.start, end: slash.end });
      setSlashIndex(0);
      return;
    }
    const at = matchAtPluginQuery(nextDraft, pos);
    if (at) {
      closeSlashMenu();
      setAtOpen(true);
      setAtQuery(at.query);
      setAtRange({ start: at.start, end: at.end });
      setAtIndex(0);
      return;
    }
    closeSlashMenu();
    closeAtMenu();
  }

  function insertSkill(skill: DeskSkill) {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? draft.length;
    const match =
      slashRange ??
      (() => {
        const found = matchSlashSkillQuery(draft, cursor);
        return found
          ? { start: found.start, end: found.end }
          : { start: cursor, end: cursor };
      })();
    const token = `/${skill.name} `;
    const next = draft.slice(0, match.start) + token + draft.slice(match.end);
    const nextCursor = match.start + token.length;
    setDraft(next);
    closeSlashMenu();
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function insertPlugin(plugin: AgentPluginView) {
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? draft.length;
    const match =
      atRange ??
      (() => {
        const found = matchAtPluginQuery(draft, cursor);
        return found
          ? { start: found.start, end: found.end }
          : { start: cursor, end: cursor };
      })();
    const token = `@${plugin.serverName} `;
    const next = draft.slice(0, match.start) + token + draft.slice(match.end);
    const nextCursor = match.start + token.length;
    setDraft(next);
    closeAtMenu();
    requestAnimationFrame(() => {
      const input = inputRef.current;
      if (!input) return;
      input.focus();
      input.setSelectionRange(nextCursor, nextCursor);
    });
  }

  function openSlashPicker() {
    if (pending) return;
    closeAtMenu();
    const el = inputRef.current;
    const cursor = el?.selectionStart ?? draft.length;
    const before = draft.slice(0, cursor);
    const needsSlash = !/(^|\s)$/.test(before) && before.length > 0;
    const insertAt = cursor;
    const prefix = needsSlash ? " /" : before.endsWith("/") ? "" : "/";
    if (prefix) {
      const next = draft.slice(0, insertAt) + prefix + draft.slice(insertAt);
      const nextCursor = insertAt + prefix.length;
      setDraft(next);
      setSlashOpen(true);
      setSlashQuery("");
      setSlashRange({
        start: nextCursor - 1,
        end: nextCursor,
      });
      setSlashIndex(0);
      requestAnimationFrame(() => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        input.setSelectionRange(nextCursor, nextCursor);
      });
      return;
    }
    syncComposerTriggers(draft, cursor);
    el?.focus();
  }

  function onDraftChange(value: string) {
    setDraft(value);
    requestAnimationFrame(() => {
      syncComposerTriggers(
        value,
        inputRef.current?.selectionStart ?? value.length,
      );
    });
  }

  function onSend(event?: React.FormEvent) {
    event?.preventDefault();
    const content = draft.trim();
    if (!content || pending) return;
    closeSlashMenu();
    closeAtMenu();

    setDraft("");
    const optimisticId = `local-${Date.now()}`;
    setActiveUserMessageId(optimisticId);
    setLiveSteps([]);
    pendingChartsRef.current = [];
    pendingSearchesRef.current = [];
    pendingPipelinesRef.current = [];
    setChartsByUserMessageId((prev) => {
      const next = { ...prev };
      delete next[optimisticId];
      return next;
    });
    setSearchesByUserMessageId((prev) => {
      const next = { ...prev };
      delete next[optimisticId];
      return next;
    });
    setPipelinesByUserMessageId((prev) => {
      const next = { ...prev };
      delete next[optimisticId];
      return next;
    });
    setMessages((prev) => [
      ...prev,
      {
        id: optimisticId,
        agentId: agent.id,
        role: "user",
        content,
        createdAt: Date.now(),
      },
    ]);
    applyAgent({ ...agent, status: "working" });

    startTransition(async () => {
      try {
        const result = await sendMessage(agent.id, content);
        applyAgent(result.agent);
        const userMsg = result.messages.find((m) => m.role === "user");
        const steps = liveStepsRef.current.map((step) =>
          step.status === "running" ? { ...step, status: "done" as const } : step,
        );
        const chartsFromSteps = steps
          .map((step) => step.artifact)
          .filter((a): a is BacktestArtifact => a != null);
        const charts = [
          ...pendingChartsRef.current,
          ...chartsFromSteps,
        ].filter(
          (artifact, index, all) =>
            all.findIndex(
              (row) =>
                row.title === artifact.title &&
                row.stats.endEquity === artifact.stats.endEquity &&
                row.stats.days === artifact.stats.days,
            ) === index,
        );
        setMessages((prev) => {
          const withoutOptimistic = prev.filter((m) => m.id !== optimisticId);
          return [...withoutOptimistic, ...result.messages];
        });
        if (userMsg && steps.length > 0) {
          setStepsByUserMessageId((prev) => ({
            ...prev,
            [userMsg.id]: steps,
          }));
        }
        if (userMsg && charts.length > 0) {
          setChartsByUserMessageId((prev) => {
            const next = { ...prev };
            delete next[optimisticId];
            next[userMsg.id] = charts;
            return next;
          });
        }
        const searches = [...pendingSearchesRef.current].filter(
          (artifact, index, all) =>
            all.findIndex(
              (row) =>
                row.query === artifact.query &&
                row.title === artifact.title &&
                row.hits.length === artifact.hits.length,
            ) === index,
        );
        if (userMsg && searches.length > 0) {
          setSearchesByUserMessageId((prev) => {
            const next = { ...prev };
            delete next[optimisticId];
            next[userMsg.id] = searches;
            return next;
          });
        }
        const pipelines = [...pendingPipelinesRef.current].filter(
          (artifact, index, all) =>
            all.findIndex(
              (row) =>
                row.pipelineId === artifact.pipelineId &&
                row.title === artifact.title,
            ) === index,
        );
        if (userMsg && pipelines.length > 0) {
          setPipelinesByUserMessageId((prev) => {
            const next = { ...prev };
            delete next[optimisticId];
            next[userMsg.id] = pipelines;
            return next;
          });
        }
        setLiveSteps([]);
        pendingChartsRef.current = [];
        pendingSearchesRef.current = [];
        pendingPipelinesRef.current = [];
        setActiveUserMessageId(userMsg?.id ?? null);
      } catch (err) {
        try {
          const latest = await getAgent(agent.id);
          applyAgent(latest);
          if (latest.status === "paused") {
            const stored = await listMessages(agent.id);
            setMessages(stored);
            setDraft("");
            setLiveSteps([]);
            setActiveUserMessageId(null);
            return;
          }
        } catch {
          // fall through
        }
        setMessages((prev) => prev.filter((m) => m.id !== optimisticId));
        setDraft(content);
        toast.error(err instanceof Error ? err.message : "Send failed");
        applyAgent({ ...agent, status: "paused" });
        setLiveSteps([]);
        setActiveUserMessageId(null);
      }
    });
  }

  async function onPause() {
    if (pausing) return;
    setPausing(true);
    try {
      const updated = await pauseAgent(agent.id);
      applyAgent(updated);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Pause failed");
    } finally {
      setPausing(false);
    }
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (showSlashMenu) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeSlashMenu();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (slashSkills.length === 0) return;
        setSlashIndex((i) => (i + 1) % slashSkills.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (slashSkills.length === 0) return;
        setSlashIndex(
          (i) => (i - 1 + slashSkills.length) % slashSkills.length,
        );
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const skill = slashSkills[slashIndex];
        if (skill) insertSkill(skill);
        return;
      }
    }

    if (showAtMenu) {
      if (event.key === "Escape") {
        event.preventDefault();
        closeAtMenu();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        if (atPlugins.length === 0) return;
        setAtIndex((i) => (i + 1) % atPlugins.length);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        if (atPlugins.length === 0) return;
        setAtIndex((i) => (i - 1 + atPlugins.length) % atPlugins.length);
        return;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        event.preventDefault();
        const plugin = atPlugins[atIndex];
        if (plugin) insertPlugin(plugin);
        return;
      }
    }

    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      onSend();
    }
  }

  const placeholder = `Message ${agent.name}…`;
  const isWorking = pending || agent.status === "working";

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-[var(--line-soft)] px-4 py-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <Link
            href="/"
            className="rounded-lg p-1 text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)] md:hidden"
            aria-label="All agents"
          >
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <div className="relative shrink-0">
            <AgentOrb
              id={agent.avatarId}
              colorId={agent.colorId}
              size={32}
              animate={isWorking}
            />
            <span
              className={`absolute -right-0.5 -top-0.5 size-2.5 rounded-full border-2 border-[var(--canvas)] ${
                isWorking
                  ? "working-dot bg-[var(--accent)]"
                  : "bg-[var(--muted)]"
              }`}
              aria-hidden
            />
          </div>
          <div className="min-w-0">
            <h1 className="type-title truncate">{agent.name}</h1>
            {!isWorking && agent.description ? (
              <p className="type-meta truncate">{agent.description}</p>
            ) : null}
          </div>
        </div>
      </header>

      <div className="desk-scroll min-h-0 flex-1 overflow-y-auto px-4 py-5 sm:px-5">
        <div className="flex flex-col gap-3">
          {messages.length === 0 ? (
            <div className="rounded-[var(--radius-msg)] bg-[var(--msg-bot)] px-5 py-8 text-center">
              <p className="type-ui text-[var(--ink-soft)]">
                {`Message ${agent.name} to get started.`}
              </p>
            </div>
          ) : (
            messages.map((message) => {
              const isActiveUser =
                message.role === "user" &&
                message.id === activeUserMessageId &&
                isWorking;
              const stepsForMessage =
                message.role === "user"
                  ? isActiveUser
                    ? liveSteps
                    : stepsByUserMessageId[message.id]
                  : undefined;
              const showTurnChrome =
                message.role === "user" &&
                !!stepsForMessage &&
                stepsForMessage.length > 0;
              const chartsForMessage =
                message.role === "user"
                  ? chartsByUserMessageId[message.id] ??
                    stepsForMessage
                      ?.map((step) => step.artifact)
                      .filter((a): a is BacktestArtifact => a != null) ??
                    []
                  : [];
              const searchesForMessage =
                message.role === "user"
                  ? searchesByUserMessageId[message.id] ?? []
                  : [];
              const pipelinesForMessage =
                message.role === "user"
                  ? pipelinesByUserMessageId[message.id] ?? []
                  : [];
              const allowanceIntentId =
                message.role === "system"
                  ? parseAllowanceApprovalMarker(message.content)
                  : null;
              const pendingAllowance =
                allowanceIntentId && allowanceCardMessageIds.has(message.id)
                  ? awaitingAllowance.find((row) => row.id === allowanceIntentId)
                  : null;
              return (
                <div key={message.id} className="flex flex-col gap-2">
                  <MessageBubble
                    message={message}
                    pluginServerNames={pluginServerNames}
                  />
                  {pendingAllowance ? (
                    <AllowanceApprovalCard
                      intent={pendingAllowance}
                      chainName={chainLabel(agent.chainId)}
                      busy={allowanceBusyId === pendingAllowance.id}
                      phase={
                        allowanceBusyId === pendingAllowance.id
                          ? allowancePhase
                          : null
                      }
                      onApprove={() =>
                        resolveAllowance(pendingAllowance.id, "approve")
                      }
                      onDismiss={() =>
                        resolveAllowance(pendingAllowance.id, "dismiss")
                      }
                    />
                  ) : null}
                  {showTurnChrome ? (
                    <ChatToolSteps
                      steps={stepsForMessage}
                      live={isActiveUser}
                      hideCharts
                    />
                  ) : null}
                  {chartsForMessage.map((artifact, index) => (
                    <BacktestChartCard
                      key={`${message.id}-${artifact.title}-${artifact.stats.endEquity}-${index}`}
                      artifact={artifact}
                    />
                  ))}
                  {searchesForMessage.map((artifact, index) => (
                    <ChainSearchCard
                      key={`${message.id}-search-${artifact.title}-${artifact.query}-${index}`}
                      artifact={artifact}
                    />
                  ))}
                  {pipelinesForMessage.map((artifact, index) => (
                    <SubstreamsPipelineCard
                      key={`${message.id}-pipe-${artifact.pipelineId}-${index}`}
                      artifact={artifact}
                    />
                  ))}
                </div>
              );
            })
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="shrink-0 px-4 pb-4 pt-2 sm:px-5 sm:pb-5">
        {isWorking ? (
          <AgentWorkingStatus
            name={agent.name}
            avatarId={agent.avatarId}
            colorId={agent.colorId}
            className="mb-2 px-1"
          />
        ) : null}
        <form
          onSubmit={onSend}
          className="chat-composer relative flex w-full flex-col rounded-3xl border border-[var(--line)] bg-[var(--msg-bot)] px-3 pb-2 pt-3 shadow-[0_8px_30px_rgba(0,0,0,0.35)]"
        >
          {showSlashMenu ? (
            <SkillSlashMenu
              skills={slashSkills}
              activeIndex={Math.min(slashIndex, Math.max(slashSkills.length - 1, 0))}
              onActiveIndexChange={setSlashIndex}
              onSelect={insertSkill}
              onClose={closeSlashMenu}
            />
          ) : null}
          {showAtMenu ? (
            <PluginAtMenu
              plugins={atPlugins}
              activeIndex={Math.min(atIndex, Math.max(atPlugins.length - 1, 0))}
              onActiveIndexChange={setAtIndex}
              onSelect={insertPlugin}
              onClose={closeAtMenu}
            />
          ) : null}
          <div
            className={`relative min-w-0 ${pending ? "opacity-60" : ""}`}
          >
            <SkillComposerBackdrop
              value={draft}
              pluginServerNames={pluginServerNames}
              className="chat-input type-body absolute inset-0 max-h-40 overflow-hidden px-1 leading-5"
            />
            <textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => onDraftChange(e.target.value)}
              onKeyDown={onKeyDown}
              onScroll={(e) => {
                const mirror = e.currentTarget.previousElementSibling;
                if (mirror instanceof HTMLElement) {
                  mirror.scrollTop = e.currentTarget.scrollTop;
                }
              }}
              rows={1}
              placeholder={`${placeholder}  ·  @ plugins  ·  / skills`}
              disabled={pending}
              className="chat-input type-body relative z-[1] max-h-40 min-h-5 w-full resize-none overflow-y-auto bg-transparent px-1 leading-5 text-transparent caret-[var(--ink)] outline-none ring-0 [-webkit-text-fill-color:transparent] placeholder:text-[var(--muted)] placeholder:[-webkit-text-fill-color:var(--muted)] disabled:cursor-not-allowed"
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              onClick={openSlashPicker}
              disabled={pending}
              className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-40"
              aria-label="Insert skill"
              title="Skills"
            >
              <span className="block text-lg leading-none" aria-hidden>
                +
              </span>
            </button>
            {isWorking ? (
              <button
                type="button"
                onClick={() => void onPause()}
                disabled={pausing}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--ink)] text-[var(--canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={pausing ? "Stopping" : "Stop"}
                title="Stop"
              >
                <span className="block size-2.5 rounded-[2px] bg-current" aria-hidden />
              </button>
            ) : (
              <button
                type="submit"
                disabled={!draft.trim()}
                className="flex size-8 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[var(--ink)] text-[var(--canvas)] transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-30"
                aria-label="Send"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M3.4 20.6L20.9 12 3.4 3.4l-.1 6.7L14 12 3.3 13.9l.1 6.7z" />
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}

function ChatToolSteps({
  steps,
  live,
  hideCharts = false,
}: {
  steps: ChatToolStep[];
  live?: boolean;
  hideCharts?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const failed = steps.some((step) => step.status === "error");
  const charts = hideCharts
    ? []
    : steps
        .map((step) => step.artifact)
        .filter((artifact): artifact is BacktestArtifact => artifact != null);

  return (
    <div className="max-w-[min(100%,var(--measure-chat))]">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={
          open
            ? "Hide tools used"
            : failed
              ? "Show tools used (one failed)"
              : `Show ${steps.length} tool${steps.length === 1 ? "" : "s"} used`
        }
        className={`flex cursor-pointer items-center rounded-lg px-1 py-1 transition hover:bg-[var(--panel)] ${
          failed ? "text-[var(--danger)]" : "text-[var(--muted)]"
        }`}
      >
        <Caret open={open} />
      </button>
      {open ? (
        <ol className="mt-1 space-y-1 border-l border-[var(--line-soft)] py-1 pl-3 ml-1.5">
          {steps.map((step) => {
            const stepRunning = step.status === "running";
            const stepFailed = step.status === "error";
            return (
              <li key={step.id} className="min-w-0">
                <p
                  className={`type-meta leading-snug ${
                    stepFailed
                      ? "text-[var(--danger)]"
                      : stepRunning && live
                        ? "text-[var(--ink-soft)]"
                        : "text-[var(--muted)]"
                  }`}
                >
                  {step.label}
                  {step.toolName ? (
                    <span className="text-[var(--muted)]">
                      {" "}
                      · {step.toolName}
                    </span>
                  ) : null}
                </p>
                {stepFailed && step.detail ? (
                  <p className="type-meta mt-0.5 truncate text-[var(--muted)]">
                    {step.detail}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : null}
      {charts.map((artifact, index) => (
        <BacktestChartCard
          key={`${artifact.title}-${artifact.stats.days}-${index}`}
          artifact={artifact}
        />
      ))}
    </div>
  );
}

function AgentWorkingStatus({
  name,
  avatarId,
  colorId,
  className = "",
}: {
  name: string;
  avatarId: AvatarId;
  colorId: OrbColorId;
  className?: string;
}) {
  return (
    <p
      className={`type-ui flex items-center gap-2 text-[var(--ink-soft)] ${className}`}
      aria-live="polite"
    >
      <AgentOrb
        id={avatarId}
        colorId={colorId}
        size={22}
        className="shrink-0"
        animate
      />
      <span className="truncate">
        <span className="text-[var(--ink)]">{name}</span> is working
      </span>
    </p>
  );
}

function Caret({ open }: { open: boolean }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 12 12"
      fill="none"
      className={`shrink-0 text-[var(--muted)] transition-transform ${
        open ? "rotate-90" : ""
      }`}
      aria-hidden
    >
      <path
        d="M4.5 2.5L8 6L4.5 9.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MessageBubble({
  message,
  pluginServerNames = [],
}: {
  message: AgentMessage;
  pluginServerNames?: Iterable<string>;
}) {
  const isUser = message.role === "user";
  if (message.role === "system") {
    const outcomeMeta = parseTradeOutcomeMarker(message.content);
    if (outcomeMeta) {
      const text = stripTradeOutcomeMarker(message.content);
      const [titleLine, ...rest] = text.split("\n");
      return (
        <TradeOutcomeCard
          kind={outcomeMeta.kind}
          code={outcomeMeta.code}
          title={titleLine || "Trade update"}
          body={rest.join("\n").trim()}
        />
      );
    }
  }
  const content =
    message.role === "system"
      ? stripAllowanceApprovalMarker(message.content)
      : message.content;
  if (!content && message.role === "system") return null;
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`type-body max-w-[min(100%,var(--measure-chat))] rounded-2xl px-4 py-3 ${
          isUser
            ? "bg-[var(--msg-user)] text-[var(--ink)]"
            : "bg-[var(--msg-bot)] text-[var(--ink)]"
        }`}
      >
        {isUser ? (
          <p className="whitespace-pre-wrap">
            <SkillHighlightedText
              text={content}
              pluginServerNames={pluginServerNames}
            />
          </p>
        ) : (
          <MarkdownContent content={sanitizeAssistantContent(content)} />
        )}
      </div>
    </div>
  );
}

function TradeOutcomeCard({
  kind,
  code,
  title,
  body,
}: {
  kind: "submitted" | "dry_run" | "failed" | "dismissed";
  code: string;
  title: string;
  body: string;
}) {
  const tone =
    kind === "submitted"
      ? "border-[var(--accent)]/35 text-[var(--accent)]"
      : kind === "failed"
        ? "border-[var(--danger)]/40 text-[var(--danger)]"
        : "border-[var(--line-soft)] text-[var(--ink-soft)]";
  const label =
    kind === "submitted"
      ? "Submitted"
      : kind === "failed"
        ? code === "insufficient_gas"
          ? "Needs gas"
          : "Failed"
        : kind === "dry_run"
          ? "Paper"
          : "Dismissed";
  return (
    <div
      className={`max-w-[min(100%,var(--measure-chat))] space-y-1.5 rounded-2xl border bg-[var(--panel)] px-4 py-3 ${tone}`}
    >
      <p className="type-meta uppercase tracking-[0.08em]">{label}</p>
      <p className="type-ui text-[var(--ink)]">{title}</p>
      {body ? (
        <p className="type-meta text-[var(--ink-soft)]">{body}</p>
      ) : null}
    </div>
  );
}

function AllowanceApprovalCard({
  intent,
  chainName,
  busy,
  phase,
  onApprove,
  onDismiss,
}: {
  intent: TradeIntentRecord;
  chainName: string;
  busy: boolean;
  phase: "signer" | "broadcast" | null;
  onApprove: () => void;
  onDismiss: () => void;
}) {
  const side = intent.side ?? "trade";
  const symbol = intent.symbol ? ` ${intent.symbol}` : "";
  const busyLabel =
    phase === "signer"
      ? "Granting wallet access…"
      : phase === "broadcast"
        ? `Sending on ${chainName}…`
        : "Working…";
  return (
    <div className="max-w-[min(100%,var(--measure-chat))] space-y-3 rounded-2xl border border-[var(--line-soft)] bg-[var(--panel)] px-4 py-3">
      <div>
        <p className="type-ui text-[var(--ink)]">Approve token spend?</p>
        <p className="type-meta mt-1 text-[var(--ink-soft)]">
          Allow ERC-20 allowance for {side} ${intent.amountUsd}
          {symbol} on {chainName}. Needs a little ETH in this wallet for gas.
          Still capped — no spend beyond this trade’s quote.
        </p>
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={onApprove}
          className="type-ui flex-1 cursor-pointer rounded-full bg-[var(--ink)] px-3 py-1.5 font-semibold text-[var(--canvas)] disabled:opacity-40"
        >
          {busy ? busyLabel : "Approve"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onDismiss}
          className="type-ui flex-1 cursor-pointer rounded-full px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--panel-2)] hover:text-[var(--ink)] disabled:opacity-40"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
}
