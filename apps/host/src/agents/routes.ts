import { mkdir } from "node:fs/promises";
import type { Express, NextFunction, Request, Response } from "express";
import type { CreateAgentInput, UpdateAgentInput } from "@squadrons/shared";
import {
  isAvatarId,
  isImprovementCadence,
  isOrbColorId,
  isRunMode,
  isSupportedChainId,
  buildDraftFromTemplate,
  chainLabel,
  getStrategyTemplate,
  listStrategyTemplates,
  parseStrategyDraftInput,
  formatTradeOutcomeMessage,
  runModeLabel,
  strategyLifecycleDetail,
  templateMatchesChain,
} from "@squadrons/shared";
import {
  AuthError,
  requireUser,
  type UserStore,
} from "../auth/privy.js";
import {
  abortAgentRuntime,
  invalidateAgentRuntime,
  runDshTurn,
} from "../dsh/runner.js";
import { isSuccessfulProposeStrategyResult, isSuccessfulUpdateStrategyParamsResult, isSuccessfulProposeImprovementResult, isSuccessfulRunBacktestResult, isSuccessfulPublishChainSearchResult, isSuccessfulDeployEventPipelineResult } from "../dsh/activity-map.js";
import type { ActivityHub } from "./activity-hub.js";
import type { MessageStore } from "./messages.js";
import { agentWorkspacePath } from "./paths.js";
import type { AgentStore } from "./store.js";
import type { StrategyStore } from "./strategy-store.js";
import { clearEventEdgeState } from "../strategy/events.js";
import type { ImprovementProposalStore } from "../strategy/improvement-store.js";
import type { TradeIntentStore } from "../strategy/trade-intents.js";
import { executeGatedTrade, hostAllowsLive } from "../strategy/executor.js";
import { applyImprovementProposalFromWorkspace } from "../strategy/improvement.js";
import {
  readPendingParamsPatch,
  readPendingStrategyDraft,
  clearPendingParamsPatch,
  writeStrategyStateFile,
} from "../strategy/workspace-draft.js";
import { loadNativeBalances } from "../wallet/balances.js";
import type { AgentPluginStore } from "../plugins/store.js";
import { prepareAgentPlugins } from "../plugins/prepare.js";
import {
  clearPendingBacktest,
  readPendingBacktest,
} from "../plugins/backtest-sync.js";
import {
  clearPendingChainSearch,
  readPendingChainSearch,
} from "../plugins/chain-search-sync.js";
import {
  clearPendingSubstreamsPipeline,
  readPendingSubstreamsPipeline,
} from "../plugins/substreams-sync.js";
import {
  isMcpCatalogId,
  type CreateCustomPluginInput,
  type UpdateCustomPluginInput,
  type UpsertCatalogPluginInput,
} from "@squadrons/shared";

const GREETING =
  "Hey — I'm ready when you are. What should we dig into?";

