import { defineTool } from "@deepseek-ai/dsh-tools";
import { authorEventPipeline } from "./author.mjs";

/** Cordis plugin id / package export name. */
export const name = "squadrons-substreams";
export const inject = ["tools"];

/**
 * First-party GenUI + strategy handoff for Substreams event pipelines.
 * Keep parameter schemas flat — nested object arrays have broken Cordis/dsh startup.
 *
 * @param {import('@deepseek-ai/cordis').Context} ctx
 */
export function apply(ctx) {
  ctx.tools.register(
    defineTool({
      name: "deploy_event_pipeline",
      description:
        "Author and deploy a Substreams event pipeline from a natural-language intent (kind: squadrons.substreams-pipeline). Use when the user needs onchain listeners for a strategy — Uniswap swaps, transfers, liquidity, metadata, holders — including @pipeline mentions and /event-pipeline. Then call propose_strategy with recipe token_flow_alert and params.pipelineId from the result. modulesJson is optional JSON array of {id?, kind, label?, description?}.",
      parameters: {
        intent: {
          type: "string",
          description:
            "Natural-language description of the onchain events to index (e.g. top tokens on Robinhood Chain from Uniswap swaps + transfers).",
        },
        title: {
          type: "string",
          description: "Short card title (e.g. Robinhood top-token flow).",
        },
        summary: {
          type: "string",
          description: "One-line operator summary of what the pipeline streams.",
        },
        chainId: {
          type: "number",
          description: "Home chain id (e.g. 4663 Robinhood, 8453 Base).",
        },
        modulesJson: {
          type: "string",
          description:
            'Optional JSON array: [{"kind":"swaps|transfers|liquidity|metadata|holders|other","label":"...","description":"..."}]',
        },
        triggerEvent: {
          type: "string",
          description:
            'Strategy trigger event name. Default "token_flow_hit".',
        },
        notesJson: {
          type: "string",
          description: "Optional JSON string array of operator notes.",
        },
      },
      output: {
        schema: { type: "object", additionalProperties: true },
        render: (_args, value) => [
          {
            type: "text",
            text:
              typeof value?.summary === "string"
                ? `${value.summary}\n\n${JSON.stringify(value)}`
                : JSON.stringify(value),
          },
        ],
      },
      timeoutMs: 15_000,
      isConcurrencySafe: () => true,
      async execute(args) {
        return authorEventPipeline({
          intent: args.intent,
          title: args.title,
          summary: args.summary,
          chainId: args.chainId,
          modulesJson: args.modulesJson,
          triggerEvent: args.triggerEvent,
          notesJson: args.notesJson,
        });
      },
    }),
  );
}
