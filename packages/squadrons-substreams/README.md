# squadrons-substreams

First-party Cordis tool `deploy_event_pipeline` — authors a Substreams package from a natural-language intent and publishes a chat GenUI card (`kind: squadrons.substreams-pipeline`).

Workspace outputs:

- `.squadrons/substreams-pipeline-last.json` — host mid-turn sync
- `.squadrons/pipelines/<id>/` — `substreams.yaml`, proto, Rust stub, sink, manifest, stream head

Pair with `propose_strategy` recipe `token_flow_alert` and trigger event `token_flow_hit`.
