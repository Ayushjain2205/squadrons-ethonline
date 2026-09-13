/** Structured Substreams pipeline artifact — desk GenUI + strategy handoff. */

export const SUBSTREAMS_PIPELINE_ARTIFACT_KIND =
  "squadrons.substreams-pipeline" as const;

export type SubstreamsModuleKind =
  | "swaps"
  | "transfers"
  | "liquidity"
  | "metadata"
  | "holders"
  | "other";

export type SubstreamsModuleSpec = {
  id: string;
  kind: SubstreamsModuleKind;
  label: string;
  description: string;
};

export type SubstreamsPipelineStatus =
  | "authored"
  | "built"
  | "deployed"
  | "streaming";

export type SubstreamsPipelineArtifact = {
  kind: typeof SUBSTREAMS_PIPELINE_ARTIFACT_KIND;
  version: 1;
  /** Desk studio authoring path (manifest + package + hosted sink handoff). */
  engine: "studio";
  pipelineId: string;
  title: string;
  summary: string;
  intent: string;
  chainId: number;
  chainLabel: string;
  status: SubstreamsPipelineStatus;
  packageName: string;
  /** Public-style package URL (substreams.dev pattern). */
  packageUrl: string;
  outputModule: string;
  modules: SubstreamsModuleSpec[];
  /** Suggested strategy event name when Arming a listener. */
  triggerEvent: string;
  notes?: string[];
};

export function isSubstreamsPipelineArtifact(
  value: unknown,
): value is SubstreamsPipelineArtifact {
  if (!value || typeof value !== "object") return false;
  const row = value as Record<string, unknown>;
  if (row.kind !== SUBSTREAMS_PIPELINE_ARTIFACT_KIND || row.version !== 1) {
    return false;
  }
  if (typeof row.pipelineId !== "string" || typeof row.title !== "string") {
    return false;
  }
  if (typeof row.summary !== "string" || typeof row.intent !== "string") {
    return false;
  }
  if (typeof row.chainId !== "number" || !Array.isArray(row.modules)) {
    return false;
  }
  if (row.modules.length < 1) return false;
  return true;
}

export function isSubstreamsDeployToolName(
  toolName: string | null | undefined,
): boolean {
  if (!toolName) return false;
  return (
    toolName === "deploy_event_pipeline" ||
    toolName.endsWith("__deploy_event_pipeline")
  );
}

export function parseSubstreamsPipelineArtifact(
  raw: unknown,
): SubstreamsPipelineArtifact | null {
  if (isSubstreamsPipelineArtifact(raw)) return raw;
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (isSubstreamsPipelineArtifact(parsed)) return parsed;
    if (parsed && typeof parsed === "object") {
      const nested =
        (parsed as { artifact?: unknown; result?: unknown }).artifact ??
        (parsed as { result?: unknown }).result;
      if (isSubstreamsPipelineArtifact(nested)) return nested;
    }
  } catch {
    // fall through
  }

  const start = trimmed.indexOf(
    `{"kind":"${SUBSTREAMS_PIPELINE_ARTIFACT_KIND}"`,
  );
  const alt = trimmed.indexOf(
    `{"kind": "${SUBSTREAMS_PIPELINE_ARTIFACT_KIND}"`,
  );
  const idx = start >= 0 ? start : alt;
  if (idx < 0) return null;
  try {
    const parsed: unknown = JSON.parse(trimmed.slice(idx));
    return isSubstreamsPipelineArtifact(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
