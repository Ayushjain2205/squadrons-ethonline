"use client";

import { useEffect, useMemo, useState } from "react";
import { getMcpCatalogEntry, type AgentPluginView } from "@squadrons/shared";
import {
  createCustomPlugin,
  deleteAgentPlugin,
  listAgentPlugins,
  updateCustomPlugin,
  upsertCatalogPlugin,
} from "@/lib/host";
import { useToast } from "@/components/Toast";
import { PluginBrandIcon } from "./PluginBrandIcon";

type Sheet =
  | { kind: "install-catalog"; plugin: AgentPluginView }
  | { kind: "manage-catalog"; plugin: AgentPluginView }
  | { kind: "builtin-info"; plugin: AgentPluginView }
  | { kind: "manage-custom"; plugin: AgentPluginView }
  | { kind: "add-custom" }
  | null;

export function AgentPluginsPanel({
  agentId,
  onClose,
}: {
  agentId: string;
  onClose: () => void;
}) {
  const [plugins, setPlugins] = useState<AgentPluginView[] | null>(null);
  const [query, setQuery] = useState("");
  const [sheet, setSheet] = useState<Sheet>(null);
  const toast = useToast();

  useEffect(() => {
    let cancelled = false;
    void listAgentPlugins(agentId)
      .then((list) => {
        if (!cancelled) setPlugins(list);
      })
      .catch((err) => {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : "Failed to load plugins",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [agentId, toast]);

  const installed = useMemo(
    () => (plugins ?? []).filter((p) => p.enabled && p.configured),
    [plugins],
  );

  const q = query.trim().toLowerCase();
  const catalog = useMemo(() => {
    const rows = (plugins ?? []).filter((p) => p.kind === "catalog");
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q),
    );
  }, [plugins, q]);

  const custom = useMemo(() => {
    const rows = (plugins ?? []).filter((p) => p.kind === "custom");
    if (!q) return rows;
    return rows.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.serverName.toLowerCase().includes(q),
    );
  }, [plugins, q]);

  function replacePlugin(next: AgentPluginView) {
    setPlugins((prev) => {
      if (!prev) return [next];
      if (next.kind === "catalog" && next.catalogId) {
        return prev.map((p) =>
          p.catalogId === next.catalogId ? next : p,
        );
      }
      return prev.map((p) => (p.id === next.id ? next : p));
    });
  }

  function removePlugin(id: string) {
    setPlugins((prev) => (prev ? prev.filter((p) => p.id !== id) : prev));
  }

  if (sheet?.kind === "install-catalog") {
    return (
      <InstallCatalogSheet
        agentId={agentId}
        plugin={sheet.plugin}
        onBack={() => setSheet(null)}
        onInstalled={(next) => {
          replacePlugin(next);
          setSheet(null);
        }}
        onError={(message) => toast.error(message)}
      />
    );
  }

  if (sheet?.kind === "builtin-info") {
    return (
      <BuiltinInfoSheet
        plugin={sheet.plugin}
        onBack={() => setSheet(null)}
      />
    );
  }

  if (sheet?.kind === "manage-catalog") {
    return (
      <ManageCatalogSheet
        agentId={agentId}
        plugin={sheet.plugin}
        onBack={() => setSheet(null)}
        onUpdated={(next) => {
          replacePlugin(next);
          if (!next.enabled) setSheet(null);
        }}
        onError={(message) => toast.error(message)}
      />
    );
  }

  if (sheet?.kind === "manage-custom") {
    return (
      <ManageCustomSheet
        agentId={agentId}
        plugin={sheet.plugin}
        onBack={() => setSheet(null)}
        onUpdated={(next) => {
          replacePlugin(next);
          if (!next.enabled) setSheet(null);
        }}
        onDeleted={() => {
          removePlugin(sheet.plugin.id);
          setSheet(null);
        }}
        onError={(message) => toast.error(message)}
      />
    );
  }

  if (sheet?.kind === "add-custom") {
    return (
      <AddCustomSheet
        agentId={agentId}
        onBack={() => setSheet(null)}
        onCreated={(next) => {
          setPlugins((prev) => (prev ? [...prev, next] : [next]));
          setSheet(null);
        }}
        onError={(message) => toast.error(message)}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <label className="relative block">
        <span className="sr-only">Search plugins</span>
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-[var(--muted)]" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search plugins"
          className="type-ui w-full rounded-full border-0 bg-[var(--panel-2)] py-2.5 pr-3 pl-9 text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--line)]"
        />
      </label>

      {plugins === null ? (
        <p className="type-meta text-[var(--muted)]">Loading…</p>
      ) : (
        <>
          {installed.length > 0 ? (
            <section className="space-y-2">
              <h3 className="type-label flex items-center gap-1 text-[var(--ink-soft)]">
                Installed
                <ChevronRightIcon />
              </h3>
              <div className="flex flex-wrap gap-2">
                {installed.map((plugin) => (
                  <button
                    key={plugin.id}
                    type="button"
                    title={plugin.name}
                    aria-label={`Manage ${plugin.name}`}
                    onClick={() =>
                      setSheet(
                        plugin.builtin
                          ? { kind: "builtin-info", plugin }
                          : plugin.kind === "custom"
                            ? { kind: "manage-custom", plugin }
                            : { kind: "manage-catalog", plugin },
                      )
                    }
                    className="cursor-pointer rounded-2xl bg-[var(--panel-2)] p-1.5 transition hover:bg-[var(--panel)]"
                  >
                    <PluginBrandIcon
                      catalogId={plugin.catalogId}
                      name={plugin.name}
                      icon={plugin.kind === "custom" ? "custom" : undefined}
                      accent={
                        plugin.kind === "custom" ? "#3f3f46" : undefined
                      }
                      size={36}
                    />
                  </button>
                ))}
              </div>
            </section>
          ) : null}

          <section className="space-y-1">
            <h3 className="type-label mb-2 text-[var(--ink-soft)]">Available</h3>
            {catalog.map((plugin) => {
              const live = plugin.enabled && plugin.configured;
              const builtin = Boolean(plugin.builtin);
              return (
                <PluginRow
                  key={plugin.catalogId ?? plugin.id}
                  name={plugin.name}
                  description={plugin.description}
                  catalogId={plugin.catalogId}
                  onClick={() =>
                    setSheet(
                      builtin
                        ? { kind: "builtin-info", plugin }
                        : live
                          ? { kind: "manage-catalog", plugin }
                          : { kind: "install-catalog", plugin },
                    )
                  }
                  action={
                    builtin ? (
                      <span className="type-meta rounded-full bg-[var(--panel-2)] px-2 py-1 text-[var(--ink-soft)]">
                        {live ? "Included" : "Host key"}
                      </span>
                    ) : live ? (
                      <MoreButton
                        label={`Manage ${plugin.name}`}
                        onClick={() =>
                          setSheet({ kind: "manage-catalog", plugin })
                        }
                      />
                    ) : (
                      <PlusButton
                        label={`Add ${plugin.name}`}
                        onClick={() =>
                          setSheet({ kind: "install-catalog", plugin })
                        }
                      />
                    )
                  }
                />
              );
            })}

            {custom.map((plugin) => (
              <PluginRow
                key={plugin.id}
                name={plugin.name}
                description={`mcp__${plugin.serverName}__…`}
                icon="custom"
                accent="#3f3f46"
                onClick={() => setSheet({ kind: "manage-custom", plugin })}
                action={
                  <MoreButton
                    label={`Manage ${plugin.name}`}
                    onClick={() =>
                      setSheet({ kind: "manage-custom", plugin })
                    }
                  />
                }
              />
            ))}

            {!q ? (
              <PluginRow
                name="Custom MCP"
                description="Connect any HTTP MCP server"
                icon="custom"
                accent="#27272a"
                onClick={() => setSheet({ kind: "add-custom" })}
                action={
                  <PlusButton
                    label="Add custom MCP"
                    onClick={() => setSheet({ kind: "add-custom" })}
                  />
                }
              />
            ) : null}

            {catalog.length === 0 && custom.length === 0 ? (
              <p className="type-meta px-1 py-3 text-[var(--muted)]">
                No plugins match “{query}”.
              </p>
            ) : null}
          </section>
        </>
      )}

      <button
        type="button"
        onClick={onClose}
        className="type-ui mt-auto cursor-pointer self-start rounded-full px-3 py-1.5 text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
      >
        Done
      </button>
    </div>
  );
}

function PluginRow({
  name,
  description,
  catalogId,
  icon,
  accent,
  action,
  onClick,
}: {
  name: string;
  description: string;
  catalogId?: string | null;
  icon?: string;
  accent?: string;
  action: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <div className="group flex items-center gap-3 rounded-2xl px-1.5 py-2 transition hover:bg-[var(--panel-2)]">
      <button
        type="button"
        onClick={onClick}
        className="flex min-w-0 flex-1 cursor-pointer items-center gap-3 text-left"
      >
        <PluginBrandIcon
          catalogId={catalogId}
          icon={icon}
          accent={accent}
          name={name}
          size={40}
        />
        <span className="min-w-0">
          <span className="type-ui block truncate font-medium text-[var(--ink)]">
            {name}
          </span>
          <span className="type-meta block truncate text-[var(--muted)]">
            {description}
          </span>
        </span>
      </button>
      <div className="shrink-0">{action}</div>
    </div>
  );
}

function InstallCatalogSheet({
  agentId,
  plugin,
  onBack,
  onInstalled,
  onError,
}: {
  agentId: string;
  plugin: AgentPluginView;
  onBack: () => void;
  onInstalled: (plugin: AgentPluginView) => void;
  onError: (message: string) => void;
}) {
  const entry = getMcpCatalogEntry(plugin.catalogId ?? "");
  const needsSecret = plugin.secretSpecs.length > 0;
  const secretKey = plugin.secretSpecs[0]?.key ?? "API_KEY";
  const [keyDraft, setKeyDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function install(event: React.FormEvent) {
    event.preventDefault();
    if (!plugin.catalogId) return;
    if (needsSecret && !keyDraft.trim()) {
      onError("Paste an API key to connect");
      return;
    }
    setSaving(true);
    try {
      const updated = await upsertCatalogPlugin(agentId, plugin.catalogId, {
        enabled: true,
        secrets:
          needsSecret && keyDraft.trim()
            ? { [secretKey]: keyDraft.trim() }
            : undefined,
      });
      onInstalled(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Install failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SheetFrame
      title={plugin.name}
      subtitle={
        needsSecret
          ? "Add your key to connect this MCP server."
          : "Enable this first-party plugin for the agent."
      }
      catalogId={plugin.catalogId}
      onBack={onBack}
    >
      <form onSubmit={install} className="space-y-4">
        {needsSecret ? (
          <>
            <Field
              label={plugin.secretSpecs[0]?.label ?? "API key"}
              value={keyDraft}
              onChange={setKeyDraft}
              placeholder="Paste key"
              type="password"
              required
            />
            {entry?.docsUrl ? (
              <a
                href={entry.docsUrl}
                target="_blank"
                rel="noreferrer"
                className="type-meta text-[var(--link)] hover:underline"
              >
                Get an API key →
              </a>
            ) : null}
          </>
        ) : (
          <p className="type-meta text-[var(--ink-soft)]">
            {plugin.description}
          </p>
        )}
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] transition hover:opacity-90 disabled:opacity-60"
          >
            {saving
              ? needsSecret
                ? "Connecting…"
                : "Enabling…"
              : needsSecret
                ? "Connect"
                : "Enable"}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="type-ui cursor-pointer rounded-full px-4 py-2 text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </SheetFrame>
  );
}

function BuiltinInfoSheet({
  plugin,
  onBack,
}: {
  plugin: AgentPluginView;
  onBack: () => void;
}) {
  const entry = getMcpCatalogEntry(plugin.catalogId ?? "");
  const live = plugin.enabled && plugin.configured;
  const isPipeline = plugin.catalogId === "substreams";
  const subtitle = isPipeline
    ? "Included for every agent — Substreams studio deploy path."
    : live
      ? "Included for every agent — powered by The Graph."
      : "Waiting for host THE_GRAPH_GATEWAY_API_KEY.";
  const mention = isPipeline ? "@pipeline" : "@search";
  const help = isPipeline
    ? "or run /event-pipeline. Author a Substreams listener from natural language, then draft token_flow_alert with the returned pipelineId."
    : "Operators set one Gateway API key on the host (100k free queries/mo) — users never paste a key here.";
  const docsLabel = isPipeline
    ? "Substreams skills docs →"
    : "The Graph AI docs →";

  return (
    <SheetFrame
      title={plugin.name}
      subtitle={subtitle}
      catalogId={plugin.catalogId}
      onBack={onBack}
    >
      <div className="space-y-4">
        <p className="type-meta text-[var(--ink-soft)]">{plugin.description}</p>
        <p className="type-meta text-[var(--muted)]">
          Mention <span className="text-[var(--ink)]">{mention}</span> in chat
          {isPipeline ? " " : ". "}
          {help}
        </p>
        {entry?.docsUrl ? (
          <a
            href={entry.docsUrl}
            target="_blank"
            rel="noreferrer"
            className="type-meta text-[var(--link)] hover:underline"
          >
            {docsLabel}
          </a>
        ) : null}
        <button
          type="button"
          onClick={onBack}
          className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] transition hover:opacity-90"
        >
          Done
        </button>
      </div>
    </SheetFrame>
  );
}

function ManageCatalogSheet({
  agentId,
  plugin,
  onBack,
  onUpdated,
  onError,
}: {
  agentId: string;
  plugin: AgentPluginView;
  onBack: () => void;
  onUpdated: (plugin: AgentPluginView) => void;
  onError: (message: string) => void;
}) {
  const needsSecret = plugin.secretSpecs.length > 0;
  const secretKey = plugin.secretSpecs[0]?.key ?? "API_KEY";
  const [keyDraft, setKeyDraft] = useState("");
  const [saving, setSaving] = useState(false);

  async function saveKey() {
    if (!plugin.catalogId || !keyDraft.trim()) return;
    setSaving(true);
    try {
      const updated = await upsertCatalogPlugin(agentId, plugin.catalogId, {
        enabled: plugin.enabled,
        secrets: { [secretKey]: keyDraft.trim() },
      });
      setKeyDraft("");
      onUpdated(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function setEnabled(enabled: boolean) {
    if (!plugin.catalogId) return;
    setSaving(true);
    try {
      const updated = await upsertCatalogPlugin(agentId, plugin.catalogId, {
        enabled,
      });
      onUpdated(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSaving(false);
    }
  }

  async function disconnect() {
    if (!plugin.catalogId) return;
    setSaving(true);
    try {
      const updated = await upsertCatalogPlugin(agentId, plugin.catalogId, {
        enabled: false,
      });
      onUpdated(updated);
    } catch (err) {
      onError(err instanceof Error ? err.message : "Disconnect failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <SheetFrame
      title={plugin.name}
      subtitle={
        plugin.enabled
          ? needsSecret
            ? "Connected — tools load on the next chat turn."
            : "Enabled — tools load on the next chat turn."
          : "Saved but not enabled."
      }
      catalogId={plugin.catalogId}
      onBack={onBack}
    >
      <div className="space-y-4">
        {needsSecret ? (
          <Field
            label={`${plugin.secretSpecs[0]?.label ?? "API key"} · saved`}
            value={keyDraft}
            onChange={setKeyDraft}
            placeholder="•••••••• (new key to rotate)"
            type="password"
          />
        ) : (
          <p className="type-meta text-[var(--ink-soft)]">
            {plugin.description}
          </p>
        )}
        <div className="flex flex-wrap gap-2">
          {needsSecret && keyDraft.trim() ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void saveKey()}
              className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] disabled:opacity-60"
            >
              {saving ? "Saving…" : "Update key"}
            </button>
          ) : null}
          {!needsSecret ? (
            <button
              type="button"
              disabled={saving}
              onClick={() => void setEnabled(!plugin.enabled)}
              className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] disabled:opacity-60"
            >
              {plugin.enabled ? "Disable" : "Enable"}
            </button>
          ) : null}
          <button
            type="button"
            disabled={saving}
            onClick={() => void disconnect()}
            className="type-ui cursor-pointer rounded-full px-4 py-2 text-[var(--danger)] transition hover:bg-[var(--panel)] disabled:opacity-60"
          >
            Disconnect
          </button>
        </div>
      </div>
    </SheetFrame>
  );
}

function ManageCustomSheet({
  agentId,
  plugin,
  onBack,
  onUpdated,
  onDeleted,
  onError,
}: {
  agentId: string;
  plugin: AgentPluginView;
  onBack: () => void;
  onUpdated: (plugin: AgentPluginView) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const [saving, setSaving] = useState(false);
  const endpoint =
    plugin.custom?.transport === "stdio"
      ? plugin.custom.command
      : plugin.custom?.url;

  return (
    <SheetFrame
      title={plugin.name}
      subtitle={endpoint ?? `mcp__${plugin.serverName}__…`}
      icon="custom"
      accent="#3f3f46"
      onBack={onBack}
    >
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void updateCustomPlugin(agentId, plugin.id, {
              enabled: !plugin.enabled,
            })
              .then(onUpdated)
              .catch((err) =>
                onError(err instanceof Error ? err.message : "Update failed"),
              )
              .finally(() => setSaving(false));
          }}
          className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] disabled:opacity-60"
        >
          {plugin.enabled ? "Disable" : "Enable"}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => {
            setSaving(true);
            void deleteAgentPlugin(agentId, plugin.id)
              .then(onDeleted)
              .catch((err) =>
                onError(err instanceof Error ? err.message : "Remove failed"),
              )
              .finally(() => setSaving(false));
          }}
          className="type-ui cursor-pointer rounded-full px-4 py-2 text-[var(--danger)] transition hover:bg-[var(--panel)] disabled:opacity-60"
        >
          Remove
        </button>
      </div>
    </SheetFrame>
  );
}

function AddCustomSheet({
  agentId,
  onBack,
  onCreated,
  onError,
}: {
  agentId: string;
  onBack: () => void;
  onCreated: (plugin: AgentPluginView) => void;
  onError: (message: string) => void;
}) {
  const [name, setName] = useState("");
  const [serverName, setServerName] = useState("");
  const [url, setUrl] = useState("");
  const [headerName, setHeaderName] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [saving, setSaving] = useState(false);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const sn = serverName.trim();
    if (!sn || !url.trim()) {
      onError("Server name and URL required");
      return;
    }
    setSaving(true);
    const secrets: Record<string, string> = {};
    const headerSecretKeys: Record<string, string> = {};
    if (headerName.trim() && apiKey.trim()) {
      secrets.API_KEY = apiKey.trim();
      headerSecretKeys.API_KEY = headerName.trim();
    }
    void createCustomPlugin(agentId, {
      name: name.trim() || sn,
      serverName: sn,
      enabled: true,
      config: {
        transport: "streamable-http",
        url: url.trim(),
        headerSecretKeys:
          Object.keys(headerSecretKeys).length > 0
            ? headerSecretKeys
            : undefined,
      },
      secrets: Object.keys(secrets).length > 0 ? secrets : undefined,
    })
      .then(onCreated)
      .catch((err) =>
        onError(err instanceof Error ? err.message : "Create failed"),
      )
      .finally(() => setSaving(false));
  }

  return (
    <SheetFrame
      title="Custom MCP"
      subtitle="Point this agent at any streamable HTTP MCP endpoint."
      icon="custom"
      accent="#27272a"
      onBack={onBack}
    >
      <form onSubmit={onSubmit} className="space-y-3">
        <Field label="Display name" value={name} onChange={setName} placeholder="My MCP" />
        <Field
          label="Server name"
          value={serverName}
          onChange={setServerName}
          placeholder="my_mcp"
          hint="Tools appear as mcp__name__tool"
          required
        />
        <Field
          label="URL"
          value={url}
          onChange={setUrl}
          placeholder="https://…/mcp"
          required
        />
        <Field
          label="Auth header (optional)"
          value={headerName}
          onChange={setHeaderName}
          placeholder="x-api-key"
        />
        <Field
          label="API key (optional)"
          value={apiKey}
          onChange={setApiKey}
          placeholder="Secret value"
          type="password"
        />
        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={saving}
            className="type-ui cursor-pointer rounded-full bg-[var(--ink)] px-4 py-2 font-semibold text-[var(--canvas)] disabled:opacity-60"
          >
            {saving ? "Connecting…" : "Connect"}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="type-ui cursor-pointer rounded-full px-4 py-2 text-[var(--muted)] transition hover:bg-[var(--panel)]"
          >
            Cancel
          </button>
        </div>
      </form>
    </SheetFrame>
  );
}