export function registerAgentRoutes(
  app: Express,
  agents: AgentStore,
  messages: MessageStore,
  activity: ActivityHub,
  users: UserStore,
  strategies: StrategyStore,
  improvements: ImprovementProposalStore,
  tradeIntents: TradeIntentStore,
  plugins: AgentPluginStore,
): void {
  app.get("/v1/me", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      res.json({
        ok: true,
        userId: user.id,
        walletAddress: user.walletAddress,
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/wallet", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      if (!user.walletAddress) {
        res.json({
          ok: true,
          address: null,
          walletId: user.walletId,
          chains: [],
        });
        return;
      }
      const chains = await loadNativeBalances(user.walletAddress);
      res.json({
        ok: true,
        address: user.walletAddress,
        walletId: user.walletId,
        chains,
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const body = req.body as Partial<CreateAgentInput> & {
        chainId?: number | string;
        colorId?: string;
      };
      const hasChain =
        body.chainId !== undefined &&
        body.chainId !== null &&
        String(body.chainId).trim() !== "";
      const rawChain = hasChain ? Number(body.chainId) : undefined;
      if (hasChain && (rawChain === undefined || !isSupportedChainId(rawChain))) {
        res.status(400).json({ ok: false, error: "unsupported chainId" });
        return;
      }
      let colorId: CreateAgentInput["colorId"];
      if (body.colorId !== undefined) {
        const rawColor = String(body.colorId);
        if (!isOrbColorId(rawColor)) {
          res.status(400).json({ ok: false, error: "invalid colorId" });
          return;
        }
        colorId = rawColor;
      }
      const agent = agents.create(user.id, {
        name: String(body.name ?? ""),
        avatarId: body.avatarId as CreateAgentInput["avatarId"],
        colorId,
        description: String(body.description ?? ""),
        chainId: rawChain as CreateAgentInput["chainId"],
      });

      const workspace = agentWorkspacePath(user.id, agent.id);
      await mkdir(workspace, { recursive: true });

      const greeting = messages.append(agent.id, "assistant", GREETING);

      res.status(201).json({
        ok: true,
        agent: { ...agent, workspace },
        messages: [greeting],
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const list = agents.listByUser(user.id).map((agent) => ({
        ...agent,
        workspace: agentWorkspacePath(user.id, agent.id),
      }));
      res.json({ ok: true, agents: list });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents/:id", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      res.json({
        ok: true,
        agent: {
          ...agent,
          workspace: agentWorkspacePath(user.id, agent.id),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/v1/agents/:id", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const body = req.body as Partial<UpdateAgentInput> & {
        chainId?: number | string;
        avatarId?: string;
        colorId?: string;
        mode?: string;
        runMode?: string;
        /** @deprecated use runMode */
        spendMode?: string;
      };
      const patch: UpdateAgentInput = {};

      if (body.name !== undefined) patch.name = String(body.name);
      if (body.description !== undefined) {
        patch.description = String(body.description);
      }
      if (body.avatarId !== undefined) {
        const avatar = String(body.avatarId);
        if (!isAvatarId(avatar)) {
          res.status(400).json({ ok: false, error: "invalid avatarId" });
          return;
        }
        patch.avatarId = avatar;
      }
      if (body.colorId !== undefined) {
        const color = String(body.colorId);
        if (!isOrbColorId(color)) {
          res.status(400).json({ ok: false, error: "invalid colorId" });
          return;
        }
        patch.colorId = color;
      }
      if (body.runMode !== undefined || body.spendMode !== undefined) {
        const raw =
          body.runMode !== undefined
            ? String(body.runMode)
            : String(body.spendMode) === "spend_enabled"
              ? "paper"
              : String(body.spendMode);
        if (!isRunMode(raw)) {
          res.status(400).json({ ok: false, error: "invalid runMode" });
          return;
        }
        if (raw === "live" && !hostAllowsLive()) {
          res.status(400).json({
            ok: false,
            error:
              "Live mode is disabled on this host (SQUADRONS_EXECUTION_MODE must be live)",
          });
          return;
        }
        patch.runMode = raw;
      }
      if (
        body.chainId !== undefined &&
        body.chainId !== null &&
        String(body.chainId).trim() !== ""
      ) {
        const rawChain = Number(body.chainId);
        if (!isSupportedChainId(rawChain)) {
          res.status(400).json({ ok: false, error: "unsupported chainId" });
          return;
        }
        patch.chainId = rawChain;
      }

      if (
        patch.name === undefined &&
        patch.description === undefined &&
        patch.avatarId === undefined &&
        patch.colorId === undefined &&
        patch.chainId === undefined &&
        patch.runMode === undefined
      ) {
        res.status(400).json({ ok: false, error: "no settings to update" });
        return;
      }

      const chainChanged =
        patch.chainId !== undefined && patch.chainId !== existing.chainId;
      const runModeChanged =
        patch.runMode !== undefined && patch.runMode !== existing.runMode;

      const agent = agents.updateSettings(user.id, agentId, patch);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      if (chainChanged || runModeChanged) {
        await invalidateAgentRuntime(agent.id);
      }

      if (runModeChanged) {
        const label = runModeLabel(agent.runMode);
        activity.publish({
          agentId: agent.id,
          kind: "info",
          source: "system",
          label: `Run mode set to ${label}`,
          detail:
            agent.runMode === "live"
              ? `Ticks may broadcast capped trades on ${chainLabel(agent.chainId)}`
              : agent.runMode === "paper"
                ? "Ticks quote and record paper fills — no broadcast"
                : "Ticks are alert-only",
        });
        await writeStrategyStateFile(
          agentWorkspacePath(user.id, agent.id),
          agent,
        );
      }

      res.json({
        ok: true,
        agent: {
          ...agent,
          workspace: agentWorkspacePath(user.id, agent.id),
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents/:id/plugins", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }
      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }
      res.json({ ok: true, plugins: plugins.listForAgent(agent.id) });
    } catch (error) {
      next(error);
    }
  });

  app.put("/v1/agents/:id/plugins/catalog/:catalogId", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      const catalogId = req.params.catalogId;
      if (!agentId || !catalogId) {
        res.status(400).json({ ok: false, error: "missing agent or catalog id" });
        return;
      }
      if (!isMcpCatalogId(catalogId)) {
        res.status(400).json({ ok: false, error: "unknown catalog plugin" });
        return;
      }
      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const body = (req.body ?? {}) as UpsertCatalogPluginInput;
      if (typeof body.enabled !== "boolean") {
        res.status(400).json({ ok: false, error: "enabled (boolean) required" });
        return;
      }
      const secrets =
        body.secrets && typeof body.secrets === "object" && !Array.isArray(body.secrets)
          ? Object.fromEntries(
              Object.entries(body.secrets).filter(
                (entry): entry is [string, string] => typeof entry[1] === "string",
              ),
            )
          : undefined;

      const plugin = plugins.upsertCatalog(agent.id, catalogId, {
        enabled: body.enabled,
        secrets,
      });

      if (plugin.enabled && !plugin.configured) {
        plugins.upsertCatalog(agent.id, catalogId, { enabled: false });
        const fixed = plugins.listForAgent(agent.id).find(
          (p) => p.catalogId === catalogId,
        );
        res.status(400).json({
          ok: false,
          error: "Add the required API key before enabling this plugin",
          plugin: fixed ?? plugin,
        });
        return;
      }

      await invalidateAgentRuntime(agent.id);
      res.json({ ok: true, plugin });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents/:id/plugins/custom", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }
      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const body = (req.body ?? {}) as CreateCustomPluginInput;
      if (!body.serverName || !body.config) {
        res.status(400).json({
          ok: false,
          error: "serverName and config required",
        });
        return;
      }

      const plugin = plugins.createCustom(agent.id, {
        name: typeof body.name === "string" ? body.name : body.serverName,
        description:
          typeof body.description === "string" ? body.description : "",
        serverName: body.serverName,
        enabled: body.enabled,
        config: body.config,
        secrets:
          body.secrets && typeof body.secrets === "object"
            ? Object.fromEntries(
                Object.entries(body.secrets).filter(
                  (entry): entry is [string, string] =>
                    typeof entry[1] === "string",
                ),
              )
            : undefined,
      });

      await invalidateAgentRuntime(agent.id);
      res.status(201).json({ ok: true, plugin });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/serverName|url|command|args|reserved|already in use/i.test(message)) {
        res.status(400).json({ ok: false, error: message });
        return;
      }
      next(error);
    }
  });

  app.patch("/v1/agents/:id/plugins/:pluginId", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      const pluginId = req.params.pluginId;
      if (!agentId || !pluginId) {
        res.status(400).json({ ok: false, error: "missing agent or plugin id" });
        return;
      }
      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const body = (req.body ?? {}) as UpdateCustomPluginInput;
      const plugin = plugins.updateCustom(agent.id, pluginId, {
        name: typeof body.name === "string" ? body.name : undefined,
        description:
          typeof body.description === "string" ? body.description : undefined,
        enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
        config: body.config,
        secrets:
          body.secrets && typeof body.secrets === "object"
            ? Object.fromEntries(
                Object.entries(body.secrets).filter(
                  (entry): entry is [string, string] =>
                    typeof entry[1] === "string",
                ),
              )
            : undefined,
      });

      await invalidateAgentRuntime(agent.id);
      res.json({ ok: true, plugin });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not found/i.test(message)) {
        res.status(404).json({ ok: false, error: message });
        return;
      }
      if (/Not a custom|url|command|args|serverName/i.test(message)) {
        res.status(400).json({ ok: false, error: message });
        return;
      }
      next(error);
    }
  });

  app.delete("/v1/agents/:id/plugins/:pluginId", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      const pluginId = req.params.pluginId;
      if (!agentId || !pluginId) {
        res.status(400).json({ ok: false, error: "missing agent or plugin id" });
        return;
      }
      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      // Catalog rows use real UUIDs once saved; virtual catalog:id has no row
      if (pluginId.startsWith("catalog:")) {
        const catalogId = pluginId.slice("catalog:".length);
        if (isMcpCatalogId(catalogId)) {
          const existing = plugins
            .listForAgent(agent.id)
            .find((p) => p.catalogId === catalogId && !p.id.startsWith("catalog:"));
          if (existing) {
            plugins.delete(agent.id, existing.id);
            await invalidateAgentRuntime(agent.id);
          }
          res.json({ ok: true });
          return;
        }
      }

      plugins.delete(agent.id, pluginId);
      await invalidateAgentRuntime(agent.id);
      res.json({ ok: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (/not found/i.test(message)) {
        res.status(404).json({ ok: false, error: message });
        return;
      }
      next(error);
    }
  });

  app.get("/v1/agents/:id/messages", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      res.json({
        ok: true,
        messages: messages.listByAgent(agent.id),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents/:id/activity", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const limitRaw = Number(req.query.limit ?? 40);
      const limit = Number.isFinite(limitRaw) ? limitRaw : 40;
      const beforeCreatedAtRaw = Number(req.query.before);
      const beforeCreatedAt = Number.isFinite(beforeCreatedAtRaw)
        ? beforeCreatedAtRaw
        : undefined;
      const beforeId =
        typeof req.query.beforeId === "string" && req.query.beforeId
          ? req.query.beforeId
          : undefined;
      const sourcesRaw =
        typeof req.query.sources === "string" ? req.query.sources : "";
      const sources = sourcesRaw
        .split(",")
        .map((s) => s.trim())
        .filter(
          (s): s is "chat" | "strategy" | "system" =>
            s === "chat" || s === "strategy" || s === "system",
        );

      const page = activity.list(agent.id, {
        limit,
        beforeCreatedAt,
        beforeId,
        sources: sources.length > 0 ? sources : undefined,
      });
      res.json({
        ok: true,
        activity: page.events,
        hasMore: page.hasMore,
      });
    } catch (error) {
      next(error);
    }
  });

  /** Live activity stream (SSE). Client should load history via GET /activity first. */
  app.get("/v1/agents/:id/events", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      res.setHeader("Content-Type", "text/event-stream; charset=utf-8");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.flushHeaders?.();

      const write = (eventName: string, data: unknown) => {
        res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
      };

      write("ready", { agentId: agent.id });

      const unsubscribe = activity.subscribe(agent.id, (event) => {
        write("activity", event);
      });

      const heartbeat = setInterval(() => {
        res.write(`: ping\n\n`);
      }, 25_000);

      const close = () => {
        clearInterval(heartbeat);
        unsubscribe();
      };

      req.on("close", close);
    } catch (error) {
      next(error);
    }
  });

  /** Curated strategy templates (chain-filtered). */
  app.get("/v1/strategy/templates", async (req, res, next) => {
    try {
      await requireUser(req, users);
      const rawChain = req.query.chainId;
      let chainId: number | undefined;
      if (rawChain !== undefined && String(rawChain).trim() !== "") {
        const parsed = Number(rawChain);
        if (!isSupportedChainId(parsed)) {
          res.status(400).json({ ok: false, error: "unsupported chainId" });
          return;
        }
        chainId = parsed;
      }
      res.json({
        ok: true,
        templates: listStrategyTemplates(chainId),
      });
    } catch (error) {
      next(error);
    }
  });

  /** Import a curated template as a strategy draft (does not Arm). */
  app.post("/v1/agents/:id/strategy/from-template", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const body = req.body as {
        templateId?: unknown;
        params?: unknown;
      };
      const templateId =
        typeof body.templateId === "string" ? body.templateId.trim() : "";
      if (!templateId) {
        res.status(400).json({ ok: false, error: "templateId is required" });
        return;
      }

      const template = getStrategyTemplate(templateId);
      if (!template) {
        res.status(404).json({ ok: false, error: "template not found" });
        return;
      }
      if (!templateMatchesChain(template, existing.chainId)) {
        res.status(400).json({
          ok: false,
          error: "template is not available on this agent's home chain",
        });
        return;
      }

      if (existing.strategy?.status === "running") {
        res.status(400).json({
          ok: false,
          error: "pause or disarm the strategy before importing a template",
        });
        return;
      }

      const paramOverrides =
        body.params !== undefined &&
        typeof body.params === "object" &&
        body.params !== null &&
        !Array.isArray(body.params)
          ? (body.params as Record<string, unknown>)
          : undefined;

      // Only allow overrides for declared editable keys.
      let safeOverrides: Record<string, unknown> | undefined;
      if (paramOverrides) {
        safeOverrides = {};
        for (const key of template.editableKeys) {
          if (paramOverrides[key] !== undefined) {
            safeOverrides[key] = paramOverrides[key];
          }
        }
      }

      const draft = buildDraftFromTemplate(templateId, safeOverrides);
      if (!draft) {
        res.status(400).json({ ok: false, error: "invalid template params" });
        return;
      }

      strategies.upsertDraft(existing.id, draft);
      activity.publish({
        agentId: existing.id,
        kind: "info",
        source: "system",
        label: "Imported template",
        detail: template.name,
      });

      const agent = agents.getForUser(user.id, existing.id);
      const workspace = agentWorkspacePath(user.id, existing.id);
      if (agent) await writeStrategyStateFile(workspace, agent);
      res.json({
        ok: true,
        agent: agent
          ? { ...agent, workspace }
          : {
              ...existing,
              strategy: strategies.get(existing.id),
              workspace,
            },
        template: { id: template.id, name: template.name },
      });
    } catch (error) {
      next(error);
    }
  });

  /** Upsert a strategy draft. */
  app.put("/v1/agents/:id/strategy/draft", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const draft = parseStrategyDraftInput(req.body);
      if (!draft) {
        res.status(400).json({ ok: false, error: "invalid strategy draft" });
        return;
      }

      strategies.upsertDraft(existing.id, draft);
      activity.publish({
        agentId: existing.id,
        kind: "info",
          source: "system",
        label: "Saved strategy draft",
        detail: strategyLifecycleDetail({
          recipeId: draft.recipeId,
          params: draft.params ?? {},
          action: draft.action,
        }),
      });

      const agent = agents.getForUser(user.id, existing.id);
      const workspace = agentWorkspacePath(user.id, existing.id);
      if (agent) await writeStrategyStateFile(workspace, agent);
      res.json({
        ok: true,
        agent: agent
          ? { ...agent, workspace }
          : {
              ...existing,
              strategy: strategies.get(existing.id),
              workspace,
            },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents/:id/strategy/arm", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const strategy = strategies.arm(existing.id);
      activity.publish({
        agentId: existing.id,
        kind: "info",
          source: "system",
        label: "Armed strategy",
        detail: strategyLifecycleDetail(strategy),
      });

      const agent = agents.getForUser(user.id, existing.id);
      const workspace = agentWorkspacePath(user.id, existing.id);
      if (agent) await writeStrategyStateFile(workspace, agent);
      res.json({
        ok: true,
        agent: {
          ...(agent ?? existing),
          strategy: agent?.strategy ?? strategy,
          workspace,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents/:id/strategy/pause", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const strategy = strategies.pause(existing.id);
      activity.publish({
        agentId: existing.id,
        kind: "info",
          source: "system",
        label: "Paused strategy",
        detail: strategyLifecycleDetail(strategy),
      });

      const agent = agents.getForUser(user.id, existing.id);
      const workspace = agentWorkspacePath(user.id, existing.id);
      if (agent) await writeStrategyStateFile(workspace, agent);
      res.json({
        ok: true,
        agent: {
          ...(agent ?? existing),
          strategy: agent?.strategy ?? strategy,
          workspace,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents/:id/strategy/resume", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const strategy = strategies.resume(existing.id);
      activity.publish({
        agentId: existing.id,
        kind: "info",
          source: "system",
        label: "Resumed strategy",
        detail: strategyLifecycleDetail(strategy),
      });

      const agent = agents.getForUser(user.id, existing.id);
      const workspace = agentWorkspacePath(user.id, existing.id);
      if (agent) await writeStrategyStateFile(workspace, agent);
      res.json({
        ok: true,
        agent: {
          ...(agent ?? existing),
          strategy: agent?.strategy ?? strategy,
          workspace,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  app.post("/v1/agents/:id/strategy/disarm", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const strategy = strategies.disarm(existing.id);
      clearEventEdgeState(existing.id);
      activity.publish({
        agentId: existing.id,
        kind: "info",
          source: "system",
        label: "Disarmed strategy",
        detail: strategyLifecycleDetail(strategy),
      });

      const agent = agents.getForUser(user.id, existing.id);
      const workspace = agentWorkspacePath(user.id, existing.id);
      if (agent) await writeStrategyStateFile(workspace, agent);
      res.json({
        ok: true,
        agent: {
          ...(agent ?? existing),
          strategy: agent?.strategy ?? strategy,
          workspace,
        },
      });
    } catch (error) {
      next(error);
    }
  });

  /** Remove strategy entirely (draft/paused only). */
  app.delete("/v1/agents/:id/strategy", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }
      if (!existing.strategy) {
        res.status(400).json({ ok: false, error: "no strategy to remove" });
        return;
      }
      if (existing.strategy.status === "running") {
        res.status(400).json({
          ok: false,
          error: "pause or disarm before removing the strategy",
        });
        return;
      }

      const planDetail = strategyLifecycleDetail(existing.strategy);
      strategies.delete(existing.id);
      clearEventEdgeState(existing.id);
      const pending = improvements.getPending(existing.id);
      if (pending) {
        improvements.resolve(existing.id, pending.id, "dismissed");
      }
      activity.publish({
        agentId: existing.id,
        kind: "info",
        source: "system",
        label: "Removed strategy",
        detail: planDetail,
      });

      const agent = agents.getForUser(user.id, existing.id);
      const workspace = agentWorkspacePath(user.id, existing.id);
      if (agent) await writeStrategyStateFile(workspace, agent);
      res.json({
        ok: true,
        agent: agent
          ? { ...agent, workspace }
          : { ...existing, strategy: null, workspace },
      });
    } catch (error) {
      next(error);
    }
  });

  app.patch("/v1/agents/:id/strategy/improvement", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }
      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }
      if (!existing.strategy) {
        res.status(400).json({ ok: false, error: "no strategy to update" });
        return;
      }

      const body = req.body as {
        enabled?: unknown;
        cadence?: unknown;
        allowedKeys?: unknown;
      };
      const patch: {
        enabled?: boolean;
        cadence?: "hourly" | "daily" | "weekly";
        allowedKeys?: string[];
      } = {};
      if (body.enabled !== undefined) {
        if (typeof body.enabled !== "boolean") {
          res.status(400).json({ ok: false, error: "enabled must be boolean" });
          return;
        }
        patch.enabled = body.enabled;
      }
      if (body.cadence !== undefined) {
        if (!isImprovementCadence(body.cadence)) {
          res.status(400).json({ ok: false, error: "invalid cadence" });
          return;
        }
        patch.cadence = body.cadence;
      }
      if (body.allowedKeys !== undefined) {
        if (
          !Array.isArray(body.allowedKeys) ||
          !body.allowedKeys.every((k) => typeof k === "string")
        ) {
          res.status(400).json({ ok: false, error: "invalid allowedKeys" });
          return;
        }
        patch.allowedKeys = body.allowedKeys;
      }

      const strategy = strategies.patchImprovement(existing.id, patch);
      activity.publish({
        agentId: existing.id,
        kind: "info",
        source: "system",
        label: "Updated self-improvement",
        detail: strategy.improvement.enabled
          ? strategy.improvement.cadence
          : "off",
      });

      const agent = agents.getForUser(user.id, existing.id);
      const workspace = agentWorkspacePath(user.id, existing.id);
      if (agent) await writeStrategyStateFile(workspace, agent);
      res.json({
        ok: true,
        agent: agent
          ? { ...agent, workspace }
          : { ...existing, strategy, workspace },
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents/:id/strategy/improvements", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }
      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }
      res.json({
        ok: true,
        pending: improvements.getPending(existing.id),
        proposals: improvements.list(existing.id, 20),
      });
    } catch (error) {
      next(error);
    }
  });

  app.get("/v1/agents/:id/strategy/trade-intents", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }
      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }
      const limitRaw = Number(req.query.limit);
      const limit = Number.isFinite(limitRaw) ? limitRaw : 20;
      res.json({
        ok: true,
        intents: tradeIntents.listByAgent(existing.id, limit),
        awaitingAllowance: tradeIntents.listAwaitingAllowance(existing.id),
        summary: tradeIntents.summarizeByAgent(existing.id),
      });
    } catch (error) {
      next(error);
    }
  });

  app.post(
    "/v1/agents/:id/strategy/trade-intents/:intentId/approve-allowance",
    async (req, res, next) => {
      try {
        const user = await requireUser(req, users);
        const agentId = req.params.id;
        const intentId = req.params.intentId;
        if (!agentId || !intentId) {
          res.status(400).json({ ok: false, error: "missing id" });
          return;
        }
        const existing = agents.getForUser(user.id, agentId);
        if (!existing) {
          res.status(404).json({ ok: false, error: "agent not found" });
          return;
        }
        const record = tradeIntents.get(intentId);
        if (
          !record ||
          record.agentId !== existing.id ||
          record.status !== "awaiting_allowance"
        ) {
          res.status(404).json({ ok: false, error: "allowance request not found" });
          return;
        }

        const strategy = strategies.get(existing.id);
        if (!strategy || strategy.action.type !== "propose_trade") {
          res.status(400).json({ ok: false, error: "strategy cannot trade" });
          return;
        }

        let storedIntent: {
          amountUsd: number;
          symbol?: string;
          side?: "buy" | "sell";
          note?: string;
        } | null = null;
        if (record.executionJson) {
          try {
            const parsed = JSON.parse(record.executionJson) as {
              intent?: {
                amountUsd?: number;
                symbol?: string;
                side?: "buy" | "sell";
                note?: string;
              };
            };
            if (
              parsed.intent &&
              typeof parsed.intent.amountUsd === "number" &&
              parsed.intent.amountUsd > 0
            ) {
              storedIntent = {
                amountUsd: parsed.intent.amountUsd,
                ...(parsed.intent.symbol
                  ? { symbol: parsed.intent.symbol }
                  : {}),
                ...(parsed.intent.side === "buy" ||
                parsed.intent.side === "sell"
                  ? { side: parsed.intent.side }
                  : {}),
                ...(parsed.intent.note ? { note: parsed.intent.note } : {}),
              };
            }
          } catch {
            storedIntent = null;
          }
        }
        const intent = storedIntent ?? {
          amountUsd: record.amountUsd,
          ...(record.symbol ? { symbol: record.symbol } : {}),
          ...(record.side ? { side: record.side } : {}),
        };

        const executed = await executeGatedTrade({
          agent: existing,
          strategy,
          intent,
          walletAddress: user.walletAddress,
          walletId: user.walletId,
          allowanceDecision: "approved",
        });

        tradeIntents.updateExecution(record.id, {
          status:
            executed.status === "awaiting_allowance"
              ? "failed"
              : executed.status,
          detail: executed.detail,
          reason:
            executed.status === "failed"
              ? executed.reason
              : executed.status === "awaiting_allowance"
                ? "Still needs allowance after approval"
                : null,
          txHash:
            executed.status === "submitted" ? executed.txHash : null,
          execution: {
            plan: executed.plan,
            intent,
            ...(executed.swap ? { swap: executed.swap } : {}),
            ...("approveTxHash" in executed && executed.approveTxHash
              ? { approveTxHash: executed.approveTxHash }
              : {}),
          },
        });

        const outcomeMsg =
          executed.status === "submitted"
            ? formatTradeOutcomeMessage({
                kind: "submitted",
                txHash: executed.txHash,
                detail: executed.detail,
                chainName: chainLabel(executed.plan.chainId),
                ...("approveTxHash" in executed &&
                typeof executed.approveTxHash === "string"
                  ? { approveTxHash: executed.approveTxHash }
                  : {}),
              })
            : executed.status === "dry_run"
              ? formatTradeOutcomeMessage({
                  kind: "dry_run",
                  detail: executed.detail,
                })
              : formatTradeOutcomeMessage({
                  kind: "failed",
                  reason:
                    executed.status === "failed"
                      ? executed.reason
                      : "Still needs allowance after approval",
                  detail: executed.detail,
                  ...("approveTxHash" in executed &&
                  typeof executed.approveTxHash === "string"
                    ? { approveTxHash: executed.approveTxHash }
                    : {}),
                });
        messages.append(existing.id, "system", outcomeMsg.content);

        const activityLabel =
          executed.status === "submitted"
            ? "Trade submitted"
            : executed.status === "dry_run"
              ? "Paper fill (no broadcast)"
              : executed.status === "failed"
                ? outcomeMsg.outcome.title
                : "Allowance resolved";
        activity.publish({
          agentId: existing.id,
          kind: executed.status === "failed" ? "error" : "info",
          source: "strategy",
          label: activityLabel,
          detail: outcomeMsg.outcome.body,
        });

        res.json({
          ok: true,
          intent: tradeIntents.get(record.id),
          execution: executed,
          outcome: outcomeMsg.outcome,
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/v1/agents/:id/strategy/trade-intents/:intentId/dismiss-allowance",
    async (req, res, next) => {
      try {
        const user = await requireUser(req, users);
        const agentId = req.params.id;
        const intentId = req.params.intentId;
        if (!agentId || !intentId) {
          res.status(400).json({ ok: false, error: "missing id" });
          return;
        }
        const existing = agents.getForUser(user.id, agentId);
        if (!existing) {
          res.status(404).json({ ok: false, error: "agent not found" });
          return;
        }
        const record = tradeIntents.get(intentId);
        if (
          !record ||
          record.agentId !== existing.id ||
          record.status !== "awaiting_allowance"
        ) {
          res.status(404).json({ ok: false, error: "allowance request not found" });
          return;
        }

        tradeIntents.updateExecution(record.id, {
          status: "dismissed",
          detail: "Dismissed in chat — no allowance broadcast",
          reason: "dismissed_by_user",
        });
        const dismissed = formatTradeOutcomeMessage({ kind: "dismissed" });
        messages.append(existing.id, "system", dismissed.content);
        activity.publish({
          agentId: existing.id,
          kind: "info",
          source: "strategy",
          label: "Allowance dismissed",
          detail: record.label,
        });

        res.json({ ok: true, intent: tradeIntents.get(record.id) });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/v1/agents/:id/strategy/improvements/:proposalId/approve",
    async (req, res, next) => {
      try {
        const user = await requireUser(req, users);
        const agentId = req.params.id;
        const proposalId = req.params.proposalId;
        if (!agentId || !proposalId) {
          res.status(400).json({ ok: false, error: "missing id" });
          return;
        }
        const existing = agents.getForUser(user.id, agentId);
        if (!existing) {
          res.status(404).json({ ok: false, error: "agent not found" });
          return;
        }

        const proposal = improvements.get(existing.id, proposalId);
        if (!proposal || proposal.status !== "pending") {
          res.status(404).json({ ok: false, error: "proposal not found" });
          return;
        }

        strategies.patchParams(existing.id, proposal.patch);
        const resolved = improvements.resolve(
          existing.id,
          proposalId,
          "approved",
        );
        activity.publish({
          agentId: existing.id,
          kind: "info",
          source: "system",
          label: "Self-improvement approved",
          detail: proposal.reason ?? Object.keys(proposal.patch).join(", "),
        });

        const agent = agents.getForUser(user.id, existing.id);
        const workspace = agentWorkspacePath(user.id, existing.id);
        if (agent) await writeStrategyStateFile(workspace, agent);
        res.json({
          ok: true,
          proposal: resolved,
          agent: agent
            ? { ...agent, workspace }
            : {
                ...existing,
                strategy: strategies.get(existing.id),
                workspace,
              },
        });
      } catch (error) {
        next(error);
      }
    },
  );

  app.post(
    "/v1/agents/:id/strategy/improvements/:proposalId/dismiss",
    async (req, res, next) => {
      try {
        const user = await requireUser(req, users);
        const agentId = req.params.id;
        const proposalId = req.params.proposalId;
        if (!agentId || !proposalId) {
          res.status(400).json({ ok: false, error: "missing id" });
          return;
        }
        const existing = agents.getForUser(user.id, agentId);
        if (!existing) {
          res.status(404).json({ ok: false, error: "agent not found" });
          return;
        }

        const proposal = improvements.get(existing.id, proposalId);
        if (!proposal || proposal.status !== "pending") {
          res.status(404).json({ ok: false, error: "proposal not found" });
          return;
        }

        const resolved = improvements.resolve(
          existing.id,
          proposalId,
          "dismissed",
        );
        activity.publish({
          agentId: existing.id,
          kind: "info",
          source: "system",
          label: "Self-improvement dismissed",
          detail: proposal.reason ?? Object.keys(proposal.patch).join(", "),
        });

        res.json({ ok: true, proposal: resolved });
      } catch (error) {
        next(error);
      }
    },
  );

  /** Halt a working agent by killing its dsh runtime; status → paused. */
  app.post("/v1/agents/:id/pause", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      const existing = agents.getForUser(user.id, agentId);
      if (!existing) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      await abortAgentRuntime(existing.id);
      const agent = agents.setStatus(user.id, existing.id, "paused");
      activity.publish({
        agentId: existing.id,
        kind: "info",
          source: "system",
        label: "Stopped",
      });

      res.json({
        ok: true,
        agent: agent
          ? {
              ...agent,
              workspace: agentWorkspacePath(user.id, agent.id),
            }
          : {
              ...existing,
              status: "paused" as const,
              workspace: agentWorkspacePath(user.id, existing.id),
            },
      });
    } catch (error) {
      next(error);
    }
  });

  /** Chat turn: append user message, run dsh, append reply. */
  app.post("/v1/agents/:id/messages", async (req, res, next) => {
    try {
      const user = await requireUser(req, users);
      const agentId = req.params.id;
      if (!agentId) {
        res.status(400).json({ ok: false, error: "missing agent id" });
        return;
      }

      let agent = agents.getForUser(user.id, agentId);
      if (!agent) {
        res.status(404).json({ ok: false, error: "agent not found" });
        return;
      }

      const content =
        typeof req.body?.content === "string" ? req.body.content.trim() : "";
      if (!content) {
        res.status(400).json({ ok: false, error: "content is required" });
        return;
      }

      const userMessage = messages.append(agent.id, "user", content);
      const priorMessages = messages.listByAgent(agent.id).filter(
        (m) => m.id !== userMessage.id,
      );

      agents.setStatus(user.id, agent.id, "working");
      agent = agents.getForUser(user.id, agent.id) ?? agent;

      const workspace = agentWorkspacePath(user.id, agent.id);
      await writeStrategyStateFile(workspace, agent);

      let draftSyncedThisTurn = false;
      let paramsPatchedThisTurn = false;
      let draftSyncGate: Promise<void> = Promise.resolve();
      const syncPendingDraft = (announce: boolean) => {
        const run = draftSyncGate.then(async () => {
          if (draftSyncedThisTurn) return false;
          const draft = await readPendingStrategyDraft(workspace);
          if (!draft) return false;
          const existingStrategy = strategies.get(agent.id);
          if (existingStrategy?.status === "running") return false;
          strategies.upsertDraft(agent.id, draft);
          draftSyncedThisTurn = true;
          if (announce) {
            activity.publish({
              agentId: agent.id,
              kind: "info",
              source: "system",
              label: "Saved strategy draft",
              detail: strategyLifecycleDetail({
                recipeId: draft.recipeId,
                params: draft.params ?? {},
                action: draft.action,
              }),
            });
          }
          const latest = agents.getForUser(user.id, agent.id);
          if (latest) await writeStrategyStateFile(workspace, latest);
          return true;
        });
        draftSyncGate = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      };

      const syncPendingParamsPatch = (announce: boolean) => {
        const run = draftSyncGate.then(async () => {
          if (paramsPatchedThisTurn) return false;
          const patch = await readPendingParamsPatch(workspace);
          if (!patch) return false;
          const updated = strategies.patchParams(agent.id, patch);
          await clearPendingParamsPatch(workspace);
          paramsPatchedThisTurn = true;
          if (announce) {
            activity.publish({
              agentId: agent.id,
              kind: "info",
              source: "system",
              label: "Updated strategy params",
              detail: strategyLifecycleDetail(updated),
            });
          }
          const latest = agents.getForUser(user.id, agent.id);
          if (latest) await writeStrategyStateFile(workspace, latest);
          return true;
        });
        draftSyncGate = run.then(
          () => undefined,
          () => undefined,
        );
        return run;
      };

      let turn;
      try {
        const mcp = await prepareAgentPlugins(plugins, agent.id, workspace);
        turn = await runDshTurn({
          agentId: agent.id,
          agent,
          userText: content,
          workspace,
          walletAddress: user.walletAddress,
          history: priorMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          patches: mcp.patches,
          pluginEnv: mcp.pluginEnv,
          pluginsHash: mcp.pluginsHash,
          enabledPluginNames: mcp.enabledNames,
          onActivity: (event) => {
            activity.publish({ ...event, source: "chat" });
          },
          onNotification: (notification) => {
            if (isSuccessfulProposeStrategyResult(notification)) {
              void syncPendingDraft(true).catch((error) => {
                console.error("[strategy-draft-mid-turn]", agent.id, error);
              });
            }
            if (isSuccessfulUpdateStrategyParamsResult(notification)) {
              void syncPendingParamsPatch(true).catch((error) => {
                console.error("[strategy-params-mid-turn]", agent.id, error);
              });
            }
            if (isSuccessfulProposeImprovementResult(notification)) {
              void applyImprovementProposalFromWorkspace({
                agent,
                workspace,
                strategies,
                improvements,
                activity,
              }).catch((error) => {
                console.error("[strategy-improve-mid-turn]", agent.id, error);
              });
            }
            if (isSuccessfulRunBacktestResult(agent.id, notification)) {
              void (async () => {
                const artifact = await readPendingBacktest(workspace);
                if (!artifact) return;
                activity.publish({
                  agentId: agent.id,
                  kind: "tool_result",
                  source: "chat",
                  label: "Ran backtest",
                  detail: JSON.stringify(artifact),
                  toolName: "run_backtest",
                });
                await clearPendingBacktest(workspace);
              })().catch((error) => {
                console.error("[backtest-mid-turn]", agent.id, error);
              });
            }
            if (isSuccessfulPublishChainSearchResult(agent.id, notification)) {
              void (async () => {
                const artifact = await readPendingChainSearch(workspace);
                if (!artifact) return;
                activity.publish({
                  agentId: agent.id,
                  kind: "tool_result",
                  source: "chat",
                  label: "Published search results",
                  detail: JSON.stringify(artifact),
                  toolName: "publish_chain_search",
                });
                await clearPendingChainSearch(workspace);
              })().catch((error) => {
                console.error("[chain-search-mid-turn]", agent.id, error);
              });
            }
            if (isSuccessfulDeployEventPipelineResult(agent.id, notification)) {
              void (async () => {
                const artifact = await readPendingSubstreamsPipeline(workspace);
                if (!artifact) return;
                activity.publish({
                  agentId: agent.id,
                  kind: "tool_result",
                  source: "chat",
                  label: "Deployed event pipeline",
                  detail: JSON.stringify(artifact),
                  toolName: "deploy_event_pipeline",
                });
                await clearPendingSubstreamsPipeline(workspace);
              })().catch((error) => {
                console.error("[substreams-mid-turn]", agent.id, error);
              });
            }
          },
        });
      } catch (error) {
        const current = agents.getForUser(user.id, agent.id);
        if (current?.status !== "paused") {
          agents.setStatus(user.id, agent.id, "paused");
          activity.publish({
            agentId: agent.id,
            kind: "error",
            source: "chat",
            label: "Something went wrong",
            detail: error instanceof Error ? error.message : String(error),
          });
        }
        throw error;
      }

      const replyText = (turn.finalResponse || "(no response)").trimEnd();

      try {
        await syncPendingDraft(true);
      } catch (error) {
        console.error("[strategy-draft]", agent.id, error);
      }
      try {
        await syncPendingParamsPatch(true);
      } catch (error) {
        console.error("[strategy-params]", agent.id, error);
      }
      try {
        await applyImprovementProposalFromWorkspace({
          agent,
          workspace,
          strategies,
          improvements,
          activity,
        });
      } catch (error) {
        console.error("[strategy-improve]", agent.id, error);
      }
      try {
        const artifact = await readPendingBacktest(workspace);
        if (artifact) {
          activity.publish({
            agentId: agent.id,
            kind: "tool_result",
            source: "chat",
            label: "Ran backtest",
            detail: JSON.stringify(artifact),
            toolName: "run_backtest",
          });
          await clearPendingBacktest(workspace);
        }
      } catch (error) {
        console.error("[backtest-sync]", agent.id, error);
      }
      try {
        const artifact = await readPendingChainSearch(workspace);
        if (artifact) {
          activity.publish({
            agentId: agent.id,
            kind: "tool_result",
            source: "chat",
            label: "Published search results",
            detail: JSON.stringify(artifact),
            toolName: "publish_chain_search",
          });
          await clearPendingChainSearch(workspace);
        }
      } catch (error) {
        console.error("[chain-search-sync]", agent.id, error);
      }
      try {
        const artifact = await readPendingSubstreamsPipeline(workspace);
        if (artifact) {
          activity.publish({
            agentId: agent.id,
            kind: "tool_result",
            source: "chat",
            label: "Deployed event pipeline",
            detail: JSON.stringify(artifact),
            toolName: "deploy_event_pipeline",
          });
          await clearPendingSubstreamsPipeline(workspace);
        }
      } catch (error) {
        console.error("[substreams-sync]", agent.id, error);
      }

      const assistantMessage = messages.append(
        agent.id,
        "assistant",
        replyText || "(empty response)",
      );

      const updated = agents.updateAfterRun(user.id, agent.id, {
        status: "idle",
        lastDshSessionId: turn.sessionId,
      });

      if (updated) {
        await writeStrategyStateFile(workspace, updated);
      }

      res.json({
        ok: true,
        agent: updated
          ? { ...updated, workspace }
          : { ...agent, workspace },
        messages: [userMessage, assistantMessage],
        turn: {
          ...turn,
          finalResponse: replyText,
        },
      });
    } catch (error) {
      next(error);
    }
  });
}

export function agentErrorHandler(
  error: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (error instanceof AuthError) {
    res.status(401).json({ ok: false, error: error.message });
    return;
  }
  const message = error instanceof Error ? error.message : String(error);
  const status =
    /required|invalid|unsupported|cannot|no settings/i.test(message)
      ? 400
      : 500;
  if (status >= 500) console.error("[agents]", error);
  res.status(status).json({ ok: false, error: message });
}
