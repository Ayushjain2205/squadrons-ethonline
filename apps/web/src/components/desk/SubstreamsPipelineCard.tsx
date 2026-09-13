"use client";

import type {
  SubstreamsModuleSpec,
  SubstreamsPipelineArtifact,
} from "@squadrons/shared";

/** Deployed Substreams event pipeline — compact chat GenUI card. */
export function SubstreamsPipelineCard({
  artifact,
}: {
  artifact: SubstreamsPipelineArtifact;
}) {
  const {
    title,
    summary,
    chainLabel,
    status,
    packageName,
    modules,
    triggerEvent,
    pipelineId,
    notes,
  } = artifact;

  return (
    <div className="mt-2 max-w-[min(100%,var(--measure-chat))] overflow-hidden rounded-2xl border border-[var(--line)] bg-[var(--panel)]">
      <header className="px-3 pt-2.5 pb-1.5">
        <p className="type-ui truncate font-semibold leading-tight text-[var(--ink)]">
          {title}
        </p>
        <p className="type-meta mt-0.5 line-clamp-2 leading-snug text-[var(--muted)]">
          {summary}
        </p>
      </header>

      <p className="type-meta truncate border-y border-[var(--line-soft)] px-3 py-1 text-[var(--muted)]">
        <span className="text-[var(--ink-soft)]">{chainLabel}</span>
        <span className="mx-1.5 text-[var(--line)]">·</span>
        <span className="capitalize text-[var(--ink-soft)]">{status}</span>
        <span className="mx-1.5 text-[var(--line)]">·</span>
        <span className="text-[var(--ink-soft)]">{triggerEvent}</span>
      </p>

      <ol className="px-1.5 py-1">
        {modules.map((mod, index) => (
          <ModuleRow key={mod.id} mod={mod} rank={index + 1} />
        ))}
      </ol>

      <p className="type-meta border-t border-[var(--line-soft)] px-3 py-1.5 text-[var(--muted)]">
        <span className="text-[var(--ink-soft)]">{packageName}</span>
        <span className="mx-1.5 text-[var(--line)]">·</span>
        <span className="font-mono text-[var(--ink-soft)]">{pipelineId}</span>
        {notes && notes.length > 0 ? (
          <>
            <span className="mx-1.5 text-[var(--line)]">·</span>
            <span>{notes[0]}</span>
          </>
        ) : null}
      </p>
    </div>
  );
}

function ModuleRow({
  mod,
  rank,
}: {
  mod: SubstreamsModuleSpec;
  rank: number;
}) {
  return (
    <li className="flex items-center gap-2 rounded-lg px-1.5 py-1.5">
      <span className="type-meta w-4 shrink-0 text-right tabular-nums text-[var(--muted)]">
        {rank}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-baseline gap-1.5">
          <span className="type-ui min-w-0 truncate font-medium leading-tight text-[var(--ink)]">
            {mod.label}
          </span>
          <span className="type-meta shrink-0 capitalize text-[var(--muted)]">
            {mod.kind}
          </span>
        </span>
        <span className="type-meta mt-0.5 block truncate leading-snug text-[var(--muted)]">
          {mod.description}
        </span>
      </span>
    </li>
  );
}
