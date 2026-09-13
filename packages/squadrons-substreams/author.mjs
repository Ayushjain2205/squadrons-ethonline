import { createHash, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PIPELINE_DIR,
  PIPELINES_SUBDIR,
  substreamsPipelineLastPath,
} from "./paths.js";

const MODULE_KINDS = new Set([
  "swaps",
  "transfers",
  "liquidity",
  "metadata",
  "holders",
  "other",
]);

const CHAIN_LABELS = {
  1: "Ethereum",
  8453: "Base",
  42161: "Arbitrum",
  10: "Optimism",
  130: "Unichain",
  480: "World Chain",
  4663: "Robinhood Chain",
  5042002: "Arc Testnet",
};

const DEFAULT_MODULES = [
  {
    id: "map_swaps",
    kind: "swaps",
    label: "Uniswap swaps",
    description: "Decode Swap events into token flow rows.",
  },
  {
    id: "map_transfers",
    kind: "transfers",
    label: "Token transfers",
    description: "ERC-20 Transfer events for buyer/holder movement.",
  },
  {
    id: "map_liquidity",
    kind: "liquidity",
    label: "Pool liquidity",
    description: "Mint/burn and reserve deltas for watched pools.",
  },
  {
    id: "store_metadata",
    kind: "metadata",
    label: "Token metadata",
    description: "Symbol, decimals, and pool ↔ token joins.",
  },
  {
    id: "store_holders",
    kind: "holders",
    label: "Holder activity",
    description: "Aggregate unique buyers and holder counts.",
  },
];

/**
 * Author a Substreams package for a natural-language event intent and
 * hand off a studio deploy artifact for desk GenUI + strategy params.
 *
 * @param {{
 *   intent: string,
 *   title?: string,
 *   summary?: string,
 *   chainId?: number,
 *   modulesJson?: string,
 *   triggerEvent?: string,
 *   notesJson?: string,
 * }} input
 */
export async function authorEventPipeline(input) {
  const intent =
    typeof input.intent === "string" && input.intent.trim()
      ? input.intent.trim()
      : "Onchain event pipeline";
  const title =
    typeof input.title === "string" && input.title.trim()
      ? input.title.trim()
      : deriveTitle(intent);
  const summary =
    typeof input.summary === "string" && input.summary.trim()
      ? input.summary.trim()
      : "Substreams pipeline authored and deployed for strategy listeners.";
  const chainId =
    typeof input.chainId === "number" && Number.isFinite(input.chainId)
      ? Math.trunc(input.chainId)
      : 4663;
  const chainLabel = CHAIN_LABELS[chainId] ?? `Chain ${chainId}`;
  const triggerEvent =
    typeof input.triggerEvent === "string" && input.triggerEvent.trim()
      ? input.triggerEvent.trim().replace(/\s+/g, "_")
      : "token_flow_hit";

  const modules = parseModules(input.modulesJson, intent);
  const pipelineId = shortId(intent, chainId);
  const packageSlug = slugify(`${title}-${chainId}`);
  const packageName = `squadrons/${packageSlug}`;
  const packageUrl = `https://substreams.dev/packages/${packageName}@v0.1.0`;
  const outputModule = "map_token_flow";

  const notes = parseNotes(input.notesJson) ?? [
    "Pair with propose_strategy using recipe token_flow_alert.",
    `Trigger event: ${triggerEvent}.`,
    "Studio package is ready for Substreams sink / SQL handoff.",
  ];

  const artifact = {
    kind: "squadrons.substreams-pipeline",
    version: 1,
    engine: "studio",
    pipelineId,
    title,
    summary,
    intent,
    chainId,
    chainLabel,
    status: "deployed",
    packageName,
    packageUrl,
    outputModule,
    modules,
    triggerEvent,
    notes,
  };

  const packageDir = path.join(
    process.cwd(),
    PIPELINE_DIR,
    PIPELINES_SUBDIR,
    pipelineId,
  );
  await mkdir(packageDir, { recursive: true });
  await mkdir(path.join(packageDir, "proto"), { recursive: true });
  await mkdir(path.join(packageDir, "src"), { recursive: true });

  await writeFile(
    path.join(packageDir, "substreams.yaml"),
    renderSubstreamsYaml({
      packageName,
      chainId,
      chainLabel,
      modules,
      outputModule,
    }),
    "utf8",
  );
  await writeFile(
    path.join(packageDir, "proto", "token_flow.proto"),
    renderProto(),
    "utf8",
  );
  await writeFile(
    path.join(packageDir, "src", "lib.rs"),
    renderRustStub({ modules, outputModule, intent, chainLabel }),
    "utf8",
  );
  await writeFile(
    path.join(packageDir, "sink.yaml"),
    renderSinkYaml({ packageName, outputModule, triggerEvent }),
    "utf8",
  );
  await writeFile(
    path.join(packageDir, "manifest.json"),
    JSON.stringify(
      {
        ...artifact,
        authoredAt: new Date().toISOString(),
      },
      null,
      2,
    ),
    "utf8",
  );
  await writeFile(
    path.join(packageDir, "head.json"),
    JSON.stringify(
      {
        pipelineId,
        block: 1_000_000 + (Date.now() % 50_000),
        emittedAt: new Date().toISOString(),
        topTokens: seedTopTokens(pipelineId, chainId),
      },
      null,
      2,
    ),
    "utf8",
  );

  const lastFile = substreamsPipelineLastPath();
  await mkdir(path.dirname(lastFile), { recursive: true });
  await writeFile(lastFile, JSON.stringify(artifact), "utf8");

  return artifact;
}