function SheetFrame({
  title,
  subtitle,
  catalogId,
  icon,
  accent,
  onBack,
  children,
}: {
  title: string;
  subtitle: string;
  catalogId?: string | null;
  icon?: string;
  accent?: string;
  onBack: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-5">
      <button
        type="button"
        onClick={onBack}
        className="type-meta flex cursor-pointer items-center gap-1 text-[var(--muted)] transition hover:text-[var(--ink)]"
      >
        <ChevronLeftIcon />
        Plugins
      </button>
      <div className="flex items-center gap-3">
        <PluginBrandIcon
          catalogId={catalogId}
          icon={icon}
          accent={accent}
          name={title}
          size={48}
        />
        <div className="min-w-0">
          <h3 className="type-title text-[var(--ink)]">{title}</h3>
          <p className="type-meta text-[var(--muted)]">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  hint,
  required,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  hint?: string;
  required?: boolean;
  type?: string;
}) {
  return (
    <label className="block space-y-1.5">
      <span className="type-meta text-[var(--muted)]">{label}</span>
      <input
        type={type}
        required={required}
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="type-ui w-full rounded-xl border-0 bg-[var(--panel-2)] px-3 py-2.5 text-[var(--ink)] outline-none placeholder:text-[var(--muted)] focus:ring-1 focus:ring-[var(--line)]"
      />
      {hint ? <span className="type-meta text-[var(--muted)]">{hint}</span> : null}
    </label>
  );
}

function PlusButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
    >
      <PlusIcon />
    </button>
  );
}

function MoreButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className="flex size-8 cursor-pointer items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-[var(--panel)] hover:text-[var(--ink)]"
    >
      <MoreIcon />
    </button>
  );
}

function SearchIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function PlusIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 5v14M5 12h14"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoreIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <circle cx="6" cy="12" r="1.5" />
      <circle cx="12" cy="12" r="1.5" />
      <circle cx="18" cy="12" r="1.5" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m9 6 6 6-6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="m15 6-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
