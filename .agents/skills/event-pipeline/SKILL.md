---
name: event-pipeline
description: Author a Substreams listener from a natural-language intent, then draft the strategy that wakes on those hits.
user-invocable: true
---

# Event pipeline

You are authoring a **Substreams event pipeline** for this agent's home chain, then wiring it into a runnable strategy draft.

## Featured path (The Graph Substreams)

Turn one natural-language prompt into a working, deployed Substreams package the desk can Arm against.

## Robinhood example — top tokens

For a “top tokens on Robinhood Chain” service, the pipeline should process:

- Uniswap swap events
- Token transfer events
- Pool liquidity changes
- Token metadata
- Holder and buyer activity

## Steps

1. Confirm **home chain** from identity (Robinhood = 4663 is a strong fit — GeckoTerminal is weak there).
2. Call `deploy_event_pipeline` with:
   - `intent` — the user's NL goal
   - `title` / `summary` — short operator copy
   - `chainId` — home chain
   - `modulesJson` — prefer swaps, transfers, liquidity, metadata, holders when building a top-token / flow service
   - `triggerEvent` — usually `token_flow_hit`
3. From the tool result, take `pipelineId`, `packageUrl`, and `modules`.
4. Call `propose_strategy` with:
   - `recipeId`: `token_flow_alert`
   - `params`: `{ pipelineId, minVolumeUsd, minScore }`
   - `trigger`: `{ type: "event", event: "token_flow_hit", intervalSec: 60 }`
   - `action`: `{ type: "alert" }`
5. Tell the operator to **Arm** in the desk. Do not claim it is running.

## Rules

- Prefer `deploy_event_pipeline` over inventing package YAML in chat.
- Do **not** call `web_search`.
- Do **not** invent onchain volumes — the studio stream head + recipe own the numbers after deploy.
- Keep the reply short: what was deployed, which modules, and the draft strategy knobs.