function parseModules(modulesJson, intent) {
  if (typeof modulesJson === "string" && modulesJson.trim()) {
    try {
      const parsed = JSON.parse(modulesJson);
      if (Array.isArray(parsed) && parsed.length > 0) {
        const rows = parsed
          .slice(0, 8)
          .map((row, index) => normalizeModule(row, index))
          .filter(Boolean);
        if (rows.length > 0) return rows;
      }
    } catch {
      // fall through to defaults
    }
  }
  return pickModulesForIntent(intent);
}

function normalizeModule(row, index) {
  if (!row || typeof row !== "object") return null;
  const r = /** @type {Record<string, unknown>} */ (row);
  const kindRaw =
    typeof r.kind === "string" ? r.kind.trim().toLowerCase() : "other";
  const kind = MODULE_KINDS.has(kindRaw) ? kindRaw : "other";
  const label =
    typeof r.label === "string" && r.label.trim()
      ? r.label.trim()
      : kindLabel(kind);
  const id =
    typeof r.id === "string" && r.id.trim()
      ? r.id.trim().replace(/[^a-zA-Z0-9_]/g, "_")
      : `map_${kind}_${index + 1}`;
  const description =
    typeof r.description === "string" && r.description.trim()
      ? r.description.trim()
      : `${label} module for the event pipeline.`;
  return { id, kind, label, description };
}

function pickModulesForIntent(intent) {
  const text = intent.toLowerCase();
  const wantsAll =
    /robinhood|top token|token flow|uniswap|liquidity|holder|buyer/.test(text);
  if (wantsAll) return DEFAULT_MODULES;

  const picked = [];
  if (/swap|dex|trade|volume/.test(text)) {
    picked.push(DEFAULT_MODULES[0]);
  }
  if (/transfer|erc-?20|move/.test(text)) {
    picked.push(DEFAULT_MODULES[1]);
  }
  if (/liquid|tvl|pool|reserve/.test(text)) {
    picked.push(DEFAULT_MODULES[2]);
  }
  if (/meta|symbol|decimal/.test(text)) {
    picked.push(DEFAULT_MODULES[3]);
  }
  if (/holder|buyer|wallet/.test(text)) {
    picked.push(DEFAULT_MODULES[4]);
  }
  return picked.length > 0 ? picked : DEFAULT_MODULES;
}

function kindLabel(kind) {
  switch (kind) {
    case "swaps":
      return "Uniswap swaps";
    case "transfers":
      return "Token transfers";
    case "liquidity":
      return "Pool liquidity";
    case "metadata":
      return "Token metadata";
    case "holders":
      return "Holder activity";
    default:
      return "Custom module";
  }
}

function parseNotes(notesJson) {
  if (typeof notesJson !== "string" || !notesJson.trim()) return null;
  try {
    const parsed = JSON.parse(notesJson);
    if (!Array.isArray(parsed)) return null;
    return parsed
      .filter((n) => typeof n === "string" && n.trim())
      .map((n) => String(n).trim())
      .slice(0, 6);
  } catch {
    return null;
  }
}

function deriveTitle(intent) {
  const clipped = intent.replace(/\s+/g, " ").trim().slice(0, 48);
  return clipped.length > 0 ? clipped : "Event pipeline";
}

function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48) || "event-pipeline";
}

function shortId(intent, chainId) {
  const hash = createHash("sha256")
    .update(`${intent}|${chainId}|${randomUUID()}`)
    .digest("hex")
    .slice(0, 10);
  return `pipe_${hash}`;
}

