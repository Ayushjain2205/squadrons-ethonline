import path from "node:path";

export const PIPELINE_DIR = ".squadrons";
export const PIPELINE_LAST_FILE = "substreams-pipeline-last.json";
export const PIPELINES_SUBDIR = "pipelines";

export function substreamsPipelineLastPath(workspace = process.cwd()) {
  return path.join(workspace, PIPELINE_DIR, PIPELINE_LAST_FILE);
}

export function pipelinePackageDir(pipelineId, workspace = process.cwd()) {
  return path.join(workspace, PIPELINE_DIR, PIPELINES_SUBDIR, pipelineId);
}
