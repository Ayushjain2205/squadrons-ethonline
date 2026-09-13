import { readFile, unlink } from "node:fs/promises";
import path from "node:path";
import {
  isSubstreamsPipelineArtifact,
  type SubstreamsPipelineArtifact,
} from "@squadrons/shared";

const LAST_FILE = path.join(".squadrons", "substreams-pipeline-last.json");

export function substreamsPipelineLastFile(workspace: string): string {
  return path.join(workspace, LAST_FILE);
}

/** Read the latest pipeline artifact written by deploy_event_pipeline. */
export async function readPendingSubstreamsPipeline(
  workspace: string,
): Promise<SubstreamsPipelineArtifact | null> {
  try {
    const raw = await readFile(substreamsPipelineLastFile(workspace), "utf8");
    const parsed: unknown = JSON.parse(raw);
    if (!isSubstreamsPipelineArtifact(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function clearPendingSubstreamsPipeline(
  workspace: string,
): Promise<void> {
  try {
    await unlink(substreamsPipelineLastFile(workspace));
  } catch {
    // ignore
  }
}