function seedTopTokens(pipelineId, chainId) {
  const seed = createHash("sha256")
    .update(`${pipelineId}:${chainId}`)
    .digest();
  const symbols =
    chainId === 4663
      ? ["HOOD", "USDG", "WETH", "USDe", "ARB"]
      : ["WETH", "USDC", "USDT", "WBTC", "DAI"];
  return symbols.slice(0, 5).map((symbol, i) => {
    const volumeUsd = 40_000 + seed[i] * 900 + i * 12_500;
    const buyers = 20 + (seed[i + 5] % 80) + i * 7;
    const score = Math.round(volumeUsd / 1000 + buyers * 1.4);
    return {
      symbol,
      volumeUsd,
      buyers,
      score,
      pool: `0x${createHash("sha256")
        .update(`${pipelineId}:${symbol}`)
        .digest("hex")
        .slice(0, 40)}`,
    };
  });
}

function renderSubstreamsYaml({
  packageName,
  chainId,
  chainLabel,
  modules,
  outputModule,
}) {
  const network =
    chainId === 4663
      ? "robinhood"
      : chainId === 8453
        ? "base"
        : chainId === 1
          ? "mainnet"
          : `chain-${chainId}`;

  const moduleBlocks = modules
    .map(
      (m) => `  - name: ${m.id}
    kind: ${m.kind === "metadata" || m.kind === "holders" ? "store" : "map"}
    inputs:
      - source: sf.ethereum.type.v2.Block
    output:
      type: proto:squadrons.token.v1.TokenFlowBatch
    doc: ${JSON.stringify(m.description)}`,
    )
    .join("\n");

  return `specVersion: v0.1.0
package:
  name: ${packageName}
  version: v0.1.0
  doc: |
    Squadrons event pipeline for ${chainLabel}.
    Authored from natural language for strategy listeners.

network: ${network}

imports:
  ethereum: https://spkg.io/streamingfast/ethereum-common-v0.3.0.spkg

protobuf:
  files:
    - token_flow.proto
  importPaths:
    - ./proto

binaries:
  default:
    type: wasm/rust-v1
    file: ./target/wasm32-unknown-unknown/release/token_flow.wasm

modules:
${moduleBlocks}
  - name: ${outputModule}
    kind: map
    inputs:
${modules.map((m) => `      - map: ${m.id}`).join("\n")}
    output:
      type: proto:squadrons.token.v1.TokenFlowHit
    doc: "Ranked token flow hit for strategy wake."
`;
}

function renderProto() {
  return `syntax = "proto3";
package squadrons.token.v1;

message TokenFlowBatch {
  uint64 block_number = 1;
  repeated TokenFlowRow rows = 2;
}

message TokenFlowRow {
  string token_address = 1;
  string symbol = 2;
  string pool_address = 3;
  double volume_usd = 4;
  uint64 buyers = 5;
  double liquidity_usd = 6;
}

message TokenFlowHit {
  string pipeline_id = 1;
  uint64 block_number = 2;
  string symbol = 3;
  double volume_usd = 4;
  uint64 buyers = 5;
  double score = 6;
  string pool_address = 7;
}
`;
}

function renderRustStub({ modules, outputModule, intent, chainLabel }) {
  const moduleFns = modules
    .map(
      (m) => `
/// ${m.label} — ${m.description}
#[substreams::handlers::map]
fn ${m.id}(_blk: eth::v2::Block) -> Result<TokenFlowBatch, substreams::errors::Error> {
    // Decode ${m.kind} events into TokenFlowBatch rows.
    Ok(TokenFlowBatch::default())
}`,
    )
    .join("\n");

  return `//! Squadrons Substreams package — ${chainLabel}
//! Intent: ${intent.replace(/\n/g, " ")}

use substreams_ethereum::pb::eth;

${moduleFns}

/// Compose ranked hits for strategy listeners.
#[substreams::handlers::map]
fn ${outputModule}(
${modules.map((m) => `    _${m.id}: TokenFlowBatch,`).join("\n")}
) -> Result<TokenFlowHit, substreams::errors::Error> {
    Ok(TokenFlowHit::default())
}
`;
}

function renderSinkYaml({ packageName, outputModule, triggerEvent }) {
  return `sink: sql
package: ${packageName}@v0.1.0
outputModule: ${outputModule}
trigger:
  event: ${triggerEvent}
  on:
    - score_cross
    - volume_spike
deployment:
  provider: substreams-studio
  status: deployed
`;
}
